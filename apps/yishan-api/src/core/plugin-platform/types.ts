export interface PluginPermission {
  code: string;
  label: string;
  description?: string;
  group?: string;
}

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
  /** Immutable namespace for plugin-owned database objects (for example, ys_shop). */
  dbNamespace: string
  coreCompatibility?: string
  compatRange?: string
  channels?: string[]
  routeBase?: string
  icon?: string
  /**
   * 插件声明的权限列表。
   * 必须使用结构化对象数组格式，不兼容 string[]。
   * 每个权限对象必须包含 code（唯一标识）和 label（UI 展示）。
   */
  permissions: PluginPermission[]
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
