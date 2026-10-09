import Fastify from 'fastify'
import fastifyCookie from '@fastify/cookie'
import { afterEach, describe, expect, it, vi } from 'vitest'
import authPlugin from '../src/core/routes/api/v1/app/auth/index.ts'
import registerAuthSchemas from '../src/core/schemas/auth.ts'
import errorHandlerPlugin from '../src/core/plugins/external/error-handler.ts'
import jwtAuthPlugin from '../src/core/plugins/external/jwt-auth.ts'
import { AuthService } from '../src/core/services/auth.service.ts'
import { PermissionService } from '../src/core/services/permission.service.ts'
import { registerPermissions } from '../src/core/permissions/catalog.ts'
import { makeRequirePermissionHandler } from '../src/core/plugins/external/rbac.ts'

registerPermissions(
  { code: 'crm:mobile-test:read', label: 'CRM test read', group: 'crm-customer' },
  { code: 'shop:mobile-test:list', label: 'Shop test list', group: 'shop' },
)

async function buildApp(options: { authenticated?: boolean; tokenScope?: string[] } = {}) {
  const app = Fastify({ logger: false })
  app.decorate('rateLimit', () => async () => undefined)
  await app.register(errorHandlerPlugin)
  await app.register(fastifyCookie)
  if (options.authenticated) {
    app.decorate('authenticate', async (request) => {
      request.currentUser = {
        id: 7,
        phone: '13800000000',
        gender: '0',
        genderName: '未知',
        status: '1',
        statusName: '启用',
        loginCount: 1,
        creatorId: 1,
        createdAt: new Date().toISOString(),
        updaterId: 1,
        updatedAt: new Date().toISOString(),
        roleIds: [3],
      }
      request.tokenScope = options.tokenScope
    })
    app.decorate('requirePermission', makeRequirePermissionHandler(app))
    app.decorate('moduleLoader', {
      listModuleIds: () => new Set(['crm', 'shop']),
      enabledIdsCached: async () => new Set(['crm', 'unmounted']),
    })
  } else {
    await app.register(jwtAuthPlugin)
  }
  registerAuthSchemas(app)
  await app.register(authPlugin, { prefix: '/api/v1/app/auth' })
  await app.ready()
  return app
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('App auth routes', () => {
  it('allows login without an existing access token', async () => {
    vi.spyOn(AuthService, 'login').mockResolvedValue({
      token: 'access-token',
      refreshToken: 'refresh-token',
      expiresIn: 3600,
      refreshTokenExpiresIn: 7200,
    })
    const app = await buildApp()
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/app/auth/login',
        payload: { username: 'admin', password: 'admin123', rememberMe: true },
      })
      expect(response.statusCode).toBe(200)
      expect(response.json()).toMatchObject({ success: true, data: { token: 'access-token' } })
    } finally {
      await app.close()
    }
  })

  it('allows refresh without an existing access token', async () => {
    vi.spyOn(AuthService, 'refreshToken').mockResolvedValue({
      token: 'new-access-token',
      refreshToken: 'new-refresh-token',
      expiresIn: 3600,
      refreshTokenExpiresIn: 7200,
    })
    const app = await buildApp()
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/app/auth/refresh',
        payload: { refreshToken: 'refresh-token' },
      })
      expect(response.statusCode).toBe(200)
      expect(response.json()).toMatchObject({ success: true, data: { token: 'new-access-token' } })
    } finally {
      await app.close()
    }
  })

  it.each([
    { method: 'GET' as const, url: '/api/v1/app/auth/me' },
    { method: 'GET' as const, url: '/api/v1/app/auth/capabilities' },
    { method: 'POST' as const, url: '/api/v1/app/auth/logout' },
  ])('requires authentication for $method $url', async ({ method, url }) => {
    const app = await buildApp()
    try {
      const response = await app.inject({ method, url })
      expect(response.statusCode).toBe(401)
      expect(response.json()).toMatchObject({ success: false, code: 22001 })
    } finally {
      await app.close()
    }
  })

  it('returns the user permissions and enabled mounted modules', async () => {
    vi
      .spyOn(PermissionService, 'loadForRoleIds')
      .mockResolvedValue({
        perms: new Set(['app:auth:profile', 'crm:mobile-test:read', 'shop:mobile-test:list', 'obsolete:grant']),
        roleCodes: new Set(['normal_user']),
      })
    const app = await buildApp({ authenticated: true })
    try {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/app/auth/capabilities',
      })
      expect(response.statusCode).toBe(200)
      expect(response.json()).toMatchObject({
        success: true,
        data: {
          permissions: ['app:auth:profile', 'crm:mobile-test:read', 'shop:mobile-test:list'],
          enabledModuleIds: ['crm'],
        },
      })
    } finally {
      await app.close()
    }
  })
  it('does not infer permissions from menus or unrelated catalog codes', async () => {
    vi.spyOn(PermissionService, 'loadForRoleIds').mockResolvedValue({
      perms: new Set(['app:auth:profile']),
      roleCodes: new Set(['normal_user']),
    })
    const app = await buildApp({ authenticated: true })
    try {
      const response = await app.inject({ method: 'GET', url: '/api/v1/app/auth/capabilities' })
      expect(response.json().data.permissions).toEqual(['app:auth:profile'])
    } finally {
      await app.close()
    }
  })

  it('expands super_admin to catalog permissions without exposing the internal sentinel', async () => {
    vi.spyOn(PermissionService, 'loadForRoleIds').mockResolvedValue({
      perms: new Set(['__super_admin__']),
      roleCodes: new Set(['super_admin']),
    })
    const app = await buildApp({ authenticated: true })
    try {
      const response = await app.inject({ method: 'GET', url: '/api/v1/app/auth/capabilities' })
      expect(response.statusCode).toBe(200)
      expect(response.json().data.permissions).toEqual(expect.arrayContaining([
        'app:auth:profile', 'crm:mobile-test:read', 'shop:mobile-test:list',
      ]))
      expect(response.json().data.permissions).not.toContain('__super_admin__')
      expect(response.json().data.enabledModuleIds).toEqual(['crm'])
    } finally {
      await app.close()
    }
  })

  it('returns no permissions for users with no active roles', async () => {
    const result = await PermissionService.getMobileCapabilities([], {
      listModuleIds: () => new Set(['crm', 'shop']),
      enabledIdsCached: async () => new Set(['crm', 'unmounted']),
    })
    expect(result).toEqual({ permissions: [], enabledModuleIds: ['crm'] })
  })

  it('requires the existing app profile permission', async () => {
    vi.spyOn(PermissionService, 'loadForRoleIds').mockResolvedValue({
      perms: new Set(['crm:mobile-test:read']), roleCodes: new Set(['normal_user']),
    })
    const app = await buildApp({ authenticated: true })
    try {
      const response = await app.inject({ method: 'GET', url: '/api/v1/app/auth/capabilities' })
      expect(response.statusCode).toBe(403)
      expect(response.json().success).toBe(false)
    } finally {
      await app.close()
    }
  })

  it('reports only permissions permitted by a restricted API token', async () => {
    vi.spyOn(PermissionService, 'loadForRoleIds').mockResolvedValue({
      perms: new Set(['app:auth:profile', 'crm:mobile-test:read']),
      roleCodes: new Set(['normal_user']),
    })
    const app = await buildApp({ authenticated: true, tokenScope: ['app:auth:profile'] })
    try {
      const response = await app.inject({ method: 'GET', url: '/api/v1/app/auth/capabilities' })
      expect(response.statusCode).toBe(200)
      expect(response.json().data.permissions).toEqual(['app:auth:profile'])
    } finally {
      await app.close()
    }
  })
})
