/**
 * Source-First Goal B：身份与权限来源可替换。
 *
 * 用一个不碰任何 system 表/仓储的替身 AuthProvider，挂上真实的 jwt-auth、rbac、
 * route-registrar 与错误处理器，证明：
 *   - JWT / PAT 的身份由 provider 决定，jwt-auth 不再依赖 UserService 等具体实现；
 *   - 权限集合由 provider 决定，rbac 只做公开权限 / 活动目录 / PAT scope 交集；
 *   - 公开权限点（public: true）不挂鉴权，OpenAPI security 由 registrar 直接写入。
 */
import Fastify, { type FastifyInstance } from 'fastify'
import fastifyCookie from '@fastify/cookie'
import { afterEach, describe, expect, it, vi } from 'vitest'
import errorHandlerPlugin from '../src/core/plugins/external/error-handler.ts'
import jwtAuthPlugin from '../src/core/plugins/external/jwt-auth.ts'
import rbacPlugin from '../src/core/plugins/external/rbac.ts'
import { createRouteRegistrar, registerPermissions, type PermissionRef } from '../src/core/module-api.ts'
import type { AuthProvider, CurrentUser } from '../src/core/auth/identity.ts'
import { UserService } from '../src/core/services/user.service.ts'
import { UserTokenRepository } from '../src/core/repositories/user-token.repository.ts'
import { ApiTokenRepository } from '../src/core/repositories/api-token.repository.ts'
import { AuthErrorCode } from '../src/constants/business-codes/auth.ts'

const PERMS = {
  READ: { code: 'ctr:item:read', label: '契约-查看', group: 'ctr' },
  WRITE: { code: 'ctr:item:write', label: '契约-编辑', group: 'ctr' },
  PING: { code: 'ctr:ping', label: '契约-公开探针', group: 'ctr', public: true },
} satisfies Record<string, PermissionRef>
registerPermissions(...Object.values(PERMS))

const SSO_USER = { id: 42, roleIds: [9] } as CurrentUser

function stubProvider(overrides: Partial<AuthProvider> = {}): AuthProvider {
  return {
    resolveSession: vi.fn(async ({ token }) => (token === 'revoked' ? null : SSO_USER)),
    resolveApiToken: vi.fn(async ({ token }) =>
      token === 'yishan_pat_known' ? { user: SSO_USER, scopes: [PERMS.WRITE.code] } : null,
    ),
    loadPermissions: vi.fn(async () => new Set([PERMS.READ.code, PERMS.WRITE.code])),
    ...overrides,
  }
}

const routeSchemas = new Map<string, Record<string, unknown>>()

async function buildApp(provider: AuthProvider): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  app.addHook('onRoute', (r) => {
    routeSchemas.set(`${r.method} ${r.url}`, r.schema as Record<string, unknown>)
  })
  await app.register(errorHandlerPlugin)
  await app.register(fastifyCookie)
  app.decorate('authProvider', provider)
  await app.register(jwtAuthPlugin)
  await app.register(rbacPlugin)
  await app.register(async (scope) => {
    const route = createRouteRegistrar(scope)
    route.get('/read', { access: { permission: PERMS.READ }, schema: {} }, async (req) => ({ who: req.currentUser.id }))
    route.get('/write', { access: { permission: PERMS.WRITE }, schema: {} }, async () => ({ ok: true }))
    route.get('/ping', { access: { permission: PERMS.PING }, schema: {} }, async () => ({ pong: true }))
  })
  await app.ready()
  return app
}

const bearer = (token: string) => ({ authorization: `Bearer ${token}` })

afterEach(() => {
  vi.restoreAllMocks()
})

describe('AuthProvider contract (identity source is replaceable)', () => {
  it('JWT identity and permissions come from the provider; system services are never called', async () => {
    const userSpy = vi.spyOn(UserService, 'getUserById')
    const tokenSpy = vi.spyOn(UserTokenRepository, 'findByAccessToken')
    const provider = stubProvider()
    const app = await buildApp(provider)
    const token = app.jwt.sign({ id: 42, type: 'access_token' })

    const res = await app.inject({ method: 'GET', url: '/read', headers: bearer(token) })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ who: 42 })
    expect(provider.resolveSession).toHaveBeenCalledWith(
      expect.objectContaining({ token, kind: 'access_token', claims: expect.objectContaining({ id: 42 }) }),
    )
    expect(provider.loadPermissions).toHaveBeenCalledWith(SSO_USER)
    expect(userSpy).not.toHaveBeenCalled()
    expect(tokenSpy).not.toHaveBeenCalled()
    await app.close()
  })

  it('a session the provider does not recognise → 401 TOKEN_INVALID', async () => {
    const provider = stubProvider({ resolveSession: vi.fn(async () => null) })
    const app = await buildApp(provider)
    const res = await app.inject({
      method: 'GET', url: '/read', headers: bearer(app.jwt.sign({ id: 42, type: 'access_token' })),
    })
    expect(res.statusCode).toBe(401)
    expect(res.json().code).toBe(AuthErrorCode.TOKEN_INVALID)
    await app.close()
  })

  it('permission missing from the provider set → 403 FORBIDDEN', async () => {
    const provider = stubProvider({ loadPermissions: vi.fn(async () => new Set([PERMS.READ.code])) })
    const app = await buildApp(provider)
    const res = await app.inject({
      method: 'GET', url: '/write', headers: bearer(app.jwt.sign({ id: 42, type: 'access_token' })),
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().code).toBe(AuthErrorCode.FORBIDDEN)
    await app.close()
  })

  it('PAT: provider resolves the token, rbac intersects its scopes with the user permissions', async () => {
    const patSpy = vi.spyOn(ApiTokenRepository, 'findByRawToken')
    const app = await buildApp(stubProvider())
    const write = await app.inject({ method: 'GET', url: '/write', headers: bearer('yishan_pat_known') })
    expect(write.statusCode).toBe(200)
    // READ is held by the user but outside the PAT scope.
    const read = await app.inject({ method: 'GET', url: '/read', headers: bearer('yishan_pat_known') })
    expect(read.statusCode).toBe(403)
    const unknown = await app.inject({ method: 'GET', url: '/read', headers: bearer('yishan_pat_unknown') })
    expect(unknown.statusCode).toBe(401)
    expect(unknown.json().code).toBe(AuthErrorCode.API_TOKEN_NOT_FOUND)
    expect(patSpy).not.toHaveBeenCalled()
    await app.close()
  })

  it('a provider without PAT support treats every PAT as not found', async () => {
    const provider = stubProvider()
    delete provider.resolveApiToken
    const app = await buildApp(provider)
    const res = await app.inject({ method: 'GET', url: '/read', headers: bearer('yishan_pat_known') })
    expect(res.json().code).toBe(AuthErrorCode.API_TOKEN_NOT_FOUND)
    await app.close()
  })

  it('public permissions skip authentication; the registrar writes OpenAPI security itself', async () => {
    const provider = stubProvider()
    const app = await buildApp(provider)
    const res = await app.inject({ method: 'GET', url: '/ping' })
    expect(res.statusCode).toBe(200)
    expect(provider.resolveSession).not.toHaveBeenCalled()
    expect(routeSchemas.get('GET /ping')?.security).toEqual([])
    expect(routeSchemas.get('GET /read')?.security).toEqual([{ bearerAuth: [] }])
    expect(routeSchemas.get('GET /read')?.['x-permission-code']).toBe(PERMS.READ.code)
    await app.close()
  })

  it('jwt-auth fails loudly when no provider is wired in the composition root', async () => {
    const app = Fastify({ logger: false })
    await app.register(fastifyCookie)
    await app.register(jwtAuthPlugin)
    app.get('/x', { preHandler: app.authenticate }, async () => ({}))
    await app.ready()
    const res = await app.inject({ method: 'GET', url: '/x', headers: bearer('yishan_pat_any') })
    expect(res.statusCode).toBe(500)
    await app.close()
  })
})
