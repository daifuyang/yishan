// Wave 3 — hello plugin manifest under `plugins/<vendor>/<slug>/plugin.ts`.
//
// This file is the single source of truth for hello. The catalog generator
// reads this manifest at profile build time; `apps/yishan-api/src/app.ts`
// reads the catalog at boot time and dynamically imports this file.
//
// SDK contract: see `packages/plugin-sdk/src/types.ts` (PluginManifest).
//
// Currently the SDK is a noEmit TypeScript package; to keep `definePlugin`
// loadable without a runtime require to `packages/plugin-sdk/src/index.ts`
// (which Node cannot resolve as .ts), we inline the identity function. The
// final Wave 2 (post workspace reference) swap is tracked separately.
//
// IMPORTANT — legacy mirror fields:
//   The fields `pluginId`, `name`, `dbNamespace`, and `routeBase` below
//   mirror SDK-derived values and exist ONLY to satisfy the legacy
//   `apps/yishan-api/src/core/plugin-platform` runtime validator and the
//   sys_plugin DB persistence. They are marked `/** @deprecated */` and
//   will be removed in Wave 4 once the legacy runtime layer is retired.
//   The SDK's `PluginManifest` already covers the canonical representation
//   (id, version, coreVersion, database.namespace, api.prefix, …).
//
//   `definePermissions` is also inlined (rather than imported from the SDK
//   package) because the admin `generate-plugin-routes.mjs` script loads
//   this file via `data:` URL transpilation and cannot resolve cross-package
//   relative imports at runtime.

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
 * `import { helloPermissions } from '../../../../plugin.js'`.
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
 * Carries both SDK surface fields and the legacy mirror fields required
 * by `apps/yishan-api/src/core/plugin-platform` (pluginId, name,
 * dbNamespace, routeBase). The deprecated mirrors will be removed in Wave 4.
 */
const manifest = definePlugin({
  id: 'yishan/hello',
  version: '1.0.0',
  coreVersion: '^2.0.0',
  kind: 'sample',
  api: {
    prefix: '/api/plugins/yishan/hello/v1',
    // Core awaits this, takes the default export (a Fastify plugin), and
    // mounts it under `prefix` inside the Core-owned gate. The plugin does
    // NOT call registerPlugin/pluginGate itself — Core owns the gate.
    register: () => import('./api/register.js'),
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
  // —— legacy mirror fields ——
  // Kept until Wave 4 retires apps/yishan-api/src/core/plugin-platform and
  // the sys_plugin row's route_base column. Each value is derivable from
  // SDK fields above; do not consume these fields in new code.
  /** @deprecated derive from `id`; will be removed in Wave 4 */
  name: 'hello',
  /** @deprecated derive from `id`; will be removed in Wave 4 */
  pluginId: 'yishan/hello',
  /** @deprecated derive from `database.namespace`; will be removed in Wave 4 */
  dbNamespace: 'ys_hello',
  /** @deprecated derive from `api.prefix`; will be removed in Wave 4 */
  routeBase: '/api/plugins/yishan/hello/v1',
})

export default manifest as PluginManifest