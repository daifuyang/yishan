import 'dotenv/config'
import AutoLoad, { AutoloadPluginOptions } from '@fastify/autoload'
import { FastifyPluginAsync, FastifyServerOptions } from 'fastify'
import { join, sep } from 'node:path'
import { assertJwtSecretOrThrow } from './core/plugins/external/jwt-secret-validator.js'
import { ModuleLoader } from './core/module-loader/module-loader.js'
import { SystemManageErrorCode } from './constants/business-codes/system.js'

// 应用根目录（dist/）和源码根目录（src/）。dev 路由需要扫描 src/modules/ 读迁移 journal；
// 用装饰器挂出来，避免每个 dev 路由文件自己数 '../'。
const APP_ROOT_DIST = __dirname
const APP_ROOT_SRC = join(__dirname, '..', 'src')

/**
 * Section 2 安全门禁：生产环境使用默认 / 弱 JWT secret 直接拒绝启动。
 * 本地开发与 CI 环境（NODE_ENV ≠ production）只警告，不阻塞。
 */
try {
  const check = assertJwtSecretOrThrow()
  if (!check.ok) {
    // eslint-disable-next-line no-console
    console.warn(`[startup] ${check.reason ?? 'weak JWT secret'}; allow because NODE_ENV != production. Set JWT_SECRET to a strong secret.`)
  }
} catch (err) {
  // eslint-disable-next-line no-console
  console.error((err as Error).message)
  process.exit(1)
}

export interface AppOptions extends FastifyServerOptions, Partial<AutoloadPluginOptions> { }
const options: AppOptions = {}

const app: FastifyPluginAsync<AppOptions> = async (fastify, opts): Promise<void> => {
  // 1. External Fastify plugins (cors / jwt / redis / multipart / ...) — registered first
  //    so application routes can rely on their decorators and preHandlers.
  await fastify.register(AutoLoad, {
    dir: join(__dirname, 'core/plugins/external'),
    options: {},
  })

  // 2. Reusable application helpers shared across routes.
  fastify.register(AutoLoad, {
    dir: join(__dirname, 'core/plugins/app'),
    options: { ...opts },
  })

  // 2.5 数据库句柄暴露：core/plugins/external/database.ts 已经在 register 时
  //     装饰了 fastify.db 与 fastify.drizzleDb。

  // 2.6 显式构造 ModuleLoader 并挂到 fastify 装饰器上。
  //     显式 register 比依赖 autoload 排序更稳——boot 阶段立即可用。
  //     路由 prefix 硬约定为 `/api/${id}`（见 core/module-loader.ts moduleRoutePrefix），
  //     不再做跨模块 prefix 唯一性校验（id 唯一性由文件系统保证）。
  const moduleLoader = new ModuleLoader(fastify, APP_ROOT_SRC, APP_ROOT_DIST)
  fastify.decorate('moduleLoader', moduleLoader)
  fastify.decorate('appRootDist', APP_ROOT_DIST)
  fastify.decorate('appRootSrc', APP_ROOT_SRC)

  // 3. 业务模块：sync DB → 无条件挂载所有【已打包在盘上】的模块。
  //    运行时启停不改挂载（fastify 插件树 boot 后不可变），由 onRequest gate
  //    按 sys_module.enabled 拦截实现，即时生效、零重启。
  const diskModules = await fastify.moduleLoader.scanDiskModules()
  fastify.log.info({ count: diskModules.length }, 'disk modules scanned')
  await fastify.moduleLoader.syncModulesFromDisk(diskModules)

  // 3.5 模块启停 gate：先于任何路由挂载在 root 注册 onRequest（root hook + 提前注册，
  //     才能覆盖后续挂载的模块子上下文；listModuleIds/enabled 都在请求期求值）。
  //     命中 /api/<moduleId>/... 且该模块 enabled=false → 直接 404。
  //     core 路由（/api/v1/...、/api/docs 等）首段不是模块 id，放行。
  fastify.addHook('onRequest', async (request, reply) => {
    const moduleIds = fastify.moduleLoader.listModuleIds()
    if (moduleIds.size === 0) return
    const match = /^\/api\/([^/?#]+)/.exec(request.url)
    if (!match) return
    const seg = match[1]
    if (!moduleIds.has(seg)) return
    const enabled = await fastify.moduleLoader.enabledIdsCached()
    if (!enabled.has(seg)) {
      reply.code(404).send({
        success: false,
        code: 40400,
        message: `模块未启用：${seg}`,
        data: null,
        timestamp: new Date().toISOString(),
      })
      return reply
    }
  })

  // 3.6 onRoute hook：自动为鉴权路由注入 security 声明。
  //     这个 hook 必须在挂载模块路由之前注册，并且要在 app 上下文（route 的公共祖先）
  //     而非兄弟上下文中，才能被 module/autoload 子上下文中的路由触发。
  //     restish 等 OpenAPI 客户端不解析全局 security 继承（OpenAPI 3.0 规范承认但
  //     客户端实现参差不齐），因此需要每个 operation 显式声明 security。
  //     逻辑：检查 route.preHandler 中是否存在 authenticate 或 softAuthenticate
  //     （函数名来自 jwt-auth.ts 中 decorate 的 named function），如果存在且
  //     schema 没有 security 字段，注入 [{ bearerAuth: [] }]。
  fastify.addHook('onRoute', (route) => {
    const handlers: any[] = Array.isArray(route.preHandler) ? route.preHandler : []
    const names = handlers.map((h: any) => h?.name ?? h?.toString?.()?.slice(0, 30) ?? '?')
    const hasAuth = names.includes('authenticate')
    const hasSoftAuth = names.includes('softAuthenticate')
    if ((hasAuth || hasSoftAuth) && route.schema && !route.schema.security) {
      route.schema.security = [{ bearerAuth: [] }]
    }
  })

  // 3.7 挂载模块路由（gate 已就位）。
  await fastify.moduleLoader.mountAllOnDisk(diskModules)

  // 3.7 全局 not-found handler：Fastify 默认的 notFound 绕过 global error handler，
  //     会返回 `{message, error, statusCode}` 这种非 envelope 格式。
  //     注册一个与项目 envelope 一致的 404 处理器，并把模块启停 gate 的 `code=40400` 与
  //     本处的 `code=25005` 区分开：前者是"模块被禁用"，后者是"路由真的不存在"。
  fastify.setNotFoundHandler((request, reply) => {
    reply.code(404).send({
      success: false,
      code: SystemManageErrorCode.ROUTE_NOT_FOUND,
      message: `Route ${request.method}:${request.url} not found`,
      data: null,
      timestamp: new Date().toISOString(),
    })
  })

  // 4. Core HTTP routes — single source of truth for in-app endpoints.
  //    dev-only 工具（_dev/ 子树，如模块管理 /system/module-management）在生产不加载：
  //      - 既不 import 文件 → registerPermissions 副作用不发生 → perm 不进 catalog
  //      - 也不注册路由 → fastify 直接返回 404 → OpenAPI 不暴露对应 path
  //    生产环境由 menu.service 的 devOnlyMenuIds 兜底隐藏菜单项，前端 page-level guard
  //    再做一次拦截，三层防御。
  //    注意：_dev/ 内的目录结构必须镜像 core/routes/ 下的真实结构（api/v1/admin/...），
  //    这样下方的条件 autoload 才能复用同一 URL 前缀（/api/v1/admin/system/module-management/...）。
  // eslint-disable-next-line no-void
  void fastify.register(AutoLoad, {
    dir: join(__dirname, 'core/routes'),
    // 跳过 _dev/ 子树（_dev/<...>/<file>.ts）；下方的条件 autoload 单独处理 dev 路由。
    ignoreFilter: (filepath) => filepath.includes(`${sep}_dev${sep}`),
    autoHooks: true,
    cascadeHooks: true,
    options: opts,
  })

  // 4.5 Dev-only 路由（模块控制台等）。NODE_ENV=production 时整套不挂载，
  //     spawn drizzle-kit / node seed.js 在 prod 永远不会触发；prod 镜像也
  //     不带这些 devDeps（参见 deploy/fc3/scripts/build-runtime-layer.sh）。
  if (process.env.NODE_ENV !== 'production') {
    await fastify.register(AutoLoad, {
      dir: join(__dirname, 'core/routes/_dev'),
      autoHooks: true,
      cascadeHooks: true,
      options: opts,
    })
  }
}

export default app
export { app, options }
