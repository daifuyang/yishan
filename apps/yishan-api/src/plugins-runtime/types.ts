export interface PluginMenuItem {
  channel: string
  path: string
  name: string
  perm?: string
  icon?: string
}

export interface PluginManifest {
  pluginId: string
  name: string
  menuRootName?: string
  menuRootIcon?: string
  menuRootSort?: number
  version: string
  coreCompatibility?: string
  compatRange?: string
  channels?: string[]
  routeBase?: string
  icon?: string
  permissions?: string[]
  menus?: PluginMenuItem[]
}

export type PluginLifecycleState =
  | 'discovered'
  | 'loaded'
  | 'enabled'
  | 'disabled'
  | 'unloaded'
  | 'error'

export interface RegisteredPlugin {
  manifest: PluginManifest
  state: PluginLifecycleState
  error?: string
}

export interface HookEvent<T = unknown> {
  name: string
  payload: T
}

export type HookHandler<T = unknown> = (event: HookEvent<T>) => void | Promise<void>

export interface HookRegistration<T = unknown> {
  handler: HookHandler<T>
  priority: number
}

export interface ManifestValidationResult {
  valid: boolean
  errors: string[]
}

export interface LoadedPluginManifest {
  moduleName: string
  manifestPath: string
  manifest: PluginManifest
}

export interface PluginPersistenceRecord {
  pluginId: string
  name: string
  version: string
  coreCompatibility?: string
  compatRange?: string
  routeBase?: string
  lifecycleState: PluginLifecycleState
  enabled: boolean
  lastError?: string
}
