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

import type { FastifyPluginAsync } from 'fastify'

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
  /**
   * The plugin's runtime entry. Core awaits this, takes the default export
   * (a Fastify plugin), and mounts it under `prefix` inside the Core-owned
   * plugin gate. The plugin never wires the gate itself — see
   * PLUGIN_CONTRACT.md §9 and ADR-003.
   */
  register: () => Promise<{ default: FastifyPluginAsync }>
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
  // —— SDK-native fields（与 plugin-platform legacy 兼容）——
  name?: string                     // 默认从 id 末段派生；plugin-platform 旧 runtime 需要
  database?: PluginDatabaseConfig
  api: PluginApiConfig              // required: the plugin's runtime entry + prefix
  permissions: PluginPermission[]
  menus: PluginMenuItem[]
  admin?: PluginAdminConfig
  app?: PluginAppConfig
  migrations?: string               // relative path
  seed?: string                     // relative path
  // —— legacy 字段（Wave 4 完全删除）——
  /** @deprecated derive from id; will be removed in Wave 4 */
  channels?: string[]
  /** @deprecated use api.prefix; will be removed in Wave 4 */
  routeBase?: string
  /** @deprecated use menus[].icon; will be removed in Wave 4 */
  icon?: string
  /** @deprecated use menus[].name at top level; will be removed in Wave 4 */
  menuRootName?: string
  /** @deprecated use a separate menu priority field; will be removed in Wave 4 */
  menuRootSort?: number
}