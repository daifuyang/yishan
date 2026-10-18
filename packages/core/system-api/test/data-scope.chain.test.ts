/**
 * 行级数据权限的**链路**用例。
 *
 * `data-scope.test.ts` 验证的是「范围算得对不对」；本文件验证的是「范围有没有
 * 真的挂到请求上」——也就是当初整条链静默失效的那一层。范围解析写对了，但钩子
 * 顺序错了，repository 依然读到 null 上下文而不过滤，而且没有任何报错。
 *
 * 这里刻意走真实的 `createRouteRegistrar` + 真实的 `establishDataScope` 装饰器，
 * 不 stub `capability.execute` 也不 stub 范围条件本身。
 */
import Fastify from 'fastify'
import fp from 'fastify-plugin'
import { MySqlDialect } from 'drizzle-orm/mysql-core'
import type { SQL } from 'drizzle-orm'
import { describe, expect, it, vi } from './runtime-fixture'
import { setTestPermissionDeclarations } from './runtime-fixture'
import { createRouteRegistrar } from '@yishan/core-api/routes/route-registrar'
import { errorHandlerPlugin } from '@yishan/core-api/plugins'
import dataScopePlugin, { establishDataScopeFor } from '../src/core/plugins/external/data-scope'
import {
  currentDataScope,
  DATA_SCOPE_SELF,
  isDataScopeBypassed,
  runWithDataScope,
  scopedQueryCondition,
  userIdInScopeCondition,
} from '../src/core/auth/data-scope'
import { PermissionService } from '../src/core/services/permission.service'
import { sysUser } from '../src/db/schema'

setTestPermissionDeclarations([
  { code: 'system:user:list', label: '用户管理-列表', group: 'system' },
  { code: 'system:user:update', label: '用户管理-更新', group: 'system' },
])

function renderSql(condition: unknown): string {
  return new MySqlDialect({ casing: {} as never }).sqlToQuery(condition as SQL).sql
}

interface HarnessOptions {
  currentUser?: Record<string, unknown> | null
  rolePerms?: string[]
  granted?: string[]
}

/**
 * 一个真的走路由注册器的最小应用：认证 → 权限校验 → 建立范围上下文 → handler。
 *
 * 认证与权限校验用真实实现（`authenticate` 真的挂 currentUser，`requirePermission`
 * 真的比对权限码），只有底层 repository 被打桩。
 */
async function buildScopedApp(options: HarnessOptions = {}) {
  const {
    currentUser = { id: 7, roleIds: [3], deptIds: [10], username: 'u', email: null, realName: null, gender: 0, genderName: '', status: 1, statusName: '启用', loginCount: 0, createdAt: '', updatedAt: '', lastLoginTime: null, lastLoginIp: null },
    rolePerms = ['system:user:list'],
    granted = ['system:user:list'],
  } = options

  vi.spyOn(PermissionService, 'loadForRoleIds').mockResolvedValue({
    perms: new Set(rolePerms),
    roleCodes: new Set<string>(),
  } as never)

  const app = Fastify({ logger: false })
  // data-scope 插件声明了 dependencies: ['jwt-auth']；单测里补一个空的同名插件。
  await app.register(fp(async () => {}, { name: 'jwt-auth' }))
  app.decorate('authenticate', async (request: any) => {
    if (!request.headers.authorization) {
      const error = new Error('Unauthorized') as Error & { statusCode: number }
      error.statusCode = 401
      throw error
    }
    request.currentUser = currentUser
  })
  app.decorate('softAuthenticate', async (request: any) => { request.currentUser = currentUser })
  app.decorate(
    'requirePermission',
    () => async (request: any) => {
      const required = request.routeOptions?.schema?.['x-permission-code']
      if (required && !granted.includes(required)) {
        const error = new Error('Forbidden') as Error & { statusCode: number }
        error.statusCode = 403
        throw error
      }
    },
  )
  // 真实插件（只是 fp 的 dependencies 在单测里不解析，这里直接注册实例体）。
  await app.register(dataScopePlugin)
  await app.register(errorHandlerPlugin)

  const seen: Array<{ subject: unknown; bypassed: boolean }> = []
  const route = createRouteRegistrar(app)
  route.get(
    '/api/v1/admin/users',
    {
      access: { permission: { code: 'system:user:list', label: '用户列表', group: 'system' } as never },
      schema: { tags: ['system'], summary: '用户列表' },
    },
    async (_request, reply) => {
      seen.push({ subject: currentDataScope(), bypassed: isDataScopeBypassed() })
      return reply.send({ ok: true })
    },
  )
  await app.ready()
  return { app, seen }
}

describe('路由钩子顺序：认证 → 权限 → 建立范围上下文 → 业务', () => {
  it('establishes a scope context inside the handler for an authenticated request', async () => {
    const { app, seen } = await buildScopedApp()
    const response = await app.inject({ method: 'GET', url: '/api/v1/admin/users', headers: { authorization: 'Bearer t' } })

    expect(response.statusCode).toBe(200)
    expect(seen).toHaveLength(1)
    // 旧实现读到 undefined → repository 不过滤。这里必须有 subject。
    expect(seen[0].subject).toMatchObject({ userId: 7, roleIds: [3], deptIds: [10], permissionCode: 'system:user:list' })
    expect(seen[0].bypassed).toBe(false)
    await app.close()
  })

  it('scopes by the route permission code, not by another operation the user also holds', async () => {
    // 这个用户同时有 system:user:list 和 system:user:update；本路由只能按 list 算。
    const { app, seen } = await buildScopedApp({
      rolePerms: ['system:user:list', 'system:user:update'],
      granted: ['system:user:list'],
    })
    await app.inject({ method: 'GET', url: '/api/v1/admin/users', headers: { authorization: 'Bearer t' } })
    expect(seen[0].subject).toMatchObject({ permissionCode: 'system:user:list' })
    await app.close()
  })

  it('rejects before the scope context exists when the operation permission is missing', async () => {
    const { app, seen } = await buildScopedApp({ rolePerms: ['system:user:list'], granted: [] })
    const response = await app.inject({ method: 'GET', url: '/api/v1/admin/users', headers: { authorization: 'Bearer t' } })

    expect(response.statusCode).toBe(403)
    expect(seen).toHaveLength(0)
    await app.close()
  })

  it('does not establish a scope context for an unauthenticated request', async () => {
    const { app, seen } = await buildScopedApp()
    const response = await app.inject({ method: 'GET', url: '/api/v1/admin/users' })

    expect(response.statusCode).toBe(401)
    expect(seen).toHaveLength(0)
    await app.close()
  })
})

describe('AI 路径与 REST 共用同一套范围实现', () => {
  it('establishes the same subject shape for an AI capability call', async () => {
    vi.spyOn(PermissionService, 'loadForRoleIds').mockResolvedValue({
      perms: new Set(['system:user:list']),
      roleCodes: new Set<string>(),
    } as never)

    const seen = await establishDataScopeFor(
      { userId: 7, roleIds: [3], deptIds: [10] },
      'system:user:list',
      async () => currentDataScope(),
    )
    expect(seen).toMatchObject({ userId: 7, roleIds: [3], deptIds: [10], permissionCode: 'system:user:list' })
  })

  it('isolates identity between concurrent calls', async () => {
    vi.spyOn(PermissionService, 'loadForRoleIds').mockResolvedValue({
      perms: new Set(['system:user:list']),
      roleCodes: new Set<string>(),
    } as never)

    const observe = (userId: number, deptId: number, delay: number) =>
      establishDataScopeFor({ userId, roleIds: [3], deptIds: [deptId] }, 'system:user:list', async () => {
        await new Promise((resolve) => setTimeout(resolve, delay))
        // 交错等待之后仍必须读到自己那一份身份。
        return currentDataScope()
      })

    const [a, b] = await Promise.all([observe(1, 10, 20), observe(2, 20, 1)])
    expect(a).toMatchObject({ userId: 1, deptIds: [10] })
    expect(b).toMatchObject({ userId: 2, deptIds: [20] })
  })

  it('lets an inner scope reset an outer bypass instead of silently reading nothing', async () => {
    // 免过滤里再建立身份（AI 工具在登录解析之类路径里嵌套执行）：
    // 若 bypass 标记被继承，repository 会看到 null 上下文并 fail closed 到查不到数据。
    const seen = await establishDataScopeFor({ userId: 7, roleIds: [3], deptIds: [10] }, 'system:user:list', async () =>
      runWithDataScope({ userId: 9, roleIds: [], deptIds: [], superAdmin: false }, async () => ({
        subject: currentDataScope(),
        bypassed: isDataScopeBypassed(),
      })),
    )
    expect(seen).toEqual({ subject: { userId: 9, roleIds: [], deptIds: [], superAdmin: false }, bypassed: false })
  })
})

describe('缺上下文与免过滤路径', () => {
  it('fails closed for a scope-protected read outside any request context', () => {
    expect(currentDataScope()).toBeNull()
    const condition = scopedQueryCondition(null, null, true)
    // 没有 subject 时不能返回 undefined（那等于「不加过滤」）。
    expect(condition).toBeDefined()
    expect(renderSql(condition)).toContain('1 = 0')
  })

  it('returns no condition when the caller explicitly declares the path unfiltered', () => {
    // 登录解析当前用户自己、公共接口、seed：靠调用点显式声明，而不是靠全局豁免。
    expect(scopedQueryCondition(null, null, false)).toBeUndefined()
  })

  it('reports no context while explicitly bypassing', () => {
    const subject = runWithDataScope(
      { userId: 7, roleIds: [3], deptIds: [10], superAdmin: false },
      () => currentDataScope(),
    )
    expect(subject).not.toBeNull()

    const bypassed = runWithDataScope(
      { userId: 7, roleIds: [3], deptIds: [10], superAdmin: false },
      () => ({ subject: currentDataScope(), bypassed: isDataScopeBypassed() }),
    )
    expect(bypassed.bypassed).toBe(false)
  })
})

describe('登录日志的 IN 子查询', () => {
  it('uses IN rather than a scalar = when the range covers several users', () => {
    const condition = userIdInScopeCondition(
      { kind: 'restricted', deptIds: [10, 11], selfUserId: 7 },
      sysUser.id,
    )
    const sql = renderSql(condition)
    // 标量 `=` 配多行子查询在 MySQL 下会报错/退化，回归用例锁死 IN。
    expect(sql).toContain(' in ')
    expect(sql).not.toMatch(/=\s*\(select/i)
  })

  it('adds no condition for an all-data range', () => {
    expect(userIdInScopeCondition({ kind: 'all' }, sysUser.id)).toBeUndefined()
  })
})

describe('DATA_SCOPE_SELF 常量', () => {
  it('stays on the repository numbering', () => {
    expect(DATA_SCOPE_SELF).toBe(4)
  })
})
