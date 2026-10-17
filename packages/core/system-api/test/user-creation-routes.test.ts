/**
 * 用户创建的只读元数据端点（Task 3）。
 *
 * 这两个端点是「原生表单」与「AI 助手」共同的字段/候选来源，因此用例守的是**边界**：
 *
 *   1. 两个端点都必须过认证 + `system:user:create`（PAT 收窄在内）；
 *   2. 部门树是**过滤后**的树，且结构沿用原有部门树，不另造树模型；
 *   3. 角色候选按候选 deptIds 用 Task 2 的策略重算，deptIds 变化结果必须变；
 *   4. 字段元数据来自真实 schema：`password` 只能出现在 `missingFields` 里要求表单完成，
 *      客户端伪造的「可编辑字段」声明必须被拒。
 *
 * 路由测试只打桩 service 与 repository；授权规则本身由 user-creation-policy.test.ts 覆盖。
 */
import Fastify from 'fastify'
import adminUsersPlugin from '../src/core/routes/api/v1/admin/users/index.ts'
import registerUserSchemas from '../src/core/schemas/user.ts'
import registerCommonSchemas from '../src/core/schemas/common.ts'
import { errorHandlerPlugin } from '@yishan/core-api/plugins'
import { makeRequirePermissionHandler } from '../src/core/plugins/external/rbac'
import { AuthErrorCode } from '@yishan/core-api/business-codes/auth'
import { describe, it, expect, vi, beforeEach, afterEach } from './runtime-fixture'
import { setTestPermissionDeclarations } from './runtime-fixture'
import { MySqlDialect } from 'drizzle-orm/mysql-core'
import {
  DATA_SCOPE_ALL,
  DATA_SCOPE_CUSTOM,
  DATA_SCOPE_DEPT_AND_CHILD,
  DATA_SCOPE_DEPT,
  DATA_SCOPE_SELF,
} from '../src/core/auth/data-scope'
import { PermissionRepository } from '../src/core/repositories/permission.repository'
import { PermissionService } from '../src/core/services/permission.service'
import { UserRepository } from '../src/core/repositories/user.repository'
import { DeptRepository } from '../src/core/repositories/dept.repository'
import { RoleRepository } from '../src/core/repositories/role.repository'
import { DeptService } from '../src/core/services/dept.service'
import { UserCreationFormService } from '../src/core/services/user-creation-form.service'
import { USER_CREATE_DRAFT_FIELD_KEYS } from '../src/core/schemas/user'
import { sysDept, sysRole, sysRoleDept, sysRolePermission } from '../src/db/schema'
import { dbManager, drizzleDb } from '../src/db/index.js'

setTestPermissionDeclarations([
  { code: 'system:user:create', label: '用户管理-创建', group: 'system' },
  { code: 'system:user:list', label: '用户管理-列表', group: 'system' },
  { code: 'system:role:list', label: '角色管理-列表', group: 'system' },
])

const BASE = '/api/v1/admin/users'
const CREATE_PERMS = ['system:user:create']

const dialect = new MySqlDialect({ casing: {} as never })

interface FakeRole {
  id: number
  name?: string
  dataScope: number
  code?: string | null
  perms?: string[]
}

/** 从 where 条件里取出 `in (...)` 的那一组 ID（与 Task 2 测试同源）。 */
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
    select: () => ({
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
}

/**
 * 装好操作者侧的服务端重载结果。
 *
 * 同时把默认的 `drizzleDb.select` 换成假 db：HTTP 路由不会注入 db（生产走
 * drizzleDb），因此要在路由层验证范围过滤，就必须让**默认**句柄返回同一批数据。
 */
function mockActor(fixture: ActorFixture = {}, dbOptions: Parameters<typeof fakeDb>[0] = {}): void {
  vi.spyOn(PermissionRepository, 'loadActiveRoleIdsByUserId').mockResolvedValue(fixture.roleIds ?? [])
  vi.spyOn(UserRepository, 'loadActiveDeptIdsByUserId').mockResolvedValue(fixture.deptIds ?? [])
  vi.spyOn(PermissionService, 'loadForRoleIds').mockResolvedValue({
    perms: new Set(fixture.perms ?? []),
    roleCodes: new Set<string>(),
  })
  const db = fakeDb(dbOptions)
  ;(drizzleDb as unknown as { select: unknown }).select = (db as { select: unknown }).select
}

function mockDepts(existing: number[]): void {
  vi.spyOn(DeptRepository, 'findEnabledIdsByIds').mockImplementation(async (ids: number[]) =>
    ids.filter((id) => existing.includes(id)),
  )
}

/** 部门树（沿用现有部门树节点的形状）。 */
function deptNode(id: number, name: string, parentId: number | null, children: any[] | null = null) {
  return { id, name, parentId, children }
}

const FULL_TREE = [
  deptNode(10, '总部', null, [deptNode(11, '研发部', 10), deptNode(12, '市场部', 10)]),
  deptNode(20, '分公司', null, [deptNode(21, '分公司研发', 20)]),
]

function mockDeptTree(): void {
  vi.spyOn(DeptService, 'getDeptTree').mockResolvedValue(FULL_TREE as never)
}

function mockRoleRows(rows: Array<{ id: number; name: string; status?: number }>): void {
  vi.spyOn(RoleRepository, 'list').mockImplementation(async (query: any) => {
    const keyword = query?.keyword as string | undefined
    const status = query?.status as number | undefined
    const filtered = rows.filter(
      (r) =>
        (status === undefined || (r.status ?? 1) === status) &&
        (!keyword || r.name.includes(keyword)),
    )
    // pageSize 0/未给 = 全量，供服务端按策略过滤后再分页。
    const pageSize = (query?.pageSize as number | undefined) ?? 0
    const page = (query?.page as number | undefined) ?? 1
    if (!pageSize) return filtered as never
    return filtered.slice((page - 1) * pageSize, page * pageSize) as never
  })
}

async function buildApp(options: {
  currentUserId?: number
  tokenScope?: string[]
  roleIds?: number[]
} = {}) {
  const app = Fastify({ logger: false })
  // 用**真实**的 RBAC 判定，否则「PAT 收窄」「超管」这些用例只会验证一个 no-op。
  app.decorate('requirePermission', makeRequirePermissionHandler(app))
  app.decorate('requireRole', () => async () => undefined)
  app.decorate('authenticate', async (request: any) => {
    const auth = request.headers.authorization
    if (!auth || !auth.startsWith('Bearer ')) {
      const error = new Error('Unauthorized') as any
      error.statusCode = 401
      throw error
    }
    request.currentUser = { id: options.currentUserId ?? 7, roleIds: options.roleIds ?? [1] }
    if (options.tokenScope !== undefined) request.tokenScope = options.tokenScope
  })
  app.addHook('preHandler', async (request) => {
    if (request.url.startsWith('/api/v1/admin/')) return (app as any).authenticate(request)
  })
  await app.register(errorHandlerPlugin)
  registerCommonSchemas(app)
  registerUserSchemas(app)
  await app.register(adminUsersPlugin, { prefix: BASE })
  await app.ready()
  return app
}

beforeEach(() => {
  vi.restoreAllMocks()
  vi.spyOn(dbManager, 'getConnectionStatus').mockReturnValue({
    connected: true,
    stats: { queryCount: 0, uptime: 0 },
  })
})

afterEach(() => vi.restoreAllMocks())

const AUTH = { Authorization: 'Bearer access-token' }

describe('GET create-form / create-options — 认证与权限', () => {
  it('未认证返回 401（两个端点都是）', async () => {
    const app = await buildApp()
    for (const path of ['/create-form', '/create-options']) {
      const res = await app.inject({ method: 'GET', url: `${BASE}${path}` })
      expect(res.statusCode).toBe(401)
      expect(res.json().success).toBe(false)
    }
    await app.close()
  })

  it('没有 system:user:create 权限的角色被拒（403）', async () => {
    mockActor({ roleIds: [1], perms: ['system:user:list'] })
    const app = await buildApp()
    for (const path of ['/create-form', '/create-options']) {
      const res = await app.inject({ method: 'GET', url: `${BASE}${path}`, headers: AUTH })
      expect(res.statusCode).toBe(403)
      expect(res.json().success).toBe(false)
      expect(res.json().code).toBe(AuthErrorCode.FORBIDDEN)
    }
    await app.close()
  })

  it('PAT 收窄掉 system:user:create 后不再放行', async () => {
    mockActor({ roleIds: [1], perms: [...CREATE_PERMS, 'system:user:list'] })
    const app = await buildApp({ tokenScope: ['system:user:list'] })
    const res = await app.inject({ method: 'GET', url: `${BASE}/create-form`, headers: AUTH })
    expect(res.json().success).toBe(false)
    expect(res.json().code).toBe(AuthErrorCode.FORBIDDEN)
    await app.close()
  })

  it('PAT 覆盖 system:user:create 时正常放行', async () => {
    mockActor({ roleIds: [1], perms: CREATE_PERMS })
    mockDepts([])
    const app = await buildApp({ tokenScope: ['system:user:create'] })
    const res = await app.inject({ method: 'GET', url: `${BASE}/create-form`, headers: AUTH })
    expect(res.statusCode).toBe(200)
    expect(res.json().success).toBe(true)
    await app.close()
  })

  it('超管放行', async () => {
    mockActor({ roleIds: [1], perms: ['__super_admin__'] })
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: `${BASE}/create-form`, headers: AUTH })
    expect(res.statusCode).toBe(200)
    expect(res.json().success).toBe(true)
    await app.close()
  })

  it('固定路径不会被 /:id 吞掉', async () => {
    mockActor({ roleIds: [1], perms: CREATE_PERMS })
    mockDepts([])
    mockDeptTree()
    mockRoleRows([])
    const app = await buildApp()
    // /:id 的 params 是 Integer；若固定段被吞掉，这里会是 400 而不是 200。
    const res = await app.inject({ method: 'GET', url: `${BASE}/create-form`, headers: AUTH })
    expect(res.statusCode).toBe(200)
    const res2 = await app.inject({ method: 'GET', url: `${BASE}/create-options`, headers: AUTH })
    expect(res2.statusCode).toBe(200)
    await app.close()
  })
})

describe('create-form — 字段元数据来自真实 schema', () => {
  beforeEach(() => {
    mockActor({ roleIds: [1], perms: CREATE_PERMS })
    mockDepts([])
  })

  it('返回 phone 必填、约束与真实 create schema 一致', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: `${BASE}/create-form`, headers: AUTH })
    expect(res.statusCode).toBe(200)
    const data = res.json().data
    expect(data.schemaVersion).toBe(1)
    const phone = data.fields.find((f: any) => f.name === 'phone')
    expect(phone).toMatchObject({ required: true, sensitive: false })
    expect(phone.constraints).toMatchObject({ minLength: 1, maxLength: 20 })
    const gender = data.fields.find((f: any) => f.name === 'gender')
    expect(gender.constraints.enum).toEqual(['0', '1', '2'])
    await app.close()
  })

  it('password 只能是「需要在表单完成」，不进入可编辑字段', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: `${BASE}/create-form`, headers: AUTH })
    const data = res.json().data
    expect(data.editableFields).not.toContain('password')
    expect(data.missingFields.map((f: any) => f.name)).toContain('password')
    expect(data.missingFields.find((f: any) => f.name === 'password')).toMatchObject({
      sensitive: true,
      mustCompleteInForm: true,
    })
    await app.close()
  })

  it('客户端伪造的可编辑字段声明不产生任何效果', async () => {
    const app = await buildApp()
    // 路由 querystring 是 `additionalProperties: false` 的空对象：这些参数既不参与
    // 计算也不会进入响应（Fastify 默认 `removeAdditional` 直接丢弃）。断言的是**结果**
    // 而不是状态码 —— 无论客户端怎么声明，password 都不会变成可对话写入的字段。
    const res = await app.inject({
      method: 'GET',
      url: `${BASE}/create-form?editableFields=password&fields=password&sensitive=password`,
      headers: AUTH,
    })
    expect(res.statusCode).toBe(200)
    const data = res.json().data
    expect(data.editableFields).not.toContain('password')
    expect(data.missingFields.find((f: any) => f.name === 'password')).toMatchObject({
      mustCompleteInForm: true,
    })
    await app.close()
  })

  it('客户端无法用 query 伪造 create-options 的候选身份', async () => {
    mockActor({ roleIds: [1], perms: CREATE_PERMS }, {
      roles: [{ id: 1, dataScope: DATA_SCOPE_ALL, perms: CREATE_PERMS }],
    })
    mockDepts([])
    mockDeptTree()
    mockRoleRows([{ id: 3, name: '普通' }])
    const app = await buildApp()
    // actorId / tokenScope / 权限全部来自服务端；query 里带这些名字不会改变判定。
    const res = await app.inject({
      method: 'GET',
      url: `${BASE}/create-options?actorId=1&tokenScope=*&perms=*&creatable=true`,
      headers: AUTH,
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.roles.map((r: any) => r.id)).toEqual([3])
    await app.close()
  })

  it('不暴露可执行的渲染代码或 schema 之外的字段', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: `${BASE}/create-form`, headers: AUTH })
    const data = res.json().data
    const names = data.fields.map((f: any) => f.name)
    expect(names).toEqual(
      expect.arrayContaining(['username', 'phone', 'email', 'realName', 'deptIds', 'roleIds', 'password']),
    )
    expect(names).not.toContain('render')
    expect(names).not.toContain('component')
    for (const field of data.fields) {
      expect(Object.keys(field).sort()).toEqual(
        ['constraints', 'label', 'name', 'required', 'selector', 'sensitive'].sort(),
      )
    }
    await app.close()
  })

  it('字段集是「表单可写 + password/avatar」，协议标记一律不出现', async () => {
    // 用**白名单相等**而不是逐个 not.toContain：`draftSubmission` 目前还没被加进
    // CreateUserReqSchema（Task 5 才加），逐个断言会在今天空过一遍；等它真的被加进来
    // 而过滤失效时，这条相等断言会立刻失败。
    // `avatar` 留在 fields 里（真实表单可写）但不在 editableFields（助手不代填）。
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: `${BASE}/create-form`, headers: AUTH })
    const data = res.json().data
    expect([...data.fields.map((f: any) => f.name)].sort()).toEqual(
      [...USER_CREATE_DRAFT_FIELD_KEYS, 'password', 'avatar'].sort(),
    )
    expect(data.fields.map((f: any) => f.name)).not.toContain('draftSubmission')
    expect(data.missingFields.map((f: any) => f.name).sort()).toEqual(['avatar', 'password'])
    expect(JSON.stringify(data)).not.toContain('draftSubmission')
    await app.close()
  })

  it('选择器标识指向既有候选端点，而不是自造模型', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: `${BASE}/create-form`, headers: AUTH })
    const data = res.json().data
    expect(data.fields.find((f: any) => f.name === 'deptIds').selector).toBe('deptTree')
    expect(data.fields.find((f: any) => f.name === 'roleIds').selector).toBe('roleOptions')
    await app.close()
  })
})

describe('create-options — 候选按 Task 2 策略过滤', () => {
  it('部门树是过滤后的原树（受限范围只留下授权分支）', async () => {
    // 「本部门及子部门」：操作者在 10，范围 = [10,11]；候选部门给 11（合法），
    // 因此树被裁剪到 11 这一支，20/21 这条越权分支整支消失。
    mockActor({ roleIds: [1], perms: CREATE_PERMS, deptIds: [10] }, {
      roles: [{ id: 1, dataScope: DATA_SCOPE_DEPT_AND_CHILD, perms: CREATE_PERMS }],
      depts: [
        { id: 10, parentId: null },
        { id: 11, parentId: 10 },
        { id: 20, parentId: null },
        { id: 21, parentId: 20 },
      ],
    })
    mockDepts([11])
    mockDeptTree()
    mockRoleRows([])

    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: `${BASE}/create-options?deptIds=11`,
      headers: AUTH,
    })
    expect(res.statusCode).toBe(200)
    const data = res.json().data
    const ids: number[] = []
    const walk = (nodes: any[]) => {
      for (const n of nodes) {
        ids.push(n.id)
        if (n.children) walk(n.children)
      }
    }
    walk(data.departments)
    expect(ids).toEqual([10, 11])
    expect(ids).not.toContain(20)
    expect(ids).not.toContain(21)
    // 形状仍是原有部门树节点（id/name/parentId/children），只是被裁剪到授权分支；
    // 祖先（10）保留是为了维持原有树的嵌套形状 —— 与部门管理页看到的一致。
    expect(data.departments[0].id).toBe(10)
    expect(data.departments[0].children.map((c: any) => c.id)).toEqual([11])
    await app.close()
  })

  it('受限范围且未传 deptIds 时，仍能发现自己的合法部门（发现路径）', async () => {
    // 这条守的是「候选列表不是让客户端自己声明合法性」：操作者只持有 system:user:create
    // 与本部门范围，一个 deptIds 都没传。若实现是拿调用方的 deptIds 当过滤条件，
    // 这里会得到 creatable:false + 空树 —— 用户永远无从知道该选哪个部门，
    // 尽管带上 10 提交是完全合法的。
    mockActor({ roleIds: [1], perms: CREATE_PERMS, deptIds: [10] }, {
      roles: [{ id: 1, dataScope: DATA_SCOPE_DEPT, perms: CREATE_PERMS }],
      depts: [{ id: 10, parentId: null }, { id: 20, parentId: null }],
    })
    mockDepts([])
    mockDeptTree()
    mockRoleRows([])

    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: `${BASE}/create-options`, headers: AUTH })
    expect(res.statusCode).toBe(200)
    const data = res.json().data
    expect(data.creatable).toBe(true)
    // 自己范围内的 10 可见；范围外的 20 不可见 —— 不是因为「没传所以不给」，而是范围本身。
    expect(data.departments.map((d: any) => d.id)).toEqual([10])
    await app.close()
  })

  it('data_scope=2 的部门管理员在全新表单上拿得到可授予角色（先选部门即可）', async () => {
    // 这条守的是**角色**发现路径，和上面那条部门发现路径成对。
    // 缺陷现场：候选角色逐个走 validateUserCreation，而调用方（原生表单第一屏、
    // 模型第一轮）都会传空 deptIds。受限范围下「必须选一个归属部门」于是让每一次
    // 探测都失败，候选恒为空 —— 而能力描述把「空候选」告诉模型说成「你没有建号权限」。
    // 一个只差先选部门的操作者因此被告知自己无权建号，角色下拉还是空的。
    mockActor({ roleIds: [1], perms: [...CREATE_PERMS, 'system:role:list'], deptIds: [10] }, {
      roles: [
        { id: 1, dataScope: DATA_SCOPE_DEPT, perms: [...CREATE_PERMS, 'system:role:list'] },
        { id: 3, dataScope: DATA_SCOPE_DEPT, perms: ['system:role:list'] },
        // 越权角色：含操作者没有的权限码，与部门无关，任何时候都不该出现。
        { id: 5, dataScope: DATA_SCOPE_ALL, perms: ['system:audit:export'] },
      ],
      depts: [{ id: 10, parentId: null }, { id: 20, parentId: null }],
    })
    mockDepts([10, 20])
    mockDeptTree()
    mockRoleRows([{ id: 3, name: '专员' }, { id: 5, name: '越权角色' }])

    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: `${BASE}/create-options`, headers: AUTH })
    expect(res.statusCode).toBe(200)
    const data = res.json().data
    expect(data.creatable).toBe(true)
    expect(data.departments.map((d: any) => d.id)).toEqual([10])
    // 没有传 deptIds 也必须看得到可授予的角色。
    expect(data.roles.map((r: any) => r.id)).toEqual([3])
    expect(data.roles.map((r: any) => r.id)).not.toContain(5)
    // 补上部门之后仍然一致：候选不是「空部门时的特例」。
    const after = await app.inject({ method: 'GET', url: `${BASE}/create-options?deptIds=10`, headers: AUTH })
    expect(after.json().data.roles.map((r: any) => r.id)).toEqual([3])
    await app.close()
  })

  it('受限范围传入越权 deptIds 时不会因此放宽部门树', async () => {
    // 传了 deptIds 也不能扩大可见范围：20 不在操作者范围内，就不能出现在候选里。
    mockActor({ roleIds: [1], perms: CREATE_PERMS, deptIds: [10] }, {
      roles: [{ id: 1, dataScope: DATA_SCOPE_DEPT, perms: CREATE_PERMS }],
      depts: [{ id: 10, parentId: null }, { id: 20, parentId: null }],
    })
    mockDepts([10, 20])
    mockDeptTree()
    mockRoleRows([])

    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: `${BASE}/create-options?deptIds=20`,
      headers: AUTH,
    })
    expect(res.statusCode).toBe(200)
    const data = res.json().data
    expect(data.departments.map((d: any) => d.id)).toEqual([])
    await app.close()
  })

  it('点名了部门但全部无效/停用时，部门与角色用的是同一份授权集合', async () => {
    // 缺陷现场：调用方点了名（模型编的 999，或一份存着已停用部门的旧草稿），
    // 但没有任何一个 id 真实存在/启用。探测集合因此退化成 []，受限操作者拿不到
    // 任何角色；与此同时 allowedDeptIds 又因为「没点名剩下的」而回退到整棵授权树。
    // 结果是「部门有、角色空」——同一个响应自相矛盾，且能力描述会把它读成无权建号。
    // 语义上「有效点名集合为空」就是「没点名」，两侧必须共用同一份授权集合。
    mockActor({ roleIds: [1], perms: [...CREATE_PERMS, 'system:role:list'], deptIds: [10] }, {
      roles: [
        { id: 1, dataScope: DATA_SCOPE_DEPT, perms: [...CREATE_PERMS, 'system:role:list'] },
        { id: 3, dataScope: DATA_SCOPE_DEPT, perms: ['system:role:list'] },
      ],
      depts: [{ id: 10, parentId: null }, { id: 20, parentId: null }],
    })
    // 999 既不存在也不启用 → 有效点名集合为空。
    mockDepts([10, 20])
    mockDeptTree()
    mockRoleRows([{ id: 3, name: '专员' }])

    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: `${BASE}/create-options?deptIds=999`,
      headers: AUTH,
    })
    expect(res.statusCode).toBe(200)
    const data = res.json().data
    // 部门仍是授权范围内的 10（不放宽到范围外的 20）。
    expect(data.departments.map((d: any) => d.id)).toEqual([10])
    // 角色与「完全没传 deptIds」时一致，而不是自相矛盾地空掉。
    expect(data.roles.map((r: any) => r.id)).toEqual([3])
    const withoutDeptIds = await app.inject({ method: 'GET', url: `${BASE}/create-options`, headers: AUTH })
    expect(res.json().data.roles.map((r: any) => r.id)).toEqual(
      withoutDeptIds.json().data.roles.map((r: any) => r.id),
    )
    await app.close()
  })

  it('全范围操作者拿到整棵树', async () => {
    mockActor({ roleIds: [1], perms: CREATE_PERMS }, {
      roles: [{ id: 1, dataScope: DATA_SCOPE_ALL, perms: CREATE_PERMS }],
    })
    mockDepts([])
    mockDeptTree()
    mockRoleRows([])

    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: `${BASE}/create-options`, headers: AUTH })
    const data = res.json().data
    expect(data.departments.map((d: any) => d.id)).toEqual([10, 20])
    await app.close()
  })

  it('仅本人范围看不到任何候选部门，也不返回角色', async () => {
    mockActor({ roleIds: [1], perms: CREATE_PERMS, deptIds: [10] }, {
      roles: [{ id: 1, dataScope: DATA_SCOPE_SELF, perms: CREATE_PERMS }],
      depts: [{ id: 10, parentId: null }],
    })
    mockDepts([10])
    mockDeptTree()
    mockRoleRows([{ id: 3, name: '普通角色' }])

    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: `${BASE}/create-options?deptIds=10`,
      headers: AUTH,
    })
    const data = res.json().data
    expect(data.departments).toEqual([])
    expect(data.roles).toEqual([])
    expect(data.creatable).toBe(false)
    await app.close()
  })

  it('角色重名时按 id 区分，不合并', async () => {
    mockActor({ roleIds: [1], perms: [...CREATE_PERMS, 'system:role:list'] }, {
      roles: [
        { id: 1, dataScope: DATA_SCOPE_ALL, perms: [...CREATE_PERMS, 'system:role:list'] },
        { id: 3, dataScope: DATA_SCOPE_ALL, perms: ['system:role:list'] },
        { id: 4, dataScope: DATA_SCOPE_ALL, perms: ['system:role:list'] },
        { id: 5, dataScope: DATA_SCOPE_ALL, perms: ['system:audit:export'] },
      ],
    })
    mockDepts([])
    mockDeptTree()
    mockRoleRows([
      { id: 3, name: '运营' },
      { id: 4, name: '运营' },
      { id: 5, name: '越权角色' },
    ])

    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: `${BASE}/create-options`, headers: AUTH })
    const data = res.json().data
    const duplicated = data.roles.filter((r: any) => r.name === '运营')
    expect(duplicated.map((r: any) => r.id).sort()).toEqual([3, 4])
    expect(data.roles.map((r: any) => r.id)).not.toContain(5)
    await app.close()
  })

  it('deptIds 变化会重算角色（组合授予的范围超出后角色消失）', async () => {
    // 角色 3 是「本部门及子部门」：deptIds=[10] 时目标范围 [10] 被操作者 [10] 包含；
    // 加上 20 之后目标范围变成 [10,20]，超出操作者 → 策略拒绝，候选消失。
    mockActor({ roleIds: [1], perms: [...CREATE_PERMS, 'system:role:list'], deptIds: [10] }, {
      roles: [
        { id: 1, dataScope: DATA_SCOPE_DEPT, perms: [...CREATE_PERMS, 'system:role:list'] },
        { id: 3, dataScope: DATA_SCOPE_DEPT_AND_CHILD, perms: ['system:role:list'] },
      ],
      depts: [{ id: 10, parentId: null }, { id: 20, parentId: null }],
    })
    mockDepts([10, 20])
    mockDeptTree()
    mockRoleRows([{ id: 3, name: '跨部门角色' }])

    const app = await buildApp()
    const before = await app.inject({
      method: 'GET',
      url: `${BASE}/create-options?deptIds=10`,
      headers: AUTH,
    })
    expect(before.json().data.roles.map((r: any) => r.id)).toEqual([3])

    const after = await app.inject({
      method: 'GET',
      url: `${BASE}/create-options?deptIds=10&deptIds=20`,
      headers: AUTH,
    })
    expect(after.json().data.roles).toEqual([])
    await app.close()
  })

  it('超管拿到全部候选角色与完整部门树', async () => {
    mockActor({ roleIds: [1], perms: ['__super_admin__'] }, {
      roles: [{ id: 3, dataScope: DATA_SCOPE_SELF, code: 'super_admin', perms: [] }],
    })
    mockDepts([])
    mockDeptTree()
    mockRoleRows([{ id: 3, name: '超级管理员' }, { id: 4, name: '普通' }])

    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: `${BASE}/create-options`, headers: AUTH })
    const data = res.json().data
    expect(data.roles.map((r: any) => r.id)).toEqual([3, 4])
    expect(data.departments.map((d: any) => d.id)).toEqual([10, 20])
    await app.close()
  })

  it('候选分页发生在过滤之后', async () => {
    mockActor({ roleIds: [1], perms: [...CREATE_PERMS, 'system:role:list'] }, {
      roles: [
        { id: 1, dataScope: DATA_SCOPE_ALL, perms: [...CREATE_PERMS, 'system:role:list'] },
        { id: 3, dataScope: DATA_SCOPE_ALL, perms: ['system:audit:export'] },
        { id: 4, dataScope: DATA_SCOPE_ALL, perms: ['system:role:list'] },
      ],
    })
    mockDepts([])
    mockDeptTree()
    mockRoleRows([
      { id: 3, name: '不可授予' },
      { id: 4, name: '可授予' },
    ])

    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: `${BASE}/create-options?page=1&pageSize=1`,
      headers: AUTH,
    })
    const data = res.json().data
    expect(data.roles).toEqual([{ id: 4, name: '可授予' }])
    expect(data.total).toBe(1)
    expect(data.page).toBe(1)
    expect(data.pageSize).toBe(1)
    await app.close()
  })

  it('服务函数可在无 HTTP 的情况下直接调用（模型能力复用同一入口）', async () => {
    mockActor({ roleIds: [1], perms: CREATE_PERMS }, {
      roles: [{ id: 1, dataScope: DATA_SCOPE_ALL, perms: CREATE_PERMS }],
    })
    mockDepts([])
    mockDeptTree()
    mockRoleRows([{ id: 3, name: '普通' }])
    const db = fakeDb({ roles: [{ id: 1, dataScope: DATA_SCOPE_ALL, perms: CREATE_PERMS }] })

    const form = UserCreationFormService.getCreateForm()
    expect(form.editableFields).not.toContain('password')

    const options = await UserCreationFormService.listCandidates(
      { actorId: 7 },
      { deptIds: [], page: 1, pageSize: 10 },
      { db },
    )
    expect(options.roles.map((r) => r.id)).toEqual([3])
  })
})
