import Fastify from 'fastify'
import fastifyCookie from '@fastify/cookie'
import { afterEach, describe, expect, it, vi } from 'vitest'
import authPlugin from '../src/core/routes/api/v1/app/auth/index.ts'
import registerAuthSchemas from '../src/core/schemas/auth.ts'
import errorHandlerPlugin from '../src/core/plugins/external/error-handler.ts'
import jwtAuthPlugin from '../src/core/plugins/external/jwt-auth.ts'
import { defaultAuthProvider } from '../src/core/services/auth-provider.ts'
import { AuthService } from '../src/core/services/auth.service.ts'

async function buildApp() {
  const app = Fastify({ logger: false })
  app.decorate('rateLimit', () => async () => undefined)
  await app.register(errorHandlerPlugin)
  await app.register(fastifyCookie)
  app.decorate('authProvider', defaultAuthProvider)
  await app.register(jwtAuthPlugin)
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
})
