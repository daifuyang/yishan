// Wave 2 — hello plugin manifest under `plugins/<vendor>/<slug>/plugin.ts`.
//
// This file is the single source of truth for hello (merging what used to be
// `apps/yishan-api/src/plugins/modules/hello/manifest.ts` and
// `apps/yishan-admin/src/plugins/modules/hello.manifest.ts`). The catalog
// generator reads this manifest at profile build time; `apps/yishan-api/src/app.ts`
// reads the catalog at boot time and dynamically imports this file.
//
// SDK contract: see `packages/plugin-sdk/src/types.ts` (PluginManifest).
//
// Currently the SDK is a noEmit TypeScript package; to keep `definePlugin`
// loadable without a runtime require to `packages/plugin-sdk/src/index.ts`
// (which Node cannot resolve as .ts), we inline the identity function. The
// final Wave 2 (post workspace reference) swap is tracked separately.

import type { PluginManifest } from '../../../packages/plugin-sdk/src/types.ts'

// Runtime identity function — same semantics as `definePlugin` from the SDK.
// We re-declare it here so the plugin file is self-sufficient at runtime.
function definePlugin<T extends PluginManifest>(manifest: T): T {
  return manifest
}

// Inlined permission helper. The plugin lives outside `apps/yishan-api/src/`
// and is loaded either (a) by vitest at test time, (b) by `app.ts` via
// dynamic `import()`, or (c) by the admin `generate-plugin-routes.mjs`
// script via `data:` URL transpilation — none of which can resolve a
// relative `from '../../apps/yishan-api/src/...'` import. Re-declaring the
// `definePermissions` helper here keeps the plugin file completely
// self-contained. Once Wave 3 splits this into a shared package, replace
// with an `import { definePermissions } from '@yishan/permissions'`.
interface PermissionRef { readonly code: string; readonly label: string; readonly group: string; readonly description?: string }
function definePermissions<T extends Record<string, PermissionRef>>(permissions: T): Readonly<T> {
  const codes = new Set<string>()
  for (const permission of Object.values(permissions)) {
    if (!permission.code || !permission.label || !permission.group) {
      throw new Error('permission declarations require code, label and group')
    }
    if (codes.has(permission.code)) {
      throw new Error(`duplicate permission declaration: ${permission.code}`)
    }
    codes.add(permission.code)
    Object.freeze(permission)
  }
  return Object.freeze(permissions)
}

/**
 * helloPermissions is the structured permission object used by both the
 * `permissions` array in the manifest (below) and by the hello routes at
 * `api/routes/v1/admin/index.ts`. Routes import this named export via
 * `import { helloPermissions } from '../../../plugin.js'`.
 */
export const helloPermissions = definePermissions({
  HEALTH_READ: {
    code: 'hello:health:read',
    label: '健康检查-读取',
    description: '读取 Hello 示例插件状态',
    group: 'hello',
  },
})

const helloMenuCode = helloPermissions.HEALTH_READ.code

/**
 * hello plugin manifest — single source of truth.
 *
 * The manifest object intentionally carries fields from both layers:
 *   - SDK surface (id, version, coreVersion, kind, api, database, …)
 *   - Legacy `apps/yishan-api/src/core/plugin-platform` runtime surface
 *     (pluginId, name, dbNamespace, coreCompatibility, compatRange, …)
 *
 * The object literal is shaped as `Record<string, unknown>` so TypeScript
 * does not flag the extras; the runtime identifies the layer by which
 * fields it consumes. We re-cast to `PluginManifest` for the default export
 * so downstream SDK consumers see a strictly-typed view.
 *
 * Compatibility field set:
 *   - The SDK's `PluginManifest` only carries `id`, `version`,
 *     `coreVersion`, `kind`, `api`, `database`, `permissions`, `menus`,
 *     `admin`, `app`, `migrations`, `seed`.
 *   - The Wave 2 legacy runtime at
 *     `apps/yishan-api/src/core/plugin-platform` still validates against
 *     `pluginId + name + dbNamespace + compatRange + coreCompatibility`
 *     (see `core/plugin-platform/manifest.ts`). Until Wave 3 retires that
 *     layer, we mirror those fields on the same object so the catalog
 *     pipeline can hand it directly to `pluginRuntime.register(...)`.
 *
 * The admin route declaration (formerly
 * `apps/yishan-admin/src/plugins/modules/hello.manifest.ts`) is preserved
 * as a deferred dynamic import via `admin.routes()`. Stage B will migrate
 * the actual page file to `plugins/yishan/hello/admin/pages/`.
 */
const manifest = definePlugin({
  id: 'yishan/hello',
  name: 'hello',
  pluginId: 'yishan/hello',
  dbNamespace: 'ys_hello',
  coreCompatibility: '^2.0.0',
  compatRange: '^2.0.0',
  icon: 'smile',
  channels: ['admin'],
  routeBase: '/api/plugins/yishan/hello/v1',
  menuRootName: 'Hello 示例',
  menuRootSort: 21,
  version: '1.0.0',
  coreVersion: '^2.0.0',
  kind: 'sample',
  api: {
    prefix: '/api/plugins/yishan/hello/v1',
  },
  database: {
    namespace: 'ys_hello',
  },
  permissions: [helloPermissions.HEALTH_READ],
  menus: [
    {
      channel: 'admin',
      path: '/plugins/yishan/hello/health',
      name: 'Hello Health',
      permissionCodes: [helloMenuCode],
      icon: 'smile',
    },
  ],
  admin: {
    /**
     * Dynamic load the admin-side route manifest. The `access: 'canDo'` field
     * is admin-specific (umi `config/routes.ts` semantics) and intentionally
     * not part of PluginManifest types. It returns the legacy admin manifest
     * shape so that `apps/yishan-admin/scripts/generate-plugin-routes.mjs`
     * can read it during its catalog-driven regeneration.
     */
    routes: async () => {
      const adminManifest = {
        name: 'hello',
        version: '1.0.0',
        coreCompatibility: '^2.0.0',
        routes: [
          {
            path: '/plugins/yishan/hello/health',
            component: './hello/health',
            access: 'canDo',
          },
        ],
      }
      return { default: adminManifest }
    },
  },
  migrations: './migrations',
})

export default manifest as PluginManifest
