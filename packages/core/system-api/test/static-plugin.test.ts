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
import { afterEach, beforeEach, describe, expect, it, vi, testRuntime } from './runtime-fixture'

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
  testRuntime().config.ADMIN.diskPath = TMP_ROOT
  ;({ default: staticPlugin } = await import('../src/core/plugins/external/static.js'))
  ;({ ADMIN } = await import('../src/config/admin.js'))

  // 强制 diskPath 指向临时目录（覆盖 env 默认的 process.cwd()/public/admin）。
  testRuntime().config.ADMIN.diskPath = TMP_ROOT
})

afterEach(() => {
  rmSync(TMP_ROOT, { recursive: true, force: true })
})

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  // 全局 error handler 与生产一致：HTTP 403 → envelope code=22002。
  // 这样当 fastify-static 内部抛 403 时能被翻译成 envelope（验证修复前的行为）。
  const errorHandler = (
    await import('@yishan/core-api/plugins')
  ).errorHandlerPlugin
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

/**
 * 预压缩产物 + 分文件缓存策略的回归。
 *
 * 背景：admin 打包时用 `apps/demo/admin/scripts/precompress.mjs` 生成同名
 * `.br` / `.gz` 产物，服务器侧靠 @fastify/static 的 `preCompressed: true`
 * 按 Accept-Encoding 选择；缓存策略由 `setHeaders` 按文件类型决定
 * （send 的默认 `public, max-age=0` 必须被 `cacheControl: false` 关掉才改得动）。
 *
 * 验证：
 *   1. Accept-Encoding: br → 返回 .br 内容 + content-encoding: br + vary
 *   2. Accept-Encoding: gzip → 返回 .gz 内容 + content-encoding: gzip
 *   3. 不带 Accept-Encoding → 返回原文件，无 content-encoding
 *   4. 带 hash 的产物 → cache-control: public, max-age=31536000, immutable
 *   5. index.html → cache-control: no-cache
 *   6. SPA 深链回 index.html → cache-control: no-cache
 */
describe('static 插件 — 预压缩与缓存策略', () => {
  beforeEach(() => {
    writeFileSync(join(TMP_ROOT, 'umi.77499b51.js'), 'console.log("umi")')
    writeFileSync(join(TMP_ROOT, 'umi.77499b51.js.br'), 'BR-BODY')
    writeFileSync(join(TMP_ROOT, 'umi.77499b51.js.gz'), 'GZ-BODY')
  })

  it('Accept-Encoding: br 返回 .br 产物', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/admin/umi.77499b51.js',
      headers: { 'accept-encoding': 'br' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-encoding']).toBe('br')
    expect(res.headers.vary).toBe('Accept-Encoding')
    expect(res.body).toBe('BR-BODY')
    await app.close()
  })

  it('Accept-Encoding: gzip 返回 .gz 产物', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/admin/umi.77499b51.js',
      headers: { 'accept-encoding': 'gzip' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-encoding']).toBe('gzip')
    expect(res.body).toBe('GZ-BODY')
    await app.close()
  })

  it('不带 Accept-Encoding 返回原文件', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/admin/umi.77499b51.js',
      headers: { 'accept-encoding': 'identity' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-encoding']).toBeUndefined()
    expect(res.body).toBe('console.log("umi")')
    await app.close()
  })

  it('带 hash 的产物走一年 immutable', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/admin/umi.77499b51.js',
      headers: { 'accept-encoding': 'br' },
    })
    expect(res.headers['cache-control']).toBe('public, max-age=31536000, immutable')
    await app.close()
  })

  it('index.html 走 no-cache', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/admin/index.html' })
    expect(res.statusCode).toBe(200)
    expect(res.headers['cache-control']).toBe('no-cache')
    await app.close()
  })

  it('SPA 深链回 index.html 也走 no-cache', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/admin/user/login' })
    expect(res.statusCode).toBe(200)
    expect(res.headers['cache-control']).toBe('no-cache')
    await app.close()
  })
})

/**
 * root 挂载模式（admin 独立子域名、占用根路径）下的回归。
 *
 * 背景：root 模式下 admin 作用域就是整个 `/`，SPA fallback 会把所有未匹配
 * 路径吞成 index.html + 200 —— 包括拼错的 `/api/...`。调用方拿到 HTML 却以为是
 * 成功响应，"接口 404"在现场表现为"接口正常返回"，极难排查。
 *
 * 验证：
 *   1. /system/user      → 200 + HTML（SPA 深链仍归 admin）
 *   2. /api/v1/missing   → 404 + envelope（让给全局 handler）
 *   3. /api 带 query     → 同样 404（query 不参与路径判断）
 */
describe('static 插件 — root 挂载模式', () => {
  // 不走 vi.resetModules：那会让 static.ts 与 runtime-fixture 落在两套不同的
  // AsyncLocalStorage 上，插件里的 currentSystemRuntime() 直接抛 scope 缺失。
  // ADMIN 是普通导出对象，直接改 mount.mode 就能切换到 root 形态。
  let previousMode: string

  async function buildRootApp(): Promise<FastifyInstance> {
    previousMode = ADMIN.mount.mode
    ADMIN.mount.mode = 'root'
    testRuntime().config.ADMIN.diskPath = TMP_ROOT

    const app = Fastify({ logger: false })
    // 与生产一致：全局 notFoundHandler 返回 envelope 404。
    app.setNotFoundHandler((request, reply) =>
      reply.code(404).send({ code: 25005, message: `Route ${request.method}:${request.url} not found` }))
    const { errorHandlerPlugin } = await import('@yishan/core-api/plugins')
    await app.register(errorHandlerPlugin)
    await app.register(staticPlugin)
    return app
  }

  afterEach(() => {
    ADMIN.mount.mode = previousMode as typeof ADMIN.mount.mode
  })

  it('/system/user 仍走 SPA fallback', async () => {
    const app = await buildRootApp()
    const res = await app.inject({ method: 'GET', url: '/system/user' })
    expect(res.statusCode).toBe(200)
    expect(res.body).toContain('admin-spa')
    await app.close()
  })

  it('/api/<unknown> 返回 404 envelope 而不是 index.html', async () => {
    const app = await buildRootApp()
    const res = await app.inject({ method: 'GET', url: '/api/v1/definitely-missing' })
    expect(res.statusCode).toBe(404)
    expect(res.headers['content-type']).toMatch(/application\/json/)
    expect(res.body).not.toContain('admin-spa')
    expect(JSON.parse(res.body)).toMatchObject({ success: false, code: 25005, data: null })
    await app.close()
  })

  it('/api 带 query 同样让给全局 404', async () => {
    const app = await buildRootApp()
    const res = await app.inject({ method: 'GET', url: '/api/v1/definitely-missing?page=1&pageSize=20' })
    expect(res.statusCode).toBe(404)
    expect(res.headers['content-type']).toMatch(/application\/json/)
    expect(res.body).not.toContain('admin-spa')
    await app.close()
  })

  // root 模式下 /admin 不再是有效路由。浏览器书签与地址栏自动补全仍会送来，
  // 落进 SPA 的 404 页表现为「怎么又回到 /admin 了」—— 301 回根路径，并保留后缀。
  it('/admin 301 回 /', async () => {
    const app = await buildRootApp()
    const res = await app.inject({ method: 'GET', url: '/admin' })
    expect(res.statusCode).toBe(301)
    expect(res.headers.location).toBe('/')
    await app.close()
  })

  it('/admin/<path> 301 回对应根路径，保留后缀', async () => {
    const app = await buildRootApp()
    const res = await app.inject({ method: 'GET', url: '/admin/system/user' })
    expect(res.statusCode).toBe(301)
    expect(res.headers.location).toBe('/system/user')
    await app.close()
  })

  it('/admin/?query 的 query 不进重定向目标', async () => {
    const app = await buildRootApp()
    const res = await app.inject({ method: 'GET', url: '/admin/?page=1&pageSize=20' })
    expect(res.statusCode).toBe(301)
    expect(res.headers.location).toBe('/')
    await app.close()
  })
})
