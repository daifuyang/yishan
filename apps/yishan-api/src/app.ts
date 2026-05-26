import 'dotenv/config'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path';
import AutoLoad, { AutoloadPluginOptions } from '@fastify/autoload'
import { FastifyPluginAsync, FastifyServerOptions } from 'fastify'
import { createPluginRuntime } from './plugins-runtime'
import type { PluginRuntime } from './plugins-runtime'
import { PluginMenuSyncService } from './core/services/plugin-menu-sync.service.js'

export interface AppOptions extends FastifyServerOptions, Partial<AutoloadPluginOptions> {

}
// Pass --options via CLI arguments in command to enable these options.
const options: AppOptions = {
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
  for (const item of discoveredManifests) {
    try {
      pluginRuntime.register(item.manifest)
      pluginRuntime.lifecycle.load(item.manifest.name)
      pluginRuntime.lifecycle.enable(item.manifest.name)
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

  fastify.addHook('onReady', async () => {
    for (const item of discoveredManifests) {
      try {
        await pluginRuntime.persistence.syncManifest(item.manifest)
        const record = pluginRuntime.registry.get(item.manifest.name)
        await pluginRuntime.persistence.updateRuntimeState(
          item.manifest.pluginId,
          item.manifest.name,
          record?.state ?? 'discovered',
          record?.state === 'enabled',
          record?.error
        )
      } catch (error) {
        fastify.log.warn(
          { plugin: item.manifest.name, error: error instanceof Error ? error.message : error },
          'plugin persistence sync skipped during startup'
        )
      }
    }
  })
}

export default app
export { app, options }

declare module 'fastify' {
  interface FastifyInstance {
    pluginRuntime: PluginRuntime
  }
}
