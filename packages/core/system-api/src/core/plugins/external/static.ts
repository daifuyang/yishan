import { currentSystemRuntime } from '@/runtime'
import { access, readFile } from 'node:fs/promises'
import { constants as fsConstants } from 'node:fs'
import { join } from 'node:path'
import fp from 'fastify-plugin'
import fastifyStatic from '@fastify/static'
import { SystemManageErrorCode } from '@yishan/core-api/business-codes'
import { ADMIN } from '../../../config/admin.js'
import { STORAGE } from '../../../config/storage.js'

/**
 * 静态资源 + Admin SPA 装配。
 *
 * 设计要点（按第一性原理）：
 * 1) 启动期 fs.access 探测 uploads 目录是否可读 → 决定是否挂静态路由；
 *    插件本身不做"边 register 边 try/catch"的混合职责。
 * 2) 路径规整、URL prefix、admin mount 模式全部由 config 边界层产出；
 *    插件只读字段，不做字符串推断。
 * 3) SPA fallback 只在 admin prefix 范围内生效（嵌套 register），
 *    不动全局 setNotFoundHandler，避免覆盖 app.ts 的 envelope 404 handler。
 *
 * 关于 decorateReply=false：
 *   同一 Fastify 实例上多次 register(fastifyStatic) 会触发 `decorateReply('sendFile')`
 *   重复装饰而抛错，因此 uploads / admin 都用 decorateReply:false。
 *   但 false 也意味着 reply.sendFile 不会被装饰，所以 admin SPA fallback 改成
 *   直接 readFile + reply.type(...).send(...) ，绕开 sendFile 装饰器依赖。
 */
export default fp(async (fastify) => {
  // ─── 1. uploads 静态资源（可选挂载；目录缺失则降级） ───────────
  if (STORAGE.isPublic) {
    const canServe = await canReadDir(STORAGE.diskRoot)
    if (canServe) {
      await fastify.register(fastifyStatic, {
        root: STORAGE.diskRoot,
        prefix: STORAGE.urlPrefix,
        decorateReply: false,
      })
    } else {
      fastify.log.warn(
        { root: STORAGE.diskRoot },
        'uploads dir missing or unreadable; static route skipped (writes still work via attachment.service)'
      )
    }
  }

  // ─── 2. admin SPA（必挂；静态资源 + prefix 范围内的 SPA fallback） ─
  const adminPrefix = ADMIN.mount.mode === 'root' ? '/' : ADMIN.mount.path
  await fastify.register(async (adminScope) => {
    await adminScope.register(fastifyStatic, {
      root: ADMIN.diskPath,
      prefix: '/',
      // 显式声明 index 文件列表，让 @fastify/static 自动把 trailing-slash 的目录
      // 请求（如 /admin/、/admin/scripts/）fallback 到 index.html。
      // 若不设 index，路径以 / 结尾时 @fastify/static 内部 send 库会直接抛 403，
      // 连 adminScope.setNotFoundHandler 都接不到 —— 错误冒泡到全局 error handler
      // 翻译成 envelope code=22002，看到 403 的目录路径要先排查这里。
      // 深层 SPA 路径（如 /admin/user/login）仍然走下面的 setNotFoundHandler。
      index: ['index.html'],
      decorateReply: false,
      // 打包时预压缩的产物（dist/*.br、dist/*.gz）：按 Accept-Encoding 依次尝试
      // .br → .gz → 原文件。比服务器实时压缩省 CPU（演示机只有 4 核），而且能用
      // brotli —— nginx 的动态 gzip 只会出 gzip。
      preCompressed: true,
      // 关掉 send 统一的 `public, max-age=0`，改由下面的 setHeaders 按文件类型决定。
      // send 的响应头是在 setHeaders 之后覆盖写入的，不关掉就改不动。
      cacheControl: false,
      setHeaders(res, path) {
        res.setHeader('cache-control', staticCacheControl(path))
        // 同一个 URL 可能返回 .br / .gz / 原文件三种形态，共享缓存必须知道。
        res.setHeader('vary', 'Accept-Encoding')
      },
    })
    adminScope.setNotFoundHandler(async (request, reply) => {
      // root 模式下 admin 作用域就是整个站点，SPA fallback 会吞掉所有未匹配
      // 路径 —— 包括拼错的 /api/... 。那样调用方拿到的是 index.html + 200，
      // 而不是一个 JSON 404：前端会把它当成功响应去解析，线上排查会被彻底
      // 淹没（"接口调不通"和"页面正常返回"看起来一模一样）。
      //
      // 所以把 API 前缀显式让出去，返回一个 JSON 404。
      // subpath 模式下作用域本就在 /admin 之下，够不到 /api，不需要这个分支。
      //
      // 这里不能写 reply.callNotFound()：它取的是**当前**上下文的 404 handler，
      // 而当前上下文就是这个 adminScope —— 自己调自己，Fastify 只能回落到内置的
      // 默认 404（`404 Not Found`，text/plain），拿不到 app.ts 注册的 envelope。
      // 能走到这里的 /api 请求必然没匹配到任何真实路由（真实路由更具体，先赢），
      // 所以在这里自己拼 envelope 与 create-app.ts 的输出等价。
      if (ADMIN.mount.mode === 'root' && isApiPath(request.url)) {
        return reply.code(404).send({
          success: false,
          code: SystemManageErrorCode.ROUTE_NOT_FOUND,
          message: `Route ${request.method}:${request.url} not found`,
          data: null,
          timestamp: new Date().toISOString(),
        })
      }
      // 不用 reply.sendFile —— 见文件顶部注释（decorateReply=false 时 sendFile
      // 未被装饰，调用会抛 TypeError）。
      const indexPath = join(ADMIN.diskPath, 'index.html')
      const html = await readFile(indexPath, 'utf8')
      // SPA 深链也回 index.html，入口文件不能缓存：它引用的是带 hash 的产物名，
      // 发版后 hash 变了，缓存里的旧入口会指向已经不存在的文件。
      return reply.header('cache-control', 'no-cache').type('text/html; charset=utf-8').send(html)
    })
  }, { prefix: adminPrefix })

  // ─── 3. 生产环境根路径 301 重定向到 admin 入口（仅 subpath 模式） ─
  if (currentSystemRuntime().config.APP_CONFIG.nodeEnv === 'production' && ADMIN.mount.mode === 'subpath' && ADMIN.redirectRoot) {
    const target = ADMIN.mount.path.endsWith('/') ? ADMIN.mount.path : `${ADMIN.mount.path}/`
    fastify.get('/', (_request, reply) => reply.redirect(target, 301))
  }

  // ─── 4. 旧前缀 301 回根路径（仅 root 模式） ────────────────────────
  // root 模式下 admin 占 `/`，产物里 base 也是 `/`，`/admin/...` 不再对应任何
  // 路由，只能落到 SPA 的 404 页。而浏览器书签、聊天记录里的旧链接、以及地址栏
  // 自动补全都还会把用户送过来 —— 表现为「怎么又回到 /admin 了」。
  //
  // 301 而不是让 SPA 自己处理：这是 URL 形态问题，服务端答最准，也不用改前端
  // 产物（重打一次 admin 的成本远高于一个后端热修）。
  //
  // find-my-way 里 `/admin/*` 比 fastify-static 的 `/*` 更具体，所以会赢下路由；
  // 顺序上也必须在这之后注册，root 实例的精确路由优先于静态通配。
  //
  // 重定向时保留后缀：`/admin/system/user` → `/system/user`，而不是把所有人丢到
  // 首页 —— 旧书签指向的是具体页面，直接回首页等于把书签作废。
  if (ADMIN.mount.mode === 'root') {
    fastify.get('/admin', (_request, reply) => reply.redirect('/', 301))
    fastify.get('/admin/*', (request, reply) => {
      const pathname = request.url.split('?', 1)[0]
      const rest = pathname.slice('/admin'.length)
      return reply.redirect(rest.startsWith('/') ? rest : `/${rest}`, 301)
    })
  }
}, {
  name: 'static',
})

async function canReadDir(path: string): Promise<boolean> {
  try {
    await access(path, fsConstants.R_OK)
    return true
  } catch {
    return false
  }
}

/**
 * 产物文件名里带内容 hash（`umi.77499b51.js`、`vendors-async.1eac8b54.js`、
 * `umi.ae2785f3.css`）—— 内容变了文件名就变，可以放心 immutable 一年。
 */
const HASHED_ASSET = /\.[0-9a-f]{8}\.(js|mjs|css)$/;

/**
 * Admin 静态资源的缓存策略。
 *
 * - `index.html` → `no-cache`：它引用带 hash 的产物名，入口必须每次回源校验，
 *   否则发版后用户拿着旧入口去请求已经不存在的旧 hash 文件。
 * - 带 hash 的产物 → 一年 immutable：内容不可变，重复访问零流量。
 * - 其余（`public/` 下直接拷贝的 `scripts/loading.js` 之类，无 hash）→ `max-age=0`，
 *   至少保证回源时能拿到新版本。
 *
 * `path` 在开启 `preCompressed` 时是**实际发送的那个文件**（`xxx.js.br`），
 * 所以要先剥掉压缩后缀再判断。
 */
function staticCacheControl(path: string): string {
  const name = path.replace(/\.(br|gz)$/, '')
  if (name.endsWith('index.html')) return 'no-cache'
  if (HASHED_ASSET.test(name)) return 'public, max-age=31536000, immutable'
  return 'public, max-age=0'
}

/**
 * 判断请求路径是否属于 API 命名空间。
 *
 * 模块路由统一挂在 `/api/<moduleId>` 下（见 core-api 的 moduleRoutePrefix），
 * 但产品可以自定义 module.prefix，所以这里只守住 `/api` 这一段公共前缀 ——
 * 粒度再细就得知道全部模块列表，而 static 插件拿不到那份运行时信息。
 * query string 不参与判断。
 */
function isApiPath(url: string): boolean {
  const pathname = url.split('?', 1)[0]
  return pathname === '/api' || pathname.startsWith('/api/')
}
