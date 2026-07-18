import 'dotenv/config'
import { existsSync, readdirSync, statSync } from 'node:fs'
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

  const pluginManifestModulesDir = join(__dirname, 'plugins/modules')
  const discoveredManifests = pluginRuntime.scan(pluginManifestModulesDir)
  // Phase 1: register + load（不 enable），同步 manifest 到数据库
  for (const item of discoveredManifests) {
    try {
      pluginRuntime.register(item.manifest)
      pluginRuntime.lifecycle.load(item.manifest.name)
      await pluginRuntime.persistence.syncManifest(item.manifest)
      fastify.log.info({ plugin: item.manifest.name, module: item.moduleName }, 'plugin manifest registered')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown plugin runtime error'
      const pluginName = item.manifest.name || item.moduleName
      if (pluginRuntime.registry.get(pluginName)) {
        pluginRuntime.registry.updateState(pluginName, 'error', message)
      }
      fastify.log.warn({ plugin: pluginName, module: item.moduleName, error: message }, 'plugin manifest registration failed')
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

  const modulesDir = join(__dirname, 'plugins/modules')
  if (existsSync(modulesDir)) {
    const moduleNames = readdirSync(modulesDir).filter((name) => statSync(join(modulesDir, name)).isDirectory())

    for (const moduleName of moduleNames) {
      const moduleRoot = join(modulesDir, moduleName)
      const moduleExternalPlugins = join(moduleRoot, 'plugins/external')
      const moduleAppPlugins = join(moduleRoot, 'plugins/app')
      const moduleRoutes = join(moduleRoot, 'routes')

      if (existsSync(moduleExternalPlugins)) {
        await fastify.register(AutoLoad, {
          dir: moduleExternalPlugins,
          options: { ...opts }
        })
      }

      if (existsSync(moduleAppPlugins)) {
        fastify.register(AutoLoad, {
          dir: moduleAppPlugins,
          options: { ...opts }
        })
      }

      if (existsSync(moduleRoutes)) {
        fastify.register(AutoLoad, {
          dir: moduleRoutes,
          autoHooks: true,
          cascadeHooks: true,
          options: { ...opts, prefix: `api/modules/${moduleName}` }
        })
      }
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
