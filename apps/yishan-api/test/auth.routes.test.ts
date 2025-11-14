import Fastify from 'fastify'
import authPlugin from '../src/routes/api/v1/auth/index.ts'
import registerAuthSchemas from '../src/schemas/auth.ts'
import errorHandlerPlugin from '../src/plugins/external/error-handler.ts'
import { AuthService } from '../src/services/auth.service.ts'
import { ValidationErrorCode } from '../src/constants/business-codes/validation.ts'
import { describe, it, expect, vi, beforeEach } from 'vitest'

async function buildApp() {
  const app = Fastify({ logger: false })
  // 注入轻量鉴权装饰器，模拟公共鉴权插件的行为
  app.decorate('authenticate', async (request: any) => {
    const auth = request.headers.authorization
    if (!auth || !auth.startsWith('Bearer ')) {
      throw new Error('Unauthorized')
    }
    request.currentUser = {
      id: 1,
      username: 'admin',
      email: 'admin@example.com',
      realName: 'Admin',
      gender: 1,
      genderName: '男',
      status: 1,
      statusName: '启用',
      loginCount: 10,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastLoginTime: new Date().toISOString()
    }
  })
  await app.register(errorHandlerPlugin)
  registerAuthSchemas(app)
  // 注册auth路由时指定正确的路径前缀
  await app.register(authPlugin, { prefix: '/api/v1/auth' })
  await app.ready()
  return app
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('Auth routes', () => {
  it('POST /api/v1/auth/login 成功返回登录数据', async () => {
    const app = await buildApp()

    const loginData = {
      token: 'access-token',
      refreshToken: 'refresh-token',
      expiresIn: 3600,
      refreshTokenExpiresIn: 7200,
      expiresAt: Date.now() + 3600_000,
      refreshTokenExpiresAt: Date.now() + 7200_000
    }
    vi.spyOn(AuthService, 'login').mockResolvedValue(loginData)

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { username: 'admin', password: 'password', rememberMe: false }
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(true)
    expect(body.data).toEqual(loginData)

    await app.close()
  })

  it('POST /api/v1/auth/logout 缺少 Authorization 返回 400 和业务码', async () => {
    const app = await buildApp()

    const res = await app.inject({ method: 'POST', url: '/api/v1/auth/logout' })

    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body.success).toBe(false)
    expect(body.code).toBe(ValidationErrorCode.INVALID_PARAMETER)

    await app.close()
  })

  it('POST /api/v1/auth/logout 正常返回成功', async () => {
    const app = await buildApp()
    vi.spyOn(AuthService, 'logout').mockResolvedValue()

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      headers: { Authorization: 'Bearer any-token' }
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(true)
    expect(body.message).toContain('登出成功')

    await app.close()
  })

  it('GET /api/v1/auth/me 成功返回用户信息', async () => {
    const app = await buildApp()

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { Authorization: 'Bearer access-token' }
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(true)
    expect(body.data).toMatchObject({ id: 1, username: 'admin' })

    await app.close()
  })

  it('POST /api/v1/auth/refresh 成功返回新的令牌', async () => {
    const app = await buildApp()
    const refreshed = {
      token: 'new-access-token',
      refreshToken: 'new-refresh-token',
      expiresIn: 3600,
      refreshTokenExpiresIn: 7200,
      expiresAt: Date.now() + 3600_000,
      refreshTokenExpiresAt: Date.now() + 7200_000
    }
    vi.spyOn(AuthService, 'refreshToken').mockResolvedValue(refreshed)

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken: 'rt' }
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(true)
    expect(body.data).toEqual(refreshed)

    await app.close()
  })

  it('POST /api/v1/auth/refresh 缺少刷新令牌返回 400', async () => {
    const app = await buildApp()

    const res = await app.inject({ method: 'POST', url: '/api/v1/auth/refresh', payload: {} })

    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body.success).toBe(false)
    expect(body.code).toBe(ValidationErrorCode.INVALID_PARAMETER)

    await app.close()
  })
})