/**
 * 真实装配的端到端集成测试：以 fastify-cli 相同的方式加载**构建产物** dist/app.js
 * （全部插件、模块扫描/同步/挂载、gate），连接本文件独占的临时数据库与
 * YISHAN_TEST_REDIS_URL 指向的临时 Redis。前置条件：`pnpm build:ts`。
 *
 * 为什么用 dist：@fastify/autoload 以原生 import() 加载插件与路由文件，绕过 Vitest 的 TS 转换，
 * src/app.ts 无法在 Vitest 内启动；dist 也正是 CI 冒烟与生产运行的产物。
 * 通过 createRequire 原生加载，因此 test/setup.ts 对 src/db 的全局 mock 不作用于这里。
 *
 * 覆盖：登录、JWT 会话（me/refresh/logout）、PAT（scope 交集、撤销）、RBAC（无权限 403）、
 * 用户禁用与锁定、模块启停 gate（40400）及重启后保持。
 * 数据：只通过 Core 迁移建表 + 种子中的管理员与系统角色；其余数据经由 API 写入。
 */
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { applyMigrations, CORE_MIGRATIONS, resolveMigrationPlan } from './_migrations'
import { createTempDatabase, type TempDatabase } from './_setup'
import { hasModule } from '../_modules'

const enabled = process.env.YISHAN_RUN_INTEGRATION === '1'
const ADMIN_PASSWORD = 'admin123'
const DIST = join(process.cwd(), 'dist')
const nativeRequire = createRequire(join(process.cwd(), 'package.json'))

type App = { inject: (o: any) => Promise<any>; close: () => Promise<void>; ready: () => Promise<unknown> }

let temp: TempDatabase
let app: App

// @fastify/autoload 检测到 VITEST 环境变量会切换为 TS/ESM 加载模式；dist 是纯 CommonJS，
// 因此加载期间隐藏这两个变量，使其与 fastify-cli 的生产加载路径一致。
async function withoutVitestEnv<T>(fn: () => Promise<T>): Promise<T> {
  const saved = { VITEST: process.env.VITEST, VITEST_WORKER_ID: process.env.VITEST_WORKER_ID }
  delete process.env.VITEST
  delete process.env.VITEST_WORKER_ID
  try {
    return await fn()
  } finally {
    for (const [k, v] of Object.entries(saved)) if (v !== undefined) process.env[k] = v
  }
}

// 模拟进程重启：dist/db/client.js 的连接池是模块单例，app.close() 会关闭它，因此重启前清空 dist 模块缓存。
function forgetDistModules() {
  for (const key of Object.keys(nativeRequire.cache)) if (key.startsWith(DIST)) delete nativeRequire.cache[key]
}

/** 删除模块 gate 在 Redis 中的启停缓存键（与 ModuleLoader.invalidateEnabledCache 相同的键）。 */
async function clearModuleEnabledCache() {
  const Redis = createRequire(nativeRequire.resolve('@fastify/redis'))('ioredis')
  const client = new Redis(process.env.YISHAN_TEST_REDIS_URL)
  try {
    await client.del('yishan:modules:enabled')
  } finally {
    client.disconnect()
  }
}

async function bootApp(): Promise<App> {
  return withoutVitestEnv(async () => {
    const Fastify = nativeRequire('fastify')
    const appPlugin = nativeRequire(join(DIST, 'app.js')).default
    const instance = Fastify({ logger: false })
    await instance.register(appPlugin)
    await instance.ready()
    return instance as App
  })
}

const call = (method: string, url: string, opts: { token?: string; body?: unknown } = {}) =>
  app.inject({
    method,
    url,
    headers: opts.token ? { authorization: `Bearer ${opts.token}` } : {},
    ...(opts.body !== undefined ? { payload: opts.body } : {}),
  })

async function login(username: string, password: string) {
  const res = await call('POST', '/api/v1/auth/login', { body: { username, password } })
  return { res, body: res.json(), token: res.json()?.data?.token as string | undefined }
}

describe.runIf(enabled)('integration: real app assembly', () => {
  beforeAll(async () => {
    if (!process.env.YISHAN_TEST_REDIS_URL) throw new Error('YISHAN_TEST_REDIS_URL is required for app.e2e (disposable Redis)')
    if (!existsSync(join(DIST, 'app.js'))) throw new Error('dist/app.js missing: run `pnpm --filter yishan-api build:ts` first')
    temp = await createTempDatabase()
    await applyMigrations(temp.pool, resolveMigrationPlan(CORE_MIGRATIONS))

    // dist/db/client.js 在加载时按环境变量建池，必须先设置
    process.env.DATABASE_URL = temp.url
    process.env.REDIS_URL = process.env.YISHAN_TEST_REDIS_URL
    process.env.JWT_SECRET ??= 'p1a-integration-only-secret-0123456789abcdef'
    // 本文件会多次登录；放宽登录限流（默认 5/min，可由该环境变量配置），限流本身不在本测试范围内
    process.env.LOGIN_RATELIMIT_PER_MIN = '1000'

    // 种子：只取管理员与系统角色（与 db:seed Step 1 相同的函数）
    const { drizzleDb } = nativeRequire(join(DIST, 'db', 'index.js'))
    const { ensureAdminUser } = nativeRequire(join(DIST, 'scripts', 'seed', 'modules', 'system-user.js'))
    const { ensureSystemRoles, bindUserRole } = nativeRequire(join(DIST, 'scripts', 'seed', 'modules', 'system-role.js'))
    const admin = await ensureAdminUser(drizzleDb as any)
    const { superAdminRole } = await ensureSystemRoles(drizzleDb as any, admin.id)
    await bindUserRole(drizzleDb as any, admin.id, superAdminRole.id)

    app = await bootApp()
    // Redis 中的模块启停缓存（yishan:modules:enabled，60s TTL）不区分数据库；清掉上一次运行可能遗留的状态
    await clearModuleEnabledCache()
    // 与 db:seed 一致：权限目录在路由加载后才完整，因此在启动后为系统角色绑定默认权限
    const { bindRolePermissionsByDefault } = nativeRequire(join(DIST, 'scripts', 'seed', 'modules', 'system-role-permission.js'))
    await bindRolePermissionsByDefault(drizzleDb as any, admin.id)
  }, 120_000)

  afterAll(async () => {
    await app?.close()
    if (existsSync(join(DIST, 'db', 'client.js'))) await nativeRequire(join(DIST, 'db', 'client.js')).pool.end().catch(() => {})
    await temp?.drop()
  })

  it('login: wrong password → 401/22007; correct → 200 with access + refresh token', async () => {
    const bad = await login('admin', 'wrong-password')
    expect(bad.res.statusCode).toBe(401)
    expect(bad.body.code).toBe(22007)
    const ok = await login('admin', ADMIN_PASSWORD)
    expect(ok.res.statusCode).toBe(200)
    expect(ok.body.data.token).toBeTruthy()
    expect(ok.body.data.refreshToken).toBeTruthy()
  })

  it('JWT session: me → refresh → logout revokes the session (22003)', async () => {
    const { body } = await login('admin', ADMIN_PASSWORD)
    expect((await call('GET', '/api/v1/auth/me', { token: body.data.token })).statusCode).toBe(200)
    const refreshed = await call('POST', '/api/v1/auth/refresh', { body: { refreshToken: body.data.refreshToken } })
    expect(refreshed.statusCode).toBe(200)
    const newToken = refreshed.json().data.token
    expect((await call('GET', '/api/v1/auth/me', { token: newToken })).statusCode).toBe(200)
    expect((await call('POST', '/api/v1/auth/logout', { token: newToken, body: {} })).statusCode).toBe(200)
    const after = await call('GET', '/api/v1/auth/me', { token: newToken })
    expect(after.statusCode).toBe(401)
    expect(after.json().code).toBe(22003)
  })

  it('unauthenticated requests to core and module routes → 401/22001', async () => {
    const urls = ['/api/v1/auth/me', '/api/v1/admin/users', ...(hasModule('demo') ? ['/api/demo/v1/info'] : [])]
    for (const url of urls) {
      const res = await call('GET', url)
      expect(res.statusCode, `${url} ${res.body}`).toBe(401)
      expect(res.json().code, url).toBe(22001)
    }
  })

  it('PAT: scope intersection, empty scopes deny, revoke → 22010', async () => {
    const { token } = await login('admin', ADMIN_PASSWORD)
    const narrow = (await call('POST', '/api/v1/me/api-tokens', { token, body: { name: 'it-narrow', scopes: ['system:user:list'], duration: '7d' } })).json()
    expect(narrow.code).toBe(10000)
    expect((await call('GET', '/api/v1/admin/users?page=1&pageSize=1', { token: narrow.data.token })).statusCode).toBe(200)
    const outOfScope = await call('GET', '/api/v1/auth/me', { token: narrow.data.token })
    expect(outOfScope.statusCode).toBe(403)
    expect(outOfScope.json().code).toBe(22002)

    const empty = (await call('POST', '/api/v1/me/api-tokens', { token, body: { name: 'it-empty', scopes: [], duration: '7d' } })).json()
    expect((await call('GET', '/api/v1/admin/users?page=1&pageSize=1', { token: empty.data.token })).statusCode).toBe(403)

    expect((await call('DELETE', `/api/v1/me/api-tokens/${narrow.data.id}`, { token })).statusCode).toBe(200)
    const revoked = await call('GET', '/api/v1/admin/users?page=1&pageSize=1', { token: narrow.data.token })
    expect(revoked.statusCode).toBe(401)
    expect(revoked.json().code).toBe(22010)
  })

  describe('users created through the admin API', () => {
    let adminToken: string
    let phoneSeq = 0
    const createUser = async (username: string) => {
      const res = await call('POST', '/api/v1/admin/users', { token: adminToken, body: { username, password: 'P1aIntegration9', realName: username, phone: `139${String(++phoneSeq).padStart(8, '0')}` } })
      expect(res.statusCode, res.body).toBe(200)
      return res.json().data.id as number
    }

    beforeAll(async () => {
      adminToken = (await login('admin', ADMIN_PASSWORD)).token!
    })

    it('RBAC: a user without roles is authenticated but denied a permission-guarded route (403/22002)', async () => {
      await createUser('it_norole')
      const { token } = await login('it_norole', 'P1aIntegration9')
      expect(token).toBeTruthy()
      const res = await call('GET', '/api/v1/admin/users?page=1&pageSize=1', { token })
      expect(res.statusCode).toBe(403)
      expect(res.json().code).toBe(22002)
    })

    it('disabled / locked users: existing JWT sessions are rejected (baseline: disabled → HTTP 200 + 30003, locked → 403)', async () => {
      const disabledId = await createUser('it_disabled')
      const lockedId = await createUser('it_locked')
      const disabled = await login('it_disabled', 'P1aIntegration9')
      const locked = await login('it_locked', 'P1aIntegration9')
      await temp.pool.query("UPDATE sys_user SET status = '0' WHERE id = ?", [disabledId])
      await temp.pool.query("UPDATE sys_user SET status = '2' WHERE id = ?", [lockedId])

      const d = await call('GET', '/api/v1/auth/me', { token: disabled.token })
      expect(d.json()).toMatchObject({ success: false, code: 30003 })
      expect(d.statusCode).toBe(200)
      const l = await call('GET', '/api/v1/auth/me', { token: locked.token })
      expect(l.statusCode).toBe(403)
    })
  })

  // 需要仓库自带的 demo 模块；下游删除 demo 后跳过（模块启停机制本身由 module-lifecycle 单测覆盖）。
  it.runIf(hasModule('demo'))('module gate: disable demo → 404/40400 (also after restart); re-enable → reachable', async () => {
    try {
    const { token } = await login('admin', ADMIN_PASSWORD)
    expect((await call('GET', '/api/demo/v1/info', { token })).statusCode).toBe(200)
    const off = await call('POST', '/api/v1/admin/system/module-management/toggle/demo/toggle', { token, body: { enabled: false } })
    expect(off.statusCode).toBe(200)
    const blocked = await call('GET', '/api/demo/v1/info', { token })
    expect(blocked.statusCode).toBe(404)
    expect(blocked.json().code).toBe(40400)
    expect((await call('GET', '/api/health')).statusCode).toBe(200)

    await app.close()
    forgetDistModules()
    app = await bootApp()
    const t2 = (await login('admin', ADMIN_PASSWORD)).token
    const still = await call('GET', '/api/demo/v1/info', { token: t2 })
    expect(still.statusCode).toBe(404)
    expect(still.json().code).toBe(40400)

    await call('POST', '/api/v1/admin/system/module-management/toggle/demo/toggle', { token: t2, body: { enabled: true } })
    expect((await call('GET', '/api/demo/v1/info', { token: t2 })).statusCode).toBe(200)
    } finally {
      // 失败时也恢复启用状态，避免影响后续运行
      await temp.pool.query("UPDATE sys_module SET enabled = 1 WHERE id = 'demo'")
      await clearModuleEnabledCache()
    }
  }, 60_000)
})
