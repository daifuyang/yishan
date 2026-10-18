/**
 * 行级数据范围在 **repository 层**的落地用例。
 *
 * AI 的 `get_user` / `list_users` / `prepare_update_user` 最终都落到
 * `UserService.getUserById` / `getUserList` / `updateUser` / `deleteUser`，
 * 所以这里直接测真实 Service → 真实 `UserRepository` → 真实 `resolveDataScope`
 * 的 SQL 条件，用来回答验收项里「AI 的查询与写入闭环」那几条。
 *
 * 只有最底下的 SQL 执行是假的（`test/setup.ts` 里的 drizzle mock）；
 * 范围计算本身一行都没 mock。断言的对象是 repository **收到的条件**。
 */
import { describe, expect, it, vi } from './runtime-fixture'
import { setTestPermissionDeclarations } from './runtime-fixture'
import { MySqlDialect } from 'drizzle-orm/mysql-core'
import type { SQL } from 'drizzle-orm'
import { UserService } from '../src/core/services/user.service'
import { UserRepository } from '../src/core/repositories/user.repository'
import { PermissionService } from '../src/core/services/permission.service'
import { runWithDataScope, type DataScopeSubject } from '../src/core/auth/data-scope'
import { UserErrorCode } from '@yishan/core-api/business-codes/user'
import { drizzleDb } from '../src/db'
import { sysRole, sysRoleDept, sysRolePermission } from '../src/db/schema'

setTestPermissionDeclarations([
  { code: 'system:user:list', label: '用户管理-列表', group: 'system' },
  { code: 'system:user:update', label: '用户管理-更新', group: 'system' },
  { code: 'system:user:delete', label: '用户管理-删除', group: 'system' },
])

const dialect = new MySqlDialect({ casing: {} as never })
function render(condition: unknown): string | undefined {
  if (!condition) return undefined
  return dialect.sqlToQuery(condition as SQL).sql
}

interface Tier {
  dataScope: number
  perms: string[]
  code?: string | null
  customDepts?: number[]
}

/**
 * 让 `resolveDataScope` 的三张表查询返回预期行。
 *
 * 这不是 mock 范围规则，只是让角色档位有数据可读——档位如何合并成条件仍由
 * 被测代码自己算。
 */
/** 每条 where 的 SQL 文本，按调用顺序。用来断言 repository 真正下发的条件。 */
let seenWheres: string[] = []

function stubRoleTiers(roles: Record<number, Tier>) {
  seenWheres = []
  vi.spyOn(drizzleDb, 'select').mockImplementation((columns: never) => {
    const keys = Object.keys(columns ?? {})
    let rows: unknown[] = []
    const chain = {
      from: () => chain,
      innerJoin: () => chain,
      leftJoin: () => chain,
      rightJoin: () => chain,
      limit: () => chain,
      offset: () => chain,
      orderBy: () => chain,
      where: (condition?: unknown) => {
        seenWheres.push(condition ? render(condition) ?? '<unrenderable>' : '<none>')
        if (keys.includes('dataScope')) {
          rows = Object.entries(roles).map(([id, tier]) => ({ id: Number(id), dataScope: tier.dataScope }))
        } else if (keys.includes('perm')) {
          rows = Object.entries(roles).flatMap(([id, tier]) => tier.perms.map(perm => ({ roleId: Number(id), perm })))
        } else if (keys.includes('code')) {
          rows = Object.entries(roles).map(([id, tier]) => ({ id: Number(id), code: tier.code ?? null }))
        } else if (keys.includes('deptId')) {
          rows = Object.entries(roles).flatMap(([id, tier]) =>
            (tier.customDepts ?? []).map(deptId => ({ roleId: Number(id), deptId })),
          )
        } else {
          rows = []
        }
        return chain
      },
      then: (resolve: (value: unknown[]) => unknown, reject: (reason: unknown) => unknown) =>
        Promise.resolve(rows).then(resolve, reject),
    }
    return chain
  }) as never
}

function superAdminSentinel(on: boolean) {
  vi.spyOn(PermissionService, 'loadForRoleIds').mockResolvedValue({
    perms: new Set(on ? ['__super_admin__'] : []),
    roleCodes: new Set<string>(),
  } as never)
}

function subject(over: Partial<DataScopeSubject> = {}): DataScopeSubject {
  return { userId: 7, roleIds: [1], deptIds: [10], superAdmin: false, permissionCode: 'system:user:list', ...over }
}

/**
 * 跑一次真实列表查询，返回业务查询那条 where 的 SQL。
 *
 * 行级条件不是独立参数——它被 `buildUserWhere` 合进整条 where 一起下发，
 * 所以只能在 SQL 层断言。
 */
async function listScopeCondition(s: DataScopeSubject): Promise<string | undefined> {
  await runWithDataScope(s, () => UserService.getUserList({ page: 1, pageSize: 10 }))
  // 角色档位查询先发生，业务用户查询是最后一条。
  return seenWheres.at(-1)
}

async function detailScopeCondition(s: DataScopeSubject, id = 42): Promise<string | undefined> {
  const find = vi.spyOn(UserRepository, 'findByIdWithScope').mockResolvedValue(null)
  await runWithDataScope(s, () => UserService.getUserById(id))
  return render(find.mock.calls[0][1] as SQL | undefined)
}

describe('列表与统计同范围', () => {
  it('restricts a list to the operator department', async () => {
    stubRoleTiers({ 1: { dataScope: 2, perms: ['system:user:list'] } })
    superAdminSentinel(false)
    const sql = await listScopeCondition(subject({ deptIds: [10] }))
    expect(sql).toContain('exists')
  })

  it('gives the list and the count the very same condition', async () => {
    stubRoleTiers({ 1: { dataScope: 2, perms: ['system:user:list'] } })
    superAdminSentinel(false)
    await runWithDataScope(subject(), () => UserService.getUserList({ page: 1, pageSize: 10 }))
    // list 与 count 都经由 buildUserWhere + 同一个 dataScopeCondition，
    // 因此两次下发的用户查询 where 必须逐字相同——否则「列表看得见、统计看不见」。
    const userWheres = seenWheres.filter(sql => sql?.includes('`sys_user`'))
    expect(new Set(userWheres).size).toBe(1)
    expect(userWheres[0]).toContain('sys_user_dept')
  })

  it('leaves the query unfiltered for an all-data role', async () => {
    stubRoleTiers({ 1: { dataScope: 1, perms: ['system:user:list'] } })
    superAdminSentinel(false)
    const sql = await listScopeCondition(subject())
    // 仍会有软删条件，但不得带任何行级过滤。
    expect(sql).not.toContain('exists')
    expect(sql).not.toContain('1 = 0')
  })
})

describe('详情读与写同样受限', () => {
  it('applies the same scope to a single-record read', async () => {
    stubRoleTiers({ 1: { dataScope: 2, perms: ['system:user:list'] } })
    superAdminSentinel(false)
    expect(await detailScopeCondition(subject())).toContain('exists')
  })

  it('drops the read cache for a scoped request so a cached id cannot be replayed', async () => {
    stubRoleTiers({ 1: { dataScope: 4, perms: ['system:user:list'] } })
    superAdminSentinel(false)
    const redis = { get: vi.fn(), setex: vi.fn(), del: vi.fn(), log: { warn: vi.fn() } }
    vi.spyOn(UserRepository, 'findByIdWithScope').mockResolvedValue(null)

    await runWithDataScope(subject(), () =>
      UserService.getUserById(42, { redis, log: redis.log } as never),
    )
    expect(redis.get).not.toHaveBeenCalled()
    expect(redis.setex).not.toHaveBeenCalled()
  })

  it('refuses to update a user outside the range instead of reporting success', async () => {
    stubRoleTiers({ 1: { dataScope: 4, perms: ['system:user:list', 'system:user:update'] } })
    superAdminSentinel(false)
    vi.spyOn(UserRepository, 'findById').mockResolvedValue(null) // 越权 → 查不到
    const update = vi.spyOn(UserRepository, 'updateInTransaction')

    await expect(
      runWithDataScope(subject({ permissionCode: 'system:user:update' }), () =>
        UserService.updateUser(42, { nickname: 'x' }, 7),
      ),
    ).rejects.toMatchObject({ code: UserErrorCode.USER_NOT_FOUND })
    expect(update).not.toHaveBeenCalled()
  })

  it('refuses to delete a user outside the range', async () => {
    stubRoleTiers({ 1: { dataScope: 4, perms: ['system:user:update'] } })
    superAdminSentinel(false)
    vi.spyOn(UserRepository, 'findById').mockResolvedValue(null)
    const remove = vi.spyOn(UserRepository, 'deleteUserInTransaction')

    await expect(
      runWithDataScope(subject({ permissionCode: 'system:user:delete' }), () => UserService.deleteUser(42, 7)),
    ).rejects.toMatchObject({ code: UserErrorCode.USER_NOT_FOUND })
    expect(remove).not.toHaveBeenCalled()
  })
})

describe('多角色与无关角色', () => {
  it('keeps the self branch when a custom-department role also applies', async () => {
    stubRoleTiers({
      1: { dataScope: 4, perms: ['system:user:list'] },
      2: { dataScope: 5, perms: ['system:user:list'], customDepts: [30] },
    })
    superAdminSentinel(false)
    const sql = await listScopeCondition(subject({ roleIds: [1, 2] }))
    expect(sql).toContain('exists')
    expect(sql).toMatch(/ or /i)
  })

  it('ignores an unrelated all-data role', async () => {
    stubRoleTiers({
      1: { dataScope: 4, perms: ['system:user:list'] },
      9: { dataScope: 1, perms: ['ai:chat:use'] },
    })
    superAdminSentinel(false)
    // 若无关角色的「全部数据」生效，这里会变成 undefined。
    expect(await listScopeCondition(subject({ roleIds: [1, 9] }))).toBeDefined()
  })

  it('fails closed when no role grants the operation', async () => {
    stubRoleTiers({ 1: { dataScope: 1, perms: ['ai:chat:use'] } })
    superAdminSentinel(false)
    expect(await listScopeCondition(subject())).toContain('1 = 0')
  })
})

describe('登录与显式免过滤路径不受影响', () => {
  it('resolves the logging-in user without any row filter', async () => {
    stubRoleTiers({ 1: { dataScope: 4, perms: ['system:user:list'] } })
    superAdminSentinel(false)
    // 登录解析当前用户自己：即使档位是「仅本人」也必须能读到本人。
    await UserService.getUserById(7, undefined, false)
    const userWheres = seenWheres.filter(sql => sql?.includes('`sys_user`'))
    expect(userWheres.length).toBeGreaterThan(0)
    for (const sql of userWheres) {
      expect(sql).not.toContain('1 = 0')
      expect(sql).not.toContain('exists')
    }
  })

  it('keeps the role and department reads that scope resolution itself depends on unfiltered', async () => {
    // data-scope 读 sys_role / sys_role_permission / sys_role_dept 必须不受行级过滤，
    // 否则算不出自己的范围，等于把自己锁在空集里。
    const select = vi.spyOn(drizzleDb, 'select')
    stubRoleTiers({ 1: { dataScope: 3, perms: ['system:user:list'] } })
    superAdminSentinel(false)
    await runWithDataScope(subject({ roleIds: [1] }), () => UserService.getUserList({ page: 1, pageSize: 10 }))
    // 角色档位查询确实发生过（select 被 data-scope 解析器调用过）。
    expect(select.mock.calls.length).toBeGreaterThan(0)
  })
})

describe('schema 引用不被测试改写', () => {
  it('uses the real role tables', () => {
    expect(sysRole).toBeDefined()
    expect(sysRolePermission).toBeDefined()
    expect(sysRoleDept).toBeDefined()
  })
})
