/**
 * 行级数据范围解析器的用例。
 *
 * 覆盖的是「算得对不对」和「算不出来时收紧还是放开」——后者比前者更重要：
 * 一次 fail-open 就会把整个部门体系变成摆设。
 *
 * 语义基线（本仓库五档，语义对齐 RuoYi 的 @DataScope）：
 *   1 全部数据 / 2 本部门 / 3 本部门及子部门 / 4 仅本人 / 5 自定义
 * 合并方式只有两种：**全部数据**，或者 **授权部门集合 ∪ 本人**。
 * 不再按「档位宽度取最宽」合并——那会丢掉「仅本人」，也会让无关角色的
 * 「全部数据」扩大当前操作的范围。
 */
import { MySqlDialect } from 'drizzle-orm/mysql-core'
import type { SQL } from 'drizzle-orm'
import { describe, expect, it } from './runtime-fixture'
import {
  DATA_SCOPE_ALL,
  DATA_SCOPE_CUSTOM,
  DATA_SCOPE_DEPT,
  DATA_SCOPE_DEPT_AND_CHILD,
  DATA_SCOPE_SELF,
  resolveDataScope,
  runWithoutDataScope,
  userDataScopeCondition,
  type DataScopeFilter,
  type DataScopeSubject,
} from '../src/core/auth/data-scope'
import { setTestPermissionDeclarations } from './runtime-fixture'
import { sysDept, sysRole, sysRoleDept, sysRolePermission } from '../src/db/schema'


setTestPermissionDeclarations([
  { code: 'system:user:list', label: '用户管理-列表', group: 'system' },
  { code: 'system:user:update', label: '用户管理-更新', group: 'system' },
  { code: 'ai:chat:use', label: 'AI 助手', group: 'ai' },
])

interface FakeRole {
  id: number
  dataScope: number
  code?: string | null
  perms?: string[]
}

/**
 * 假 db：按表形状分流 resolver 与权限矩阵的三类查询。
 * 只提供 select/from/where（权限矩阵的 role 关联查询走 innerJoin，
 * 但它 select 的是 sysRolePermission，主表判定仍然可用）。
 */
function fakeDb(options: {
  roles?: FakeRole[]
  customDepts?: Record<number, number[]>
  depts?: Array<{ id: number; parentId: number | null }>
} = {}) {
  const roles = options.roles ?? []
  const customDepts = options.customDepts ?? {}
  const depts = options.depts ?? []
  const rowsFor = (table: unknown) => {
    if (table === sysRoleDept) {
      return Object.entries(customDepts).flatMap(([roleId, deptIds]) =>
        deptIds.map((deptId) => ({ roleId: Number(roleId), deptId })),
      )
    }
    if (table === sysRolePermission) {
      return roles.flatMap((role) =>
        // 别名必须与 PermissionRepository.loadPermissionsByRole 一致（`perm`）。
        (role.perms ?? []).map((perm) => ({ roleId: role.id, perm })),
      )
    }
    if (table === sysRole) {
      return roles.map((role) => ({ id: role.id, dataScope: role.dataScope, code: role.code ?? null }))
    }
    if (table === sysDept) return depts
    return []
  }
  return {
    select: (_cols?: unknown) => ({
      from: (table: unknown) => ({
        innerJoin: () => ({ where: () => Promise.resolve(rowsFor(table)) }),
        where: () => Promise.resolve(rowsFor(table)),
      }),
    }),
  } as never
}

function subject(over: Partial<DataScopeSubject> = {}): DataScopeSubject {
  return { userId: 7, roleIds: [3], deptIds: [10], superAdmin: false, ...over }
}

/** 把范围条件渲染成 SQL 文本，用于断言「部门 OR 本人」的结构而不是精确格式。 */
function render(condition: unknown): string {
  const dialect = new MySqlDialect({ casing: {} as never })
  return dialect.sqlToQuery(condition as SQL).sql
}

describe('resolveDataScope — 基本档位', () => {
  it('gives the super administrator everything without consulting roles', async () => {
    await expect(resolveDataScope(subject({ superAdmin: true, roleIds: [] }), fakeDb())).resolves.toEqual({
      kind: 'all',
    })
  })

  it('treats an all-data role as all, even when other roles are narrower', async () => {
    const db = fakeDb({ roles: [{ id: 3, dataScope: DATA_SCOPE_SELF }, { id: 4, dataScope: DATA_SCOPE_ALL }] })
    await expect(resolveDataScope(subject({ roleIds: [3, 4] }), db)).resolves.toEqual({ kind: 'all' })
  })

  it('restricts a self-only role to its own row', async () => {
    const db = fakeDb({ roles: [{ id: 3, dataScope: DATA_SCOPE_SELF }] })
    await expect(resolveDataScope(subject(), db)).resolves.toEqual({
      kind: 'restricted',
      deptIds: [],
      selfUserId: 7,
    })
  })

  it('restricts a dept role to the user departments without walking the tree', async () => {
    const db = fakeDb({ roles: [{ id: 3, dataScope: DATA_SCOPE_DEPT }] })
    await expect(resolveDataScope(subject({ deptIds: [10, 11] }), db)).resolves.toEqual({
      kind: 'restricted',
      deptIds: [10, 11],
      selfUserId: null,
    })
  })

  it('expands a dept-and-child role to the whole subtree', async () => {
    const db = fakeDb({
      roles: [{ id: 3, dataScope: DATA_SCOPE_DEPT_AND_CHILD }],
      depts: [
        { id: 10, parentId: null },
        { id: 11, parentId: 10 },
        { id: 12, parentId: 11 },
        { id: 20, parentId: null },
      ],
    })
    const resolved = await resolveDataScope(subject({ deptIds: [10] }), db)
    expect(resolved.kind === 'restricted' && resolved.deptIds.sort()).toEqual([10, 11, 12])
  })

  it('reads the custom department set for a custom role', async () => {
    const db = fakeDb({
      roles: [{ id: 3, dataScope: DATA_SCOPE_CUSTOM }],
      customDepts: { 3: [30, 31] },
    })
    await expect(resolveDataScope(subject(), db)).resolves.toEqual({
      kind: 'restricted',
      deptIds: [30, 31],
      selfUserId: null,
    })
  })

  it('keeps a custom role that has no department row at zero rows rather than all rows', async () => {
    const db = fakeDb({ roles: [{ id: 3, dataScope: DATA_SCOPE_CUSTOM }], customDepts: {} })
    await expect(resolveDataScope(subject(), db)).resolves.toEqual({
      kind: 'restricted',
      deptIds: [],
      selfUserId: null,
    })
  })
})

describe('resolveDataScope — 多角色合并', () => {
  it('unions department sets and keeps the self condition alongside them', async () => {
    const db = fakeDb({
      roles: [
        { id: 3, dataScope: DATA_SCOPE_DEPT },
        { id: 4, dataScope: DATA_SCOPE_CUSTOM },
        { id: 5, dataScope: DATA_SCOPE_SELF },
      ],
      customDepts: { 4: [30] },
    })
    // 「取最宽」会在这里丢掉「仅本人」——本人必须仍然可见。
    await expect(resolveDataScope(subject({ roleIds: [3, 4, 5] }), db)).resolves.toEqual({
      kind: 'restricted',
      deptIds: [10, 30],
      selfUserId: 7,
    })
  })

  it('unions a custom-department role with a self-only role', async () => {
    const db = fakeDb({
      roles: [
        { id: 4, dataScope: DATA_SCOPE_CUSTOM },
        { id: 5, dataScope: DATA_SCOPE_SELF },
      ],
      customDepts: { 4: [30] },
    })
    await expect(resolveDataScope(subject({ roleIds: [4, 5] }), db)).resolves.toEqual({
      kind: 'restricted',
      deptIds: [30],
      selfUserId: 7,
    })
  })

  it('yields an empty range — not "self" — when the user holds no role', async () => {
    // 回退成 self 等于凭空授权：那是一个没有任何角色的人。
    await expect(resolveDataScope(subject({ roleIds: [] }), fakeDb())).resolves.toEqual({
      kind: 'restricted',
      deptIds: [],
      selfUserId: null,
    })
  })

  it('ignores an unrecognised level instead of assuming the widest', async () => {
    const db = fakeDb({ roles: [{ id: 3, dataScope: 99 }] })
    await expect(resolveDataScope(subject(), db)).resolves.toEqual({
      kind: 'restricted',
      deptIds: [],
      selfUserId: null,
    })
  })

  it('never widens for a department-scoped user who belongs to no department', async () => {
    const db = fakeDb({ roles: [{ id: 3, dataScope: DATA_SCOPE_DEPT_AND_CHILD }], depts: [] })
    await expect(resolveDataScope(subject({ deptIds: [] }), db)).resolves.toEqual({
      kind: 'restricted',
      deptIds: [],
      selfUserId: null,
    })
  })
})

describe('resolveDataScope — 只计入授予本次操作权限的角色', () => {
  it('does not let an unrelated all-data role widen the current operation', async () => {
    const db = fakeDb({
      roles: [
        // 角色 9 授予全部数据，但**不**授予 system:user:list。
        { id: 3, dataScope: DATA_SCOPE_SELF, perms: ['system:user:list'] },
        { id: 9, dataScope: DATA_SCOPE_ALL, perms: ['ai:chat:use'] },
      ],
    })
    await expect(
      resolveDataScope(subject({ roleIds: [3, 9], permissionCode: 'system:user:list' }), db),
    ).resolves.toEqual({ kind: 'restricted', deptIds: [], selfUserId: 7 })
  })

  it('honours the all-data role when it does grant the operation', async () => {
    const db = fakeDb({
      roles: [
        { id: 3, dataScope: DATA_SCOPE_SELF, perms: ['system:user:list'] },
        { id: 9, dataScope: DATA_SCOPE_ALL, perms: ['system:user:list'] },
      ],
    })
    await expect(
      resolveDataScope(subject({ roleIds: [3, 9], permissionCode: 'system:user:list' }), db),
    ).resolves.toEqual({ kind: 'all' })
  })

  it('ignores a disabled or deleted role entirely', async () => {
    // loadRoleScopes 的 where 已经过滤 status/deletedAt；这里用「查不到该角色」模拟。
    const db = fakeDb({ roles: [] })
    await expect(resolveDataScope(subject({ permissionCode: 'system:user:list' }), db)).resolves.toEqual({
      kind: 'restricted',
      deptIds: [],
      selfUserId: null,
    })
  })

  it('strips the super-admin sentinel when the PAT scope does not grant it', async () => {
    // super_admin 角色的档位是「全部数据」，但 PAT scope 只写了 system:user:list，
    // 没写哨兵 → 哨兵被剥离，角色不再被计入 → 范围收紧而不是放开。
    const db = fakeDb({ roles: [{ id: 3, dataScope: DATA_SCOPE_ALL, code: 'super_admin' }] })
    await expect(
      resolveDataScope(subject({ roleIds: [3], tokenScope: ['system:user:list'], permissionCode: 'system:user:list' }), db),
    ).resolves.toEqual({ kind: 'restricted', deptIds: [], selfUserId: null })
  })

  it('keeps the sentinel when the PAT scope is the wildcard', async () => {
    const db = fakeDb({ roles: [{ id: 3, dataScope: DATA_SCOPE_ALL, code: 'super_admin' }] })
    await expect(
      resolveDataScope(subject({ roleIds: [3], tokenScope: ['*'], permissionCode: 'system:user:list' }), db),
    ).resolves.toEqual({ kind: 'all' })
  })

  it('treats a PAT scope without the operation permission as no granting role', async () => {
    const db = fakeDb({ roles: [{ id: 3, dataScope: DATA_SCOPE_ALL, perms: ['system:user:list'] }] })
    await expect(
      resolveDataScope(subject({ tokenScope: ['ai:chat:use'], permissionCode: 'system:user:list' }), db),
    ).resolves.toEqual({ kind: 'restricted', deptIds: [], selfUserId: null })
  })
})



describe('userDataScopeCondition — SQL 形状', () => {
  const all: DataScopeFilter = { kind: 'all' }

  it('adds nothing for all-data', () => {
    expect(userDataScopeCondition(all)).toBeUndefined()
  })

  it('produces a deny-all condition for an empty restricted range', () => {
    expect(render(userDataScopeCondition({ kind: 'restricted', deptIds: [], selfUserId: null }))).toContain('1 = 0')
  })

  it('keeps both the department and the self branch when both apply', () => {
    const sql = render(userDataScopeCondition({ kind: 'restricted', deptIds: [10], selfUserId: 7 }))
    // 「取最宽」的旧实现这里只会留下 exists 子查询，把「本人」整条丢掉。
    expect(sql).toContain('exists')
    expect(sql).toMatch(/ or /i)
  })

  it('keeps only the department branch when no self role applies', () => {
    const sql = render(userDataScopeCondition({ kind: 'restricted', deptIds: [10], selfUserId: null }))
    expect(sql).toContain('exists')
    expect(sql).not.toMatch(/ or /i)
  })
})
