import Fastify from 'fastify'
import fastifyCookie from '@fastify/cookie'
import authPlugin from '../src/core/routes/api/v1/auth/index.ts'
import registerAuthSchemas from '../src/core/schemas/auth.ts'
import errorHandlerPlugin from '../src/core/plugins/external/error-handler.ts'
import jwtAuthPlugin from '../src/core/plugins/external/jwt-auth.ts'
import { AuthService } from '../src/core/services/auth.service.ts'
import { MenuService } from '../src/core/services/menu.service.ts'
import { UserService } from '../src/core/services/user.service.ts'
import { UserTokenRepository } from '../src/core/repositories/user-token.repository.ts'
import { JWT_CONFIG } from '../src/core/config/index.ts'
import { ValidationErrorCode } from '../src/constants/business-codes/validation.ts'
import { AuthErrorCode } from '../src/constants/business-codes/auth.ts'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
// Helpers
// ============================================================================

/**
 * 注入一个轻量鉴权装饰器（仅用于不依赖真实 JWT 校验的路径，
 * 例如 login/refresh）。/me 和 /logout 应当走 buildRealAuthApp 走真实链路。
 */
async function buildApp() {
  const app = Fastify({ logger: false })
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
  // Section 7 rate-limit 默认在生产 / 生产预发部署注入。这里测试用例仅验证
  // 服务自身行为，因此用一个 noop 装饰器替换。
  app.decorate('rateLimit', () => async (_request: any, _reply: any) => undefined)
  await app.register(errorHandlerPlugin)
  await app.register(fastifyCookie)
  registerAuthSchemas(app)
  await app.register(authPlugin, { prefix: '/api/v1/auth' })
  await app.ready()
  return app
}

/**
 * 真实 jwt-auth 链路：注册真实的 jwt-auth 插件与 @fastify/cookie，
 * 通过 vi.spyOn 拦截 UserTokenRepository / UserService / MenuService 的 DB 依赖。
 * 用于覆盖 yishan_at cookie、伪造签名、JWT 校验失败的鉴权分支。
 */
async function buildRealAuthApp({
  userId = 1,
}: { userId?: number } = {}) {
  const app = Fastify({ logger: false })
  // Section 7 rate-limit 默认 noop
  app.decorate('rateLimit', () => async (_request: any, _reply: any) => undefined)
  await app.register(errorHandlerPlugin)
  await app.register(fastifyCookie)
  await app.register(jwtAuthPlugin)
  registerAuthSchemas(app)

  // 让 jwt-auth 走通：accessToken 在 user-token 表里有对应记录、用户未被禁用/锁定。
  // 这里采用白名单的方式：被签名且类型正确的 token 即视为有效；
  // 伪造签名 token 会在 jwtVerify() 阶段先被拒，进不到这个 mock。
  vi.spyOn(UserTokenRepository, 'findByAccessToken').mockImplementation(async (token: string) => {
    if (!token) return null
    return {
      id: 1,
      userId,
      accessToken: token,
      refreshToken: 'valid-refresh-token',
      isRevoked: false,
    } as any
  })
  vi.spyOn(UserService, 'getUserById').mockImplementation(async (id: number) => {
    if (id !== userId) return null
    return {
      id,
      username: 'admin',
      email: 'admin@example.com',
      realName: 'Admin',
      gender: '1',
      genderName: '男',
      status: '1',
      statusName: '启用',
      loginCount: 10,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastLoginTime: new Date().toISOString(),
      roleIds: [],
    } as any
  })
  vi.spyOn(MenuService, 'getAuthorizedMenuPaths').mockResolvedValue(['/system', '/dashboard'])

  await app.register(authPlugin, { prefix: '/api/v1/auth' })
  await app.ready()
  return app
}

/** 用 fastify.jwt 签出一个有效 access_token；要求 fastify 实例已完成 register(jwtAuthPlugin)。 */
function signAccessToken(app: any, userId = 1): string {
  return app.jwt.sign({ id: userId, type: 'access_token' }, { expiresIn: 600 })
}

beforeEach(() => {
  vi.restoreAllMocks()
})

// ============================================================================
// login / refresh —— 仍走轻量 fake-authenticate 的 buildApp，鉴权不涉及
// ============================================================================

describe('Auth routes (login/refresh, no real JWT)', () => {
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

    // 登录成功应下发 HttpOnly 认证 cookie（响应体仍保留 token 字段）
    const setCookie = res.headers['set-cookie']
    const cookies = Array.isArray(setCookie) ? setCookie.join('\n') : String(setCookie ?? '')
    expect(cookies).toContain('yishan_at=')
    expect(cookies).toContain('yishan_rt=')
    expect(cookies).toContain('HttpOnly')
    expect(cookies).toContain('Path=/')
    expect(cookies).toMatch(/SameSite=Lax/i)

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

  it('POST /api/v1/auth/refresh 从 cookie 读取 refreshToken', async () => {
    const app = await buildApp()
    const refreshed = {
      token: 'new-access-token',
      refreshToken: 'new-refresh-token',
      expiresIn: 3600,
      refreshTokenExpiresIn: 7200,
      expiresAt: Date.now() + 3600_000,
      refreshTokenExpiresAt: Date.now() + 7200_000
    }
    const spy = vi.spyOn(AuthService, 'refreshToken').mockResolvedValue(refreshed)

    // body 为空，仅通过 cookie 携带 refreshToken
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      cookies: { yishan_rt: 'rt-from-cookie' },
      payload: {}
    })

    expect(res.statusCode).toBe(200)
    expect(spy).toHaveBeenCalledWith('rt-from-cookie', expect.anything())
    const setCookie = res.headers['set-cookie']
    const cookies = Array.isArray(setCookie) ? setCookie.join('\n') : String(setCookie ?? '')
    expect(cookies).toContain('yishan_at=')
    expect(cookies).toContain('yishan_rt=')

    await app.close()
  })
})

// ============================================================================
// /me 与 /logout —— 必须走真实 jwt-auth 插件，回归 HttpOnly cookie 鉴权
// ============================================================================

describe('Auth routes (/me + /logout, real jwt-auth plugin)', () => {
  it('GET /api/v1/auth/me 通过 Authorization header 成功', async () => {
    const app = await buildRealAuthApp()
    const token = signAccessToken(app)

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { Authorization: `Bearer ${token}` }
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(true)
    expect(body.data).toMatchObject({ id: 1, username: 'admin' })
    expect(body.data.accessPath).toEqual(['/system', '/dashboard'])

    await app.close()
  })

  it('GET /api/v1/auth/me 通过 yishan_at cookie 成功（HttpOnly 鉴权回归）', async () => {
    const app = await buildRealAuthApp()
    const token = signAccessToken(app)

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      cookies: { yishan_at: token }
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(true)
    expect(body.data).toMatchObject({ id: 1, username: 'admin' })

    await app.close()
  })

  it('GET /api/v1/auth/me 缺 token 返回 401', async () => {
    const app = await buildRealAuthApp()

    const res = await app.inject({ method: 'GET', url: '/api/v1/auth/me' })

    expect(res.statusCode).toBe(401)
    const body = res.json()
    expect(body.success).toBe(false)
    expect(body.code).toBe(AuthErrorCode.UNAUTHORIZED)

    await app.close()
  })

  it('GET /api/v1/auth/me 伪造签名 token 返回 401', async () => {
    const app = await buildRealAuthApp()
    const token = signAccessToken(app)
    // 篡改签名段，模拟伪造 payload：解出的 id 仍能 match，但签名校验失败。
    const [header, payload] = token.split('.')
    const tampered = `${header}.${payload}.tamperedsignature`

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { Authorization: `Bearer ${tampered}` }
    })

    expect(res.statusCode).toBe(401)
    const body = res.json()
    expect(body.success).toBe(false)
    expect([AuthErrorCode.UNAUTHORIZED, AuthErrorCode.TOKEN_INVALID]).toContain(body.code)

    await app.close()
  })

  it('GET /api/v1/auth/me 用 refresh_token 类型的 JWT 访问被拒', async () => {
    // jwt-auth 插件要求 type === 'access_token'；refresh token 不允许访问业务接口。
    const app = await buildRealAuthApp()
    const refreshToken = app.jwt.sign(
      { id: 1, type: 'refresh_token' },
      { expiresIn: 600 }
    )

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { Authorization: `Bearer ${refreshToken}` }
    })

    expect(res.statusCode).toBe(401)
    await app.close()
  })

  it('POST /api/v1/auth/logout 缺 Authorization 返回 401', async () => {
    // `auth:logout` 不在 BYPASS_CODES 中，route-registrar 自动注入
    // `authenticate` + `requirePermission` preHandler；缺 token 在 jwt-auth 阶段即被拦下。
    const app = await buildRealAuthApp()

    const res = await app.inject({ method: 'POST', url: '/api/v1/auth/logout' })

    expect(res.statusCode).toBe(401)
    const body = res.json()
    expect(body.success).toBe(false)
    expect(body.code).toBe(AuthErrorCode.UNAUTHORIZED)

    await app.close()
  })

  it('POST /api/v1/auth/logout 伪造签名 token 返回 401', async () => {
    // 伪造签名 token 在 jwt-auth 阶段 jwtVerify 失败被拦下。
    const app = await buildRealAuthApp()
    const token = signAccessToken(app)
    const [header, payload] = token.split('.')
    const tampered = `${header}.${payload}.tamperedsignature`

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      headers: { Authorization: `Bearer ${tampered}` }
    })

    expect(res.statusCode).toBe(401)
    const body = res.json()
    expect(body.success).toBe(false)
    expect([AuthErrorCode.UNAUTHORIZED, AuthErrorCode.TOKEN_INVALID]).toContain(body.code)

    await app.close()
  })

  it('POST /api/v1/auth/logout 用有效 jwt 撤销当前用户所有活跃 token', async () => {
    const app = await buildRealAuthApp({ userId: 42 })
    const token = signAccessToken(app, 42)

    const findActiveSpy = vi
      .spyOn(UserTokenRepository, 'findActiveTokensByUserId')
      .mockResolvedValue([
        { id: 100, userId: 42 } as any,
        { id: 101, userId: 42 } as any,
      ])
    const revokeSpy = vi
      .spyOn(UserTokenRepository, 'revoke')
      .mockResolvedValue(undefined as any)

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      headers: { Authorization: `Bearer ${token}` }
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(true)
    expect(body.message).toContain('登出成功')

    // 鉴权成功后必须按 currentUser.id 撤销所有活跃 token，不接受外部传入 token。
    expect(findActiveSpy).toHaveBeenCalledWith(42)
    expect(revokeSpy).toHaveBeenCalledTimes(2)
    expect(revokeSpy).toHaveBeenCalledWith(100)
    expect(revokeSpy).toHaveBeenCalledWith(101)

    // 验证 logout 也会清除浏览器端认证 cookie。
    const setCookie = res.headers['set-cookie']
    const cookies = Array.isArray(setCookie) ? setCookie.join('\n') : String(setCookie ?? '')
    expect(cookies).toContain('yishan_at=')
    expect(cookies).toContain('yishan_rt=')

    await app.close()
  })

  it('POST /api/v1/auth/logout 不接受伪造 id 的 payload 撤销其他用户', async () => {
    // 反向回归：之前 AuthService.logout 直接 jwt.decode()，攻击者只要写
    // { id: 受害者 } 就能撤销受害者全部 token。修复后路由层强制鉴权，
    // 伪造 token 在 jwt-auth 阶段就被拦下，AuthService.logout 不会被调用。
    const app = await buildRealAuthApp({ userId: 42 })
    const findActiveSpy = vi
      .spyOn(UserTokenRepository, 'findActiveTokensByUserId')
      .mockResolvedValue([])

    const forgeApp = Fastify({ logger: false })
    await forgeApp.register(jwtAuthPlugin)
    // 用任意 secret 自签 id=999 的 JWT；jwt-auth 用真实 secret verify 时签名不匹配。
    const forgedWithOtherSecret = forgeApp.jwt.sign(
      { id: 999, type: 'access_token' },
      { expiresIn: 600, key: 'forged-secret', algorithm: 'HS256' }
    )
    await forgeApp.close()

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      headers: { Authorization: `Bearer ${forgedWithOtherSecret}` }
    })

    expect(res.statusCode).toBe(401)
    // 关键断言：被拒绝的请求不会触发对任何用户 id 的 token 撤销。
    expect(findActiveSpy).not.toHaveBeenCalled()

    await app.close()
  })
})