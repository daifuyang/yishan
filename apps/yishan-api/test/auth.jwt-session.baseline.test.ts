/**
 * P0 行为基线：authenticate 在 JWT 会话分支上的判定顺序与错误语义。
 *
 * PAT 分支已由 pat.lifecycle.test.ts 覆盖；这里补齐 JWT 分支：
 * 签名有效 → 仅接受 access_token → sys_user_token 会话存在 → 用户存在 → 用户状态（禁用/锁定）。
 * 只替换数据查询（UserTokenRepository / UserService），jwt-auth 插件与错误处理器为真实实现。
 */
import Fastify from 'fastify'
import fastifyCookie from '@fastify/cookie'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import errorHandlerPlugin from '../src/core/plugins/external/error-handler.ts'
import jwtAuthPlugin from '../src/core/plugins/external/jwt-auth.ts'
import { defaultAuthProvider } from '../src/core/services/auth-provider.ts'
import { UserTokenRepository } from '../src/core/repositories/user-token.repository.ts'
import { UserService } from '../src/core/services/user.service.ts'
import { AuthErrorCode } from '../src/constants/business-codes/auth.ts'
import { UserErrorCode } from '../src/constants/business-codes/user.ts'

const ACTIVE_USER = {
  id: 1,
  username: 'admin',
  email: 'admin@example.com',
  realName: 'Admin',
  gender: '1',
  genderName: '男',
  status: '1',
  statusName: '启用',
  loginCount: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  lastLoginTime: new Date().toISOString(),
  roleIds: [1],
}

async function buildApp(opts: { session?: boolean; user?: typeof ACTIVE_USER | null }) {
  const app = Fastify({ logger: false })
  await app.register(errorHandlerPlugin)
  await app.register(fastifyCookie)
  app.decorate('authProvider', defaultAuthProvider)
  await app.register(jwtAuthPlugin)
  app.get('/probe', { preHandler: app.authenticate }, async (req) => ({ userId: req.currentUser?.id }))
  await app.ready()

  vi.spyOn(UserTokenRepository, 'findByAccessToken').mockResolvedValue(
    (opts.session === false ? null : { userId: 1 }) as Awaited<ReturnType<typeof UserTokenRepository.findByAccessToken>>,
  )
  vi.spyOn(UserService, 'getUserById').mockResolvedValue(
    (opts.user === undefined ? ACTIVE_USER : opts.user) as Awaited<ReturnType<typeof UserService.getUserById>>,
  )
  return app
}

const sign = (app: Awaited<ReturnType<typeof buildApp>>, type = 'access_token') =>
  app.jwt.sign({ userId: 1, username: 'admin', type })

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('authenticate: JWT session branch baseline', () => {
  it('no token → 401 UNAUTHORIZED', async () => {
    const app = await buildApp({})
    const res = await app.inject({ method: 'GET', url: '/probe' })
    expect(res.statusCode).toBe(401)
    expect(res.json().code).toBe(AuthErrorCode.UNAUTHORIZED)
    await app.close()
  })

  it('valid access token + live session + active user → 200 with currentUser', async () => {
    const app = await buildApp({})
    const res = await app.inject({ method: 'GET', url: '/probe', headers: { authorization: `Bearer ${sign(app)}` } })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ userId: 1 })
    await app.close()
  })

  it('token from the yishan_at cookie is accepted', async () => {
    const app = await buildApp({})
    const res = await app.inject({ method: 'GET', url: '/probe', cookies: { yishan_at: sign(app) } })
    expect(res.statusCode).toBe(200)
    await app.close()
  })

  it('refresh_token type is rejected → TOKEN_INVALID', async () => {
    const app = await buildApp({})
    const res = await app.inject({ method: 'GET', url: '/probe', headers: { authorization: `Bearer ${sign(app, 'refresh_token')}` } })
    expect(res.statusCode).toBe(401)
    expect(res.json().code).toBe(AuthErrorCode.TOKEN_INVALID)
    await app.close()
  })

  it('signed token without a sys_user_token session (logged out) → TOKEN_INVALID', async () => {
    const app = await buildApp({ session: false })
    const res = await app.inject({ method: 'GET', url: '/probe', headers: { authorization: `Bearer ${sign(app)}` } })
    expect(res.statusCode).toBe(401)
    expect(res.json().code).toBe(AuthErrorCode.TOKEN_INVALID)
    await app.close()
  })

  it('disabled user (status "0") → USER_DISABLED', async () => {
    const app = await buildApp({ user: { ...ACTIVE_USER, status: '0', statusName: '禁用' } })
    const res = await app.inject({ method: 'GET', url: '/probe', headers: { authorization: `Bearer ${sign(app)}` } })
    expect(res.json()).toMatchObject({ success: false, code: UserErrorCode.USER_DISABLED })
    expect(res.statusCode).toBe(BASELINE_STATUS.disabled)
    await app.close()
  })

  it('locked user (status "2") → ACCOUNT_LOCKED', async () => {
    const app = await buildApp({ user: { ...ACTIVE_USER, status: '2', statusName: '锁定' } })
    const res = await app.inject({ method: 'GET', url: '/probe', headers: { authorization: `Bearer ${sign(app)}` } })
    expect(res.json().code).toBe(AuthErrorCode.ACCOUNT_LOCKED)
    expect(res.statusCode).toBe(BASELINE_STATUS.locked)
    await app.close()
  })
})

// HTTP status observed at P0 (all@e4a08d3); pinned so a provider swap cannot silently change it.
// USER_DISABLED is 30003, which BusinessCode maps to HTTP 200 (30000–32999 range) — current behaviour, not an endorsement.
const BASELINE_STATUS = { disabled: 200, locked: 403 }
