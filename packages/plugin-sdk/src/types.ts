/**
 * The single source of truth for plugin shape across the baseline.
 *
 * Plugin authors implement a default export matching this type by calling
 * `definePlugin(...)`. Core, CLI tools, and the catalog generator all read
 * this type — there is no parallel admin manifest, no parallel OpenAPI
 * metadata, no parallel route declaration.
 *
 * See specs/baseline-v2/decisions/ADR-002-plugin-sdk.md and PLUGIN_CONTRACT.md.
 */

export type PluginKind = 'sample' | 'production'

export interface PluginPermission {
  code: string
  label: string
  description?: string
  group?: string
}

export interface PluginMenuItem {
  channel: 'admin' | 'app'
  path: string
  name: string
  permissionCodes: string[]
  icon?: string
}

export interface PluginApiConfig {
  prefix: string  // e.g. /api/plugins/yishan/hello/v1
}

export interface PluginDatabaseConfig {
  namespace: string  // e.g. ys_hello
}

export interface PluginAdminConfig {
  routes: () => Promise<{ default: unknown }>  // admin/routes.ts dynamic import
}

export interface PluginAppConfig {
  pages?: () => Promise<{ default: unknown }>
}

export interface PluginManifest {
  id: string                        // ^[\w-]+/[\w-]+$
  version: string                   // semver
  coreVersion: string               // semver range
  kind?: PluginKind                 // defaults to 'production'
  api?: PluginApiConfig
  database?: PluginDatabaseConfig
  permissions: PluginPermission[]
  menus: PluginMenuItem[]
  admin?: PluginAdminConfig
  app?: PluginAppConfig
  migrations?: string               // relative path
  seed?: string                     // relative path
}