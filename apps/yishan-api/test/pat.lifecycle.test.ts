/**
 * PAT 生命周期端到端测试
 *
 * 覆盖 authenticate 装饰器在 PAT 分支上的所有拒绝路径：
 *   1. 到期拒绝          — findByRawToken 返回 null（已实现 expiresAt 检查）
 *   2. 撤销拒绝          — findByRawToken 返回 null（deletedAt 不为 null）
 *   3. 用户禁用拒绝      — currentUser.status === "0"
 *   4. 用户锁定拒绝      — currentUser.status === "2"
 *
 * 以及 scope 语义测试：
 *   5. 普通 PAT scope 交集 — tokenScope 仅含允许列表
 *   6. PAT 通配 scope      — tokenScope 含 "*"，保留完整角色权限
 *   7. super_admin 降权    — 普通 scopes 不再保留 super_admin 旁路（P1 修复）
 *   8. super_admin + 通配  — 含 "*" 时旁路保留
 */

import Fastify from 'fastify'
import fastifyCookie from '@fastify/cookie'
import authPlugin from '../src/core/routes/api/v1/auth/index.ts'
import registerAuthSchemas from '../src/core/schemas/auth.ts'
import errorHandlerPlugin from '../src/core/plugins/external/error-handler.ts'
import jwtAuthPlugin from '../src/core/plugins/external/jwt-auth.ts'
import { ApiTokenRepository } from '../src/core/repositories/api-token.repository.ts'
import { UserService } from '../src/core/services/user.service.ts'
import { MenuService } from '../src/core/services/menu.service.ts'
import { AuthErrorCode } from '../src/constants/business-codes/auth.ts'
import { SUPER_ADMIN_BYPASS } from '../src/constants/permission-codes.js'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
// Shared fixtures
// ============================================================================

const RAW_PAT = 'yishan_pat_testtoken12345'

const VALID_PAT_RECORD = {
  id: 10,
  name: 'ci-token',
  userId: 1,
  scopes: ['system:user:list'],
  expiresAt: null,
  lastUsedAt: null,
  lastUsedIp: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const ACTIVE_USER = {
  id: 1,
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
  roleIds: [1],
}

const DISABLED_USER = { ...ACTIVE_USER, status: '0', statusName: '禁用' }
const LOCKED_USER = { ...ACTIVE_USER, status: '2', statusName: '锁定' }
const SUPER_ADMIN_USER = { ...ACTIVE_USER, roleIds: [999] }

async function buildPatAuthApp(overrides?: {
  findByRawTokenResult?: typeof VALID_PAT_RECORD | null
  userResult?: typeof ACTIVE_USER | null
}) {
  const app = Fastify({ logger: false })
  app.decorate('rateLimit', () => async () => undefined)
  await app.register(errorHandlerPlugin)
  await app.register(fastifyCookie)
  await app.register(jwtAuthPlugin)
  registerAuthSchemas(app)

  vi.spyOn(ApiTokenRepository, 'findByRawToken').mockImplementation(async (raw: string) => {
    if (raw !== RAW_PAT) return null
    return overrides?.findByRawTokenResult ?? null
  })

  vi.spyOn(ApiTokenRepository, 'touch').mockResolvedValue(undefined)

  vi.spyOn(UserService, 'getUserById').mockImplementation(async (id: number) => {
    if (id !== 1) return null
    return overrides?.userResult ?? null
  })

  vi.spyOn(MenuService, 'getAuthorizedMenuPaths').mockResolvedValue(['/dashboard'])

  await app.register(authPlugin, { prefix: '/api/v1/auth' })
  await app.ready()
  return app
}

beforeEach(() => {
  vi.restoreAllMocks()
})

// ============================================================================
// Lifecycle: expiry, revocation, user status
// ============================================================================

describe('PAT lifecycle: findByRawToken returns null → API_TOKEN_NOT_FOUND', () => {
  it('已过期的 PAT（expiresAt < now）被拒绝', async () => {
    // findByRawToken 在 SQL 层过滤过期记录，返回 null
    // 模拟：token 存在但已过期（findByRawToken 会因 expiresAt 检查而返回 null）
    const app = await buildPatAuthApp({ findByRawTokenResult: null })

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { Authorization: `Bearer ${RAW_PAT}` },
    })

    expect(res.statusCode).toBe(401)
    const body = res.json()
    expect(body.code).toBe(AuthErrorCode.API_TOKEN_NOT_FOUND)
    expect(body.message).toMatch(/已过期|不存在/)

    await app.close()
  })

  it('已撤销的 PAT（deletedAt 不为 null）被拒绝', async () => {
    // findByRawToken 已排除 deletedAt 不为 null 的记录，返回 null 即表示撤销/不存在
    const app = await buildPatAuthApp({ findByRawTokenResult: null })

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { Authorization: `Bearer ${RAW_PAT}` },
    })

    expect(res.statusCode).toBe(401)
    const body = res.json()
    expect(body.code).toBe(AuthErrorCode.API_TOKEN_NOT_FOUND)

    await app.close()
  })
})

describe('PAT lifecycle: user status checks', () => {
  it('关联用户已被禁用（status="0"）→ API_TOKEN_REVOKED', async () => {
    const app = await buildPatAuthApp({
      findByRawTokenResult: VALID_PAT_RECORD,
      userResult: DISABLED_USER as any,
    })

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { Authorization: `Bearer ${RAW_PAT}` },
    })

    expect(res.statusCode).toBe(401)
    const body = res.json()
    expect(body.code).toBe(AuthErrorCode.API_TOKEN_REVOKED)
    expect(body.message).toMatch(/禁用/)

    await app.close()
  })

  it('关联用户已被锁定（status="2"）→ API_TOKEN_REVOKED', async () => {
    const app = await buildPatAuthApp({
      findByRawTokenResult: VALID_PAT_RECORD,
      userResult: LOCKED_USER as any,
    })

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { Authorization: `Bearer ${RAW_PAT}` },
    })

    expect(res.statusCode).toBe(401)
    const body = res.json()
    expect(body.code).toBe(AuthErrorCode.API_TOKEN_REVOKED)
    expect(body.message).toMatch(/锁定/)

    await app.close()
  })
})

// ============================================================================
// Lifecycle: valid PAT attaches correct tokenScope
// ============================================================================

describe('PAT lifecycle: valid token attaches correct tokenScope', () => {
  it('有效 PAT 认证成功，tokenScope 注入到 request', async () => {
    const app = await buildPatAuthApp({
      findByRawTokenResult: VALID_PAT_RECORD,
      userResult: ACTIVE_USER as any,
    })

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { Authorization: `Bearer ${RAW_PAT}` },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(true)
    expect(body.data.username).toBe('admin')

    await app.close()
  })

  it('PAT touch 被调用以更新 lastUsedAt / lastUsedIp', async () => {
    const app = await buildPatAuthApp({
      findByRawTokenResult: VALID_PAT_RECORD,
      userResult: ACTIVE_USER as any,
    })

    await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { Authorization: `Bearer ${RAW_PAT}` },
    })

    // touch 用 setImmediate 异步调用，等待事件循环处理
    await new Promise((resolve) => setImmediate(resolve))
    expect(ApiTokenRepository.touch).toHaveBeenCalledWith(10, expect.any(String))

    await app.close()
  })
})

// ============================================================================
// Scope semantics (computed in requirePermission, verified here via RBAC plugin)
// ============================================================================

describe('PAT scope semantics: computeEffectivePerms behavior', () => {
  // 测试用活动权限目录（不含 SUPER_ADMIN_BYPASS — sentinel 不在活动目录中）
  const CORE_CODES = new Set(['system:user:list', 'system:role:list']);

  it('普通用户 + 受限 scopes：effective = rolePerms ∩ tokenScope', async () => {
    const { computeEffectivePerms } = await import(
      '../src/core/services/permission.service.js'
    )
    const rolePerms = new Set(['system:user:list', 'system:role:list'])
    const result = computeEffectivePerms(rolePerms, ['system:user:list'], CORE_CODES)
    expect(result.has('system:user:list')).toBe(true)
    expect(result.has('system:role:list')).toBe(false)
    expect(result.size).toBe(1)
  })

  it('PAT 通配 ["*"]：effective = rolePerms ∩ activeCodes（含 super_admin 旁路）', async () => {
    const { computeEffectivePerms } = await import(
      '../src/core/services/permission.service.js'
    )
    const rolePerms = new Set(['system:user:list', SUPER_ADMIN_BYPASS])
    // 通配符也必须受活动权限目录限制
    const result = computeEffectivePerms(rolePerms, ['*'], CORE_CODES)
    expect(result.has('system:user:list')).toBe(true)
    expect(result.has(SUPER_ADMIN_BYPASS)).toBe(true)
    expect(result.size).toBe(2)
  })

  it('super_admin + 受限 scopes（不含 *）：super_admin 旁路被剥离', async () => {
    const { computeEffectivePerms } = await import(
      '../src/core/services/permission.service.js'
    )
    // rolePerms 来自用户角色含 super_admin
    const rolePerms = new Set(['system:user:list', SUPER_ADMIN_BYPASS])
    // 但用户只给 PAT 分配了 system:user:list，不含通配符
    const result = computeEffectivePerms(rolePerms, ['system:user:list'], CORE_CODES)
    // 旁路被剥离——scope 是严格上限
    expect(result.has('system:user:list')).toBe(true)
    expect(result.has(SUPER_ADMIN_BYPASS)).toBe(false)
    expect(result.size).toBe(1)
  })

  it('super_admin + ["*"]：通配保留 super_admin 旁路（但受活动目录限制）', async () => {
    const { computeEffectivePerms } = await import(
      '../src/core/services/permission.service.js'
    )
    const rolePerms = new Set(['system:user:list', SUPER_ADMIN_BYPASS])
    // 通配符继承 rolePerms，但必须与活动权限目录相交
    const result = computeEffectivePerms(rolePerms, ['*'], CORE_CODES)
    expect(result.has(SUPER_ADMIN_BYPASS)).toBe(true)
    expect(result.size).toBe(2)
  })

  it('显式空 scopes []：拒绝一切（即便 super_admin 也拒绝）', async () => {
    const { computeEffectivePerms } = await import(
      '../src/core/services/permission.service.js'
    )
    const rolePerms = new Set(['system:user:list', SUPER_ADMIN_BYPASS])
    const result = computeEffectivePerms(rolePerms, [], CORE_CODES)
    expect(result.size).toBe(0)
    expect(result.has(SUPER_ADMIN_BYPASS)).toBe(false)
  })

  it('PAT scope 不可超出 rolePerms（权限不会因 tokenScope 而扩大）', async () => {
    const { computeEffectivePerms } = await import(
      '../src/core/services/permission.service.js'
    )
    // 用户只有 system:user:list，tokenScope 申请了 system:role:list（用户没有的权限）
    const rolePerms = new Set(['system:user:list'])
    const result = computeEffectivePerms(rolePerms, ['system:user:list', 'system:role:list'], CORE_CODES)
    // system:role:list 不在 rolePerms 中，不会因 tokenScope 申请就获得
    expect(result.has('system:role:list')).toBe(false)
    expect(result.has('system:user:list')).toBe(true)
    expect(result.size).toBe(1)
  })

  it('非 super_admin + ["__super_admin__"]：旁路不会凭空出现', async () => {
    const { computeEffectivePerms } = await import(
      '../src/core/services/permission.service.js'
    )
    // 用户角色不含 super_admin，但 tokenScope 显式包含旁路标记
    const rolePerms = new Set(['system:user:list'])
    const result = computeEffectivePerms(rolePerms, ['system:user:list', SUPER_ADMIN_BYPASS], CORE_CODES)
    // 旁路不会从 tokenScope 凭空获得
    expect(result.has(SUPER_ADMIN_BYPASS)).toBe(false)
    expect(result.size).toBe(1)
  })
})
