/**
 * 用户创建的统一授权规则（Task 2）。
 *
 * 这套规则同时服务普通后台的 createUser 与（后续）AI 助手的草稿工具，因此用例覆盖
 * 的是**规则本身**，而不是某个入口的接线。核心断言只有两条：
 *
 *   1. 操作者能授予的权限，不得超过他自己在本次请求里的有效权限（PAT 收窄在内）；
 *   2. 对每个带数据范围的操作，被授予的范围必须真的被操作者的范围包含——
 *      按「该角色组合授予目标用户的范围」计算，而不是比较 dataScope 数字。
 *
 * 另外覆盖部门关联（8.2）与同源字段契约（草稿字段、password 不可写）。
 */
import { afterEach, describe, expect, it, vi } from './runtime-fixture'
import { setTestPermissionDeclarations } from './runtime-fixture'
import { MySqlDialect } from 'drizzle-orm/mysql-core'
import {
  DATA_SCOPE_ALL,
  DATA_SCOPE_CUSTOM,
  DATA_SCOPE_DEPT,
  DATA_SCOPE_DEPT_AND_CHILD,
  DATA_SCOPE_SELF,
} from '../src/core/auth/data-scope'
import { UserErrorCode } from '@yishan/core-api/business-codes/user'
import { PermissionRepository } from '../src/core/repositories/permission.repository'
import { PermissionService } from '../src/core/services/permission.service'
import { UserRepository } from '../src/core/repositories/user.repository'
import { DeptRepository } from '../src/core/repositories/dept.repository'
import { validateUserCreation, type UserCreationSubject } from '../src/core/services/user-creation-policy'
import {
  UserCreateDraftFieldsSchema,
  USER_CREATE_DRAFT_FIELD_KEYS,
} from '../src/core/schemas/user'
import { sysDept, sysRole, sysRoleDept, sysRolePermission } from '../src/db/schema'

setTestPermissionDeclarations([
  { code: 'system:user:create', label: '用户管理-新增', group: 'system' },
  { code: 'system:user:list', label: '用户管理-列表', group: 'system' },
  { code: 'system:role:list', label: '角色管理-列表', group: 'system' },
])

const ACTOR_ID = 7

const dialect = new MySqlDialect({ casing: {} as never })

// spyOn(PermissionRepository…) 是按类打桩的，不还原会串到下一个用例。
afterEach(() => vi.restoreAllMocks())

interface FakeRole {
  id: number
  dataScope: number
  code?: string | null
  perms?: string[]
}

/**
 * 与 data-scope.test 同源的假 db，另外多做一件事：**按 where 里的 ID 参数过滤**。
 *
 * 不做的话，操作者（角色 1）与候选角色（角色 3）会查到同一批角色行，
 * 「操作者范围 vs 目标范围」的比较就退化成自反比较，断言全部失效。
 */
/** 从 where 条件里取出 `in (...)` 的那一组 ID（drizzle 的参数不挂在 chunk 上）。 */
function idsFromWhere(arg: unknown): number[] {
  if (!arg) return []
  const query = dialect.sqlToQuery(arg as never)
  const match = /in \(([^)]*)\)/.exec(query.sql)
  if (!match) return []
  const placeholders = (match[1].match(/\?/g) ?? []).length
  return (query.params as unknown[])
    .slice(0, placeholders)
    .filter((v): v is number => typeof v === 'number')
}

function fakeDb(options: {
  roles?: FakeRole[]
  customDepts?: Record<number, number[]>
  depts?: Array<{ id: number; parentId: number | null }>
} = {}) {
  const roles = options.roles ?? []
  const customDepts = options.customDepts ?? {}
  const depts = options.depts ?? []
  const rowsFor = (table: unknown, ids: number[]) => {
    const keep = (id: number) => ids.length === 0 || ids.includes(id)
    if (table === sysRoleDept) {
      return Object.entries(customDepts).flatMap(([roleId, deptIds]) =>
        deptIds.map((deptId) => ({ roleId: Number(roleId), deptId })),
      ).filter((row) => keep(row.roleId))
    }
    if (table === sysRolePermission) {
      return roles.flatMap((role) =>
        (role.perms ?? []).map((perm) => ({ roleId: role.id, perm })),
      ).filter((row) => keep(row.roleId))
    }
    if (table === sysRole) {
      return roles
        .filter((role) => keep(role.id))
        .map((role) => ({ id: role.id, dataScope: role.dataScope, code: role.code ?? null }))
    }
    if (table === sysDept) return depts
    return []
  }
  return {
    select: (_cols?: unknown) => ({
      from: (table: unknown) => ({
        innerJoin: () => ({ where: (arg: unknown) => Promise.resolve(rowsFor(table, idsFromWhere(arg))) }),
        where: (arg: unknown) => Promise.resolve(rowsFor(table, idsFromWhere(arg))),
      }),
    }),
  } as never
}

interface ActorFixture {
  roleIds?: number[]
  perms?: string[]
  deptIds?: number[]
  roles?: FakeRole[]
}

/** 装好操作者侧的服务端重新加载结果。角色档位仍由假 db 提供。 */
function mockActor(fixture: ActorFixture = {}): void {
  vi.spyOn(PermissionRepository, 'loadActiveRoleIdsByUserId').mockResolvedValue(fixture.roleIds ?? [])
  vi.spyOn(UserRepository, 'loadActiveDeptIdsByUserId').mockResolvedValue(fixture.deptIds ?? [])
  vi.spyOn(PermissionService, 'loadForRoleIds').mockResolvedValue({
    perms: new Set(fixture.perms ?? []),
    roleCodes: new Set<string>(),
  })
}

/** 候选部门「真实存在且启用」这一条由 repository 判定，这里只控制结果。 */
function mockDepts(existing: number[]): void {
  vi.spyOn(DeptRepository, 'findEnabledIdsByIds').mockImplementation(async (ids: number[]) =>
    ids.filter((id) => existing.includes(id)),
  )
}

const baseSubject = (over: Partial<UserCreationSubject> = {}): UserCreationSubject => ({
  actorId: ACTOR_ID,
  ...over,
})

const CREATE_PERMS = ['system:user:create']

describe('validateUserCreation — 角色授权', () => {
  it('grants a role whose permission codes are a subset of the operator effective permissions', async () => {
    mockActor({ roleIds: [1], perms: CREATE_PERMS })
    const db = fakeDb({
      roles: [
        { id: 1, dataScope: DATA_SCOPE_ALL, perms: CREATE_PERMS },
        { id: 3, dataScope: DATA_SCOPE_ALL, perms: CREATE_PERMS },
      ],
    })
    mockDepts([10])

    await expect(validateUserCreation(baseSubject(), { roleIds: [3], deptIds: [10] }, { db })).resolves
      .toBeUndefined()
  })

  it('loads the operator permissions with the cache disabled and on the injected db', async () => {
    // 这条断言守着「授权判定必须看到最新权限」：ttlMs 一旦丢失或变成默认值，
    // 30 秒窗口内刚被回收的权限仍能通过授权（spec §8.3）。
    mockActor({ roleIds: [1, 2], perms: CREATE_PERMS })
    const db = fakeDb({ roles: [{ id: 1, dataScope: DATA_SCOPE_ALL, perms: CREATE_PERMS }] })
    mockDepts([])

    await validateUserCreation(baseSubject(), {}, { db })

    expect(PermissionService.loadForRoleIds).toHaveBeenCalledWith(
      [1, 2],
      expect.objectContaining({ ttlMs: 0, db }),
    )
  })

  it('rejects a role carrying a permission the operator does not hold', async () => {
    mockActor({ perms: CREATE_PERMS })
    const db = fakeDb({
      roles: [{ id: 3, dataScope: DATA_SCOPE_ALL, perms: ['system:user:create', 'system:role:list'] }],
    })
    mockDepts([10])

    await expect(
      validateUserCreation(baseSubject(), { roleIds: [3] }, { db }),
    ).rejects.toMatchObject({ code: UserErrorCode.USER_CREATE_FORBIDDEN })
  })

  it('evaluates the combination of roles, not each role in isolation', async () => {
    // 角色 3 单独看是安全的（本部门），但与角色 4 组合后授予范围扩大到部门 30。
    mockActor({ perms: [...CREATE_PERMS, 'system:role:list'], deptIds: [10] })
    const db = fakeDb({
      roles: [
        { id: 3, dataScope: DATA_SCOPE_DEPT, perms: CREATE_PERMS },
        { id: 4, dataScope: DATA_SCOPE_DEPT, perms: ['system:role:list'] },
      ],
      depts: [{ id: 10, parentId: null }],
    })
    mockDepts([10])

    await expect(
      validateUserCreation(baseSubject(), { roleIds: [3, 4], deptIds: [10] }, { db }),
    ).rejects.toMatchObject({ code: UserErrorCode.USER_CREATE_FORBIDDEN })
  })

  it('lets a super administrator assign any role', async () => {
    mockActor({ perms: ['__super_admin__'] })
    const db = fakeDb({
      roles: [{ id: 3, dataScope: DATA_SCOPE_ALL, code: 'super_admin', perms: [] }],
    })
    mockDepts([])

    await expect(
      validateUserCreation(baseSubject(), { roleIds: [3], deptIds: [99] }, { db }),
    ).resolves.toBeUndefined()
  })

  it('strips the super-admin bypass when the PAT scope does not grant it', async () => {
    mockActor({ perms: ['__super_admin__'] })
    const db = fakeDb({
      roles: [{ id: 3, dataScope: DATA_SCOPE_ALL, code: 'super_admin', perms: [] }],
    })
    mockDepts([10])

    await expect(
      validateUserCreation(
        baseSubject({ tokenScope: ['system:user:create'] }),
        { roleIds: [3], deptIds: [10] },
        { db },
      ),
    ).rejects.toMatchObject({ code: UserErrorCode.USER_CREATE_FORBIDDEN })
  })

  it('rejects an actor whose PAT scope no longer covers the create permission', async () => {
    mockActor({ perms: ['__super_admin__', 'system:user:list'] })
    const db = fakeDb({ roles: [] })
    mockDepts([10])

    await expect(
      validateUserCreation(
        baseSubject({ tokenScope: ['system:user:list'] }),
        { phone: '13800000000', deptIds: [10] },
        { db },
      ),
    ).rejects.toMatchObject({ code: UserErrorCode.USER_CREATE_FORBIDDEN })
  })

  it('ignores a disabled role because it is not loaded at all', async () => {
    mockActor({ roleIds: [1], perms: CREATE_PERMS })
    // 禁用角色不会出现在权限矩阵里（status/deletedAt 由 repository 过滤）。
    const db = fakeDb({
      roles: [
        { id: 1, dataScope: DATA_SCOPE_ALL, perms: CREATE_PERMS },
        { id: 3, dataScope: DATA_SCOPE_ALL, perms: CREATE_PERMS },
      ],
    })
    mockDepts([10])

    await expect(
      validateUserCreation(baseSubject(), { roleIds: [3, 404], deptIds: [10] }, { db }),
    ).resolves.toBeUndefined()
  })

  it('ignores permissions revoked from the candidate role', async () => {
    mockActor({ roleIds: [1], perms: CREATE_PERMS })
    const db = fakeDb({
      roles: [
        { id: 1, dataScope: DATA_SCOPE_ALL, perms: CREATE_PERMS },
        { id: 3, dataScope: DATA_SCOPE_ALL, perms: [] },
      ],
    })
    mockDepts([10])

    await expect(validateUserCreation(baseSubject(), { roleIds: [3], deptIds: [10] }, { db })).resolves
      .toBeUndefined()
  })
})

describe('validateUserCreation — 部门关联', () => {
  const actorRole = (dataScope: number, extra: Partial<FakeRole> = {}): FakeRole[] => [
    { id: 1, dataScope, perms: CREATE_PERMS, ...extra },
  ]

  it('omits the department when the operator has full scope', async () => {
    mockActor({ roleIds: [1], perms: CREATE_PERMS })
    const db = fakeDb({ roles: actorRole(DATA_SCOPE_ALL) })
    mockDepts([])

    await expect(validateUserCreation(baseSubject(), {}, { db })).resolves.toBeUndefined()
  })

  it('rejects omitting the department when the operator scope is restricted', async () => {
    mockActor({ roleIds: [1], perms: CREATE_PERMS, deptIds: [10] })
    const db = fakeDb({ roles: actorRole(DATA_SCOPE_DEPT) })
    mockDepts([])

    await expect(validateUserCreation(baseSubject(), {}, { db })).rejects.toMatchObject({
      code: UserErrorCode.USER_CREATE_FORBIDDEN,
    })
  })

  it('accepts a department-and-child operator choosing a child department', async () => {
    mockActor({ roleIds: [1], perms: CREATE_PERMS, deptIds: [10] })
    const db = fakeDb({
      roles: actorRole(DATA_SCOPE_DEPT_AND_CHILD),
      depts: [
        { id: 10, parentId: null },
        { id: 11, parentId: 10 },
        { id: 20, parentId: null },
      ],
    })
    mockDepts([11])

    await expect(validateUserCreation(baseSubject(), { deptIds: [11] }, { db })).resolves.toBeUndefined()
  })

  it('rejects a multi-department selection containing one department out of scope', async () => {
    mockActor({ roleIds: [1], perms: CREATE_PERMS, deptIds: [10] })
    const db = fakeDb({ roles: actorRole(DATA_SCOPE_DEPT) })
    mockDepts([10, 20])

    await expect(
      validateUserCreation(baseSubject(), { deptIds: [10, 20] }, { db }),
    ).rejects.toMatchObject({ code: UserErrorCode.USER_CREATE_FORBIDDEN })
  })

  it('accepts a custom-scope operator choosing a department from its authorized set', async () => {
    mockActor({ roleIds: [1], perms: CREATE_PERMS, deptIds: [10] })
    const db = fakeDb({ roles: actorRole(DATA_SCOPE_CUSTOM), customDepts: { 1: [10, 11] } })
    mockDepts([11])

    await expect(validateUserCreation(baseSubject(), { deptIds: [11] }, { db })).resolves.toBeUndefined()
  })

  it('forbids creating users at all for a self-only operator', async () => {
    mockActor({ roleIds: [1], perms: CREATE_PERMS, deptIds: [10] })
    const db = fakeDb({ roles: actorRole(DATA_SCOPE_SELF) })
    mockDepts([10])

    await expect(
      validateUserCreation(baseSubject(), { deptIds: [10] }, { db }),
    ).rejects.toMatchObject({ code: UserErrorCode.USER_CREATE_FORBIDDEN })
  })

  it('rejects an unknown or disabled candidate department', async () => {
    mockActor({ roleIds: [1], perms: CREATE_PERMS })
    const db = fakeDb({ roles: actorRole(DATA_SCOPE_ALL) })
    mockDepts([10])

    await expect(
      validateUserCreation(baseSubject(), { deptIds: [10, 999] }, { db }),
    ).rejects.toMatchObject({ code: UserErrorCode.USER_CREATE_FORBIDDEN })
  })
})

describe('validateUserCreation — 目标范围不能因为组合而扩大', () => {
  it('rejects when the candidate role grants the new user a wider scope than the operator has', async () => {
    // 操作者在 system:role:list 上只有本部门；候选角色是自定义 [10, 20]。
    mockActor({ roleIds: [1], perms: [...CREATE_PERMS, 'system:role:list'], deptIds: [10] })
    const db = fakeDb({
      roles: [
        { id: 1, dataScope: DATA_SCOPE_DEPT, perms: CREATE_PERMS },
        { id: 3, dataScope: DATA_SCOPE_CUSTOM, perms: ['system:role:list'] },
      ],
      customDepts: { 3: [10, 20] },
      depts: [{ id: 10, parentId: null }],
    })
    mockDepts([10])

    await expect(
      validateUserCreation(baseSubject(), { roleIds: [3], deptIds: [10] }, { db }),
    ).rejects.toMatchObject({ code: UserErrorCode.USER_CREATE_FORBIDDEN })
  })

  it('treats self-only for the target as "the new user", which the operator cannot grant', async () => {
    // 新用户的 ID 尚未生成，绝不能因此把「仅本人」当成无限制。
    mockActor({ roleIds: [1], perms: [...CREATE_PERMS, 'system:role:list'], deptIds: [10] })
    const db = fakeDb({
      roles: [
        { id: 1, dataScope: DATA_SCOPE_DEPT, perms: CREATE_PERMS },
        { id: 3, dataScope: DATA_SCOPE_SELF, perms: ['system:role:list'] },
      ],
      depts: [{ id: 10, parentId: null }],
    })
    mockDepts([10])

    await expect(
      validateUserCreation(baseSubject(), { roleIds: [3], deptIds: [10] }, { db }),
    ).rejects.toMatchObject({ code: UserErrorCode.USER_CREATE_FORBIDDEN })
  })
})

describe('同源字段契约', () => {
  it('exposes exactly the UserForm writable fields and never password', () => {
    expect([...USER_CREATE_DRAFT_FIELD_KEYS].sort()).toEqual(
      [
        'birthDate',
        'deptIds',
        'email',
        'gender',
        'nickname',
        'phone',
        'realName',
        'roleIds',
        'status',
        'username',
      ].sort(),
    )
    const props = UserCreateDraftFieldsSchema.properties
    expect(props).not.toHaveProperty('password')
    // avatar 今天可写，但不在 UserForm 里，因此不自动开放给助手。
    expect(props).not.toHaveProperty('avatar')
    expect(props).not.toHaveProperty('draftSubmission')
  })

  it('keeps phone required and username/realName optional, matching the create schema', () => {
    expect(UserCreateDraftFieldsSchema.required).toEqual(['phone'])
    for (const key of ['username', 'realName', 'nickname', 'email', 'gender', 'status', 'birthDate']) {
      expect(UserCreateDraftFieldsSchema.properties).toHaveProperty(key)
      expect((UserCreateDraftFieldsSchema.required as string[] | undefined) ?? []).not.toContain(key)
    }
  })

  it('applies the existing phone contract (1-20 chars), not a mainland-only rule', () => {
    const phone = UserCreateDraftFieldsSchema.properties.phone
    expect(phone).toMatchObject({ minLength: 1, maxLength: 20 })
  })
})
