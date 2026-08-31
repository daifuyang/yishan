/**
 * Static 插件 admin SPA 注册回归测试
 *
 * 背景：@fastify/static 8.x 在 `index: []`（显式 false 或空数组）+ 路径以
 * `/` 结尾 + 未配置 `list` 时，send 库会直接抛 403，绕过 plugin 自身的
 * setNotFoundHandler。错误冒泡到全局 error handler 后被翻译成 envelope
 * `code=22002 (FORBIDDEN)`，线上表现为 `https://host/admin/` 直接返回
 * 403 + "Forbidden"。
 *
 * 验证：
 *   1. /admin/                 → 200 + HTML（SPA 入口，不能再 403）
 *   2. /admin/index.html       → 200 + HTML（显式文件路径）
 *   3. /admin/<hash>.css       → 200 + CSS（hash 资产）
 *   4. /admin/<deep-spa-path>  → 200 + HTML（SPA fallback 到 index.html）
 *
 * 这次修复把 `static.ts` 里 admin scope 的 `index: false` 改成
 * `index: ['index.html']`，让 fastify-static 自身处理 trailing-slash 的目录
 * fallback；setNotFoundHandler 仍兜底深层 SPA 路径。
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Fastify, { type FastifyInstance } from 'fastify'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

// 必须先设置 env 再 import plugin（ADMIN 配置在模块顶层读 env）。
const TMP_ROOT = mkdtempSync(join(tmpdir(), 'static-plugin-test-'))
process.env.ADMIN_BASE_PATH = '/admin'
process.env.ADMIN_MOUNT_MODE = 'subpath'
process.env.ADMIN_REDIRECT_ROOT = 'false'

// 把 ADMIN.diskPath 重定向到我们的临时 dist 目录。
// 用 require 重新加载模块以让新的 process.env 生效。
let staticPlugin: typeof import('../src/core/plugins/external/static.js').default
let ADMIN: typeof import('../src/config/admin.js').ADMIN

beforeEach(async () => {
  // 重置 dist 目录内容
  rmSync(TMP_ROOT, { recursive: true, force: true })
  mkdirSync(TMP_ROOT, { recursive: true })
  writeFileSync(join(TMP_ROOT, 'index.html'), '<!doctype html><html><body>admin-spa</body></html>')
  writeFileSync(join(TMP_ROOT, 'umi.abc.css'), 'body{color:red}')
  writeFileSync(join(TMP_ROOT, 'preload.def.js'), 'console.log(1)')
  mkdirSync(join(TMP_ROOT, 'scripts'))
  writeFileSync(join(TMP_ROOT, 'scripts', 'loading.js'), 'console.log("loading")')

  // 用 vi.resetModules 清掉模块缓存，让 ADMIN 配置基于当前的 env + 临时目录
  // 重新计算。TEST 入口需要保证 ADMIN.diskPath = TMP_ROOT。
  vi.resetModules()
  ;({ default: staticPlugin } = await import('../src/core/plugins/external/static.js'))
  ;({ ADMIN } = await import('../src/config/admin.js'))

  // 强制 diskPath 指向临时目录（覆盖 env 默认的 process.cwd()/public/admin）。
  Object.assign(ADMIN, { diskPath: TMP_ROOT })
})

afterEach(() => {
  rmSync(TMP_ROOT, { recursive: true, force: true })
})

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  // 全局 error handler 与生产一致：HTTP 403 → envelope code=22002。
  // 这样当 fastify-static 内部抛 403 时能被翻译成 envelope（验证修复前的行为）。
  const errorHandler = (
    await import('../src/core/plugins/external/error-handler.js')
  ).default
  await app.register(errorHandler)
  await app.register(staticPlugin)
  return app
}

describe('static 插件 — admin SPA 注册', () => {
  it('/admin/index.html 返回 HTML 入口', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/admin/index.html' })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toMatch(/text\/html/)
    expect(res.body).toContain('admin-spa')
    await app.close()
  })

  it('/admin/ （trailing slash, 目录路径）应 fallback 到 index.html 而不是 403', async () => {
    // 修复前：@fastify/static index:false → trailing slash → send 抛 403
    // 修复后：index:['index.html'] → 自动 fallback → 200 HTML
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/admin/' })
    expect(res.statusCode).toBe(200)
    expect(res.body).toContain('admin-spa')
    await app.close()
  })

  it('/admin/<hash>.css 返回 CSS 资产', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/admin/umi.abc.css' })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toMatch(/text\/css/)
    expect(res.body).toBe('body{color:red}')
    await app.close()
  })

  it('/admin/scripts/loading.js 返回 JS 资产', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/admin/scripts/loading.js' })
    expect(res.statusCode).toBe(200)
    expect(res.body).toBe('console.log("loading")')
    await app.close()
  })

  it('/admin/<deep-spa-path> 被 SPA fallback 到 index.html', async () => {
    const app = await buildApp()
    // /admin/user/login 不是文件，static 找不到；setNotFoundHandler 兜底 sendFile index.html
    const res = await app.inject({ method: 'GET', url: '/admin/user/login' })
    expect(res.statusCode).toBe(200)
    expect(res.body).toContain('admin-spa')
    await app.close()
  })
})
