import 'dotenv/config'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path';
import AutoLoad, { AutoloadPluginOptions } from '@fastify/autoload'
import { FastifyPluginAsync, FastifyServerOptions } from 'fastify'
import { createPluginRuntime } from './core/plugin-platform'
import type { PluginRuntime } from './core/plugin-platform'
import { PluginMenuSyncService } from './core/services/plugin-menu-sync.service.js'
import { assertJwtSecretOrThrow } from './core/plugins/external/jwt-secret-validator.js'
import { initGlobalCatalog } from './core/services/permission-catalog.service.js'
import { getEnabledPluginNames } from './core/plugin-platform/startup-state.js'

export interface AppOptions extends FastifyServerOptions, Partial<AutoloadPluginOptions> {

}
// Pass --options via CLI arguments in command to enable these options.
const options: AppOptions = {
}

/**
 * Section 2 安全门禁：生产环境使用默认 / 弱 JWT secret 直接拒绝启动。
 * 本地开发与 CI 环境（NODE_ENV ≠ production）只警告，不阻塞。
 *
 * 校验器实现（jwt-secret-validator.ts）已统一为不抛错：
 *   - production + 弱/空/默认 → throws（被下方 catch 转 exit(1)）
 *   - non-production + 弱/空/默认 → { ok: false, reason } → console.warn，继续启动
 *   - strong secret → { ok: true } → 静默通过
 */
try {
  const check = assertJwtSecretOrThrow();
  if (!check.ok) {
    // eslint-disable-next-line no-console
    console.warn(`[startup] ${check.reason ?? "weak JWT secret"}; allow because NODE_ENV != production. Set JWT_SECRET to a strong secret.`);
  }
} catch (err) {
  // eslint-disable-next-line no-console
  console.error((err as Error).message);
  process.exit(1);
}

const app: FastifyPluginAsync<AppOptions> = async (
  fastify,
  opts
): Promise<void> => {
  // Place here your custom code!
  const pluginRuntime = createPluginRuntime({ logger: fastify.log })
  fastify.decorate('pluginRuntime', pluginRuntime)

  // Wave 2: catalog-driven plugin discovery. The old `pluginRuntime.scan()`
  // (which read `apps/yishan-api/src/plugins/modules/`) is intentionally NOT
  // called here — plugins now live under `plugins/<vendor>/<slug>/plugin.ts`
  // and are picked up from the catalog emitted at profile build time.
  //
  // See specs/baseline-v2/decisions/ADR-002 + ADR-003 for the design.
  const repoRoot = join(__dirname, '..', '..', '..')
  const catalogPath = join(repoRoot, 'artifacts', 'plugin-catalog.json')
  interface CatalogEntry { id: string; kind?: 'sample' | 'production' }
  interface CatalogShape { plugins: CatalogEntry[] }
  let catalog: CatalogShape = { plugins: [] }
  try {
    catalog = JSON.parse(readFileSync(catalogPath, 'utf8')) as CatalogShape
  } catch {
    // Catalog missing — empty plugin set (dev/local mode without profile build).
  }

  const discoveredManifests: Array<{ manifest: any; moduleName: string }> = []
  // Phase 1: register + load (not yet enable). Plugin lifecycle in this
  // codebase uses the legacy `name` field (e.g. `hello`) for
  // `register()/lifecycle.load()/lifecycle.enable()` lookups; the new SDK
  // identifier is `yishan/hello`. We derive the runtime `name` from the
  // catalog id's trailing slug to keep both layers compatible.
  for (const entry of catalog.plugins) {
    try {
      const manifestPath = join(repoRoot, 'plugins', entry.id, 'plugin.ts')
      const mod = (await import(manifestPath)) as { default?: any }
      const manifest = mod.default
      if (!manifest || typeof manifest !== 'object') {
        throw new Error(`plugin manifest missing default export at ${manifestPath}`)
      }
      const moduleName = manifest.id.split('/').pop() ?? manifest.id
      discoveredManifests.push({ manifest, moduleName })
      pluginRuntime.register(manifest)
      pluginRuntime.lifecycle.load(moduleName)
      await pluginRuntime.persistence.syncManifest(manifest)
      fastify.log.info({ plugin: manifest.id, module: moduleName }, 'plugin manifest registered')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown plugin runtime error'
      fastify.log.warn({ plugin: entry.id, error: message }, 'plugin manifest registration failed')
    }
  }

  // Do not touch the following lines

  // 读取数据库 plugin state 快照（strict reader，失败即拒绝启动）
  const pluginStateSnapshots = await pluginRuntime.persistence.listPluginStatesStrict()

  // 初始化全局权限目录（在所有插件注册之后、路由开始之前）
  // 权限目录必须基于数据库中的启用状态构建，未初始化会抛错
  await initGlobalCatalog(
    () => pluginRuntime.persistence.listPluginStatesStrict(),
    { listManifests: () => pluginRuntime.registry.list().map(p => p.manifest) }
  )

  // Phase 3: 按数据库中的 enabled 决定 runtime 状态（不调用 enable 的插件保持 disabled）。
  // 使用 startup-state 纯函数计算启用集合，禁止再次回写数据库。
  const enabledPluginNames = getEnabledPluginNames(
    discoveredManifests.map((item) => item.manifest),
    pluginStateSnapshots,
  )
  for (const item of discoveredManifests) {
    if (enabledPluginNames.has(item.manifest.name)) {
      pluginRuntime.lifecycle.enable(item.manifest.name)
    }
  }

  // Phase 4: 菜单同步仅针对数据库中 enabled 的插件
  for (const item of discoveredManifests) {
    if (!enabledPluginNames.has(item.manifest.name)) continue
    try {
      const menuSyncStartedAt = Date.now()
      fastify.log.info({ plugin: item.manifest.name }, 'plugin menu sync start')
      const menuSync = new PluginMenuSyncService()
      await menuSync.syncPluginMenus(item.manifest, 1)
      fastify.log.info(
        { plugin: item.manifest.name, ms: Date.now() - menuSyncStartedAt },
        'plugin menu sync done'
      )
    } catch (menuSyncError) {
      fastify.log.warn(
        {
          plugin: item.manifest.name,
          error: menuSyncError instanceof Error ? menuSyncError.message : String(menuSyncError),
          errorName: menuSyncError instanceof Error ? menuSyncError.name : 'UnknownError'
        },
        'plugin menu sync skipped'
      )
    }
  }

  // This loads all external plugins defined in core/plugins/external
  // those should be registered first as your application plugins might depend on them
  await fastify.register(AutoLoad, {
    dir: join(__dirname, 'core/plugins/external'),
    options: {}
  })

  // This loads all your application plugins defined in core/plugins/app
  // those should be support plugins that are reused
  // through your application
  fastify.register(AutoLoad, {
    dir: join(__dirname, 'core/plugins/app'),
    options: { ...opts }
  })

  // Wave 2: catalog-driven route mount. Each discovered plugin's
  // `plugins/<id>/api/{plugins/external,plugins/app,routes}` directory is
  // mounted via AutoLoad with `manifest.api.prefix` as the mount point.
  for (const item of discoveredManifests) {
    const apiDir = join(repoRoot, 'plugins', item.manifest.id, 'api')
    const moduleExternalPlugins = join(apiDir, 'plugins/external')
    const moduleAppPlugins = join(apiDir, 'plugins/app')
    const moduleRoutes = join(apiDir, 'routes')

    if (existsSync(moduleExternalPlugins)) {
      await fastify.register(AutoLoad, {
        dir: moduleExternalPlugins,
        options: { ...opts }
      })
    }

    if (existsSync(moduleAppPlugins)) {
      // Module schemas/decorators must be registered before their route tree
      // is loaded; otherwise route $ref validation can run first.
      await fastify.register(AutoLoad, {
        dir: moduleAppPlugins,
        options: { ...opts }
      })
    }

    if (existsSync(moduleRoutes)) {
      // `manifest.api.prefix` pins `/api/plugins/<id>/v1` per the SDK
      // contract. `@fastify/autoload` walks the directory tree of
      // `routes/...` and *appends* each path segment to the prefix;
      // with `plugins/yishan/hello/api/routes/v1/admin/index.ts` the
      // traversal already inserts `v1/admin`, so the AutoLoad prefix
      // must stop BEFORE the version segment, otherwise we'd emit
      // `/api/plugins/yishan/hello/v1/v1/admin/`.
      const apiPrefix = item.manifest.api?.prefix ?? `/api/plugins/${item.manifest.id}/v1`
      const fastifyPrefix = apiPrefix
        .replace(/^\/api\//, '')
        .replace(/\/v\d+.*$/, '')
      fastify.register(AutoLoad, {
        dir: moduleRoutes,
        autoHooks: true,
        cascadeHooks: true,
        options: { ...opts, prefix: fastifyPrefix }
      })
    }
  }

  // This loads all plugins defined in core/routes
  // define your routes in one of these
  // eslint-disable-next-line no-void
  void fastify.register(AutoLoad, {
    dir: join(__dirname, 'core/routes'),
    autoHooks: true,
    cascadeHooks: true,
    options: opts
  })
}

export default app
export { app, options }

declare module 'fastify' {
  interface FastifyInstance {
    pluginRuntime: PluginRuntime
  }
}
