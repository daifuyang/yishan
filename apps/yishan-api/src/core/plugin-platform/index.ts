import { HookBus } from './hooks'
import { PluginLifecycle } from './lifecycle'
import { loadPluginManifests } from './loader'
import { validateManifest } from './manifest'
import { createPluginPersistenceService, PluginPersistenceService } from './persistence'
import { PluginRegistry } from './registry'
import { LoadedPluginManifest, PluginManifest, RegisteredPlugin } from './types'

export * from './types'
export * from './manifest'
export * from './registry'
export * from './lifecycle'
export * from './hooks'
export * from './loader'
export * from './persistence'

export interface PluginRuntime {
  registry: PluginRegistry
  lifecycle: PluginLifecycle
  hooks: HookBus
  persistence: PluginPersistenceService
  register(manifest: PluginManifest): RegisteredPlugin
  scan(modulesDir: string): LoadedPluginManifest[]
}

export interface CreatePluginRuntimeOptions {
  logger?: { warn: (obj: unknown, msg?: string) => void }
}

export function createPluginRuntime(options: CreatePluginRuntimeOptions = {}): PluginRuntime {
  const registry = new PluginRegistry()
  const lifecycle = new PluginLifecycle(registry)
  const hooks = new HookBus()
  const persistence = createPluginPersistenceService(options.logger)

  return {
    registry,
    lifecycle,
    hooks,
    persistence,
    register(manifest) {
      const validation = validateManifest(manifest)
      if (!validation.valid) {
        throw new Error(`invalid plugin manifest ${manifest?.name ?? '<unknown>'}: ${validation.errors.join('; ')}`)
      }
      return registry.register(manifest, 'discovered')
    },
    scan(modulesDir) {
      return loadPluginManifests(modulesDir)
    }
  }
}
