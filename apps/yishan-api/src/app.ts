import 'dotenv/config'
import { existsSync, readFileSync } from 'node:fs'
import { join, sep } from 'node:path';
import AutoLoad, { AutoloadPluginOptions } from '@fastify/autoload'
import { FastifyPluginAsync, FastifyServerOptions } from 'fastify'
import { createPluginRuntime } from './core/plugin-platform'
import type { PluginRuntime } from './core/plugin-platform'
import { PluginMenuSyncService } from './core/services/plugin-menu-sync.service.js'
import { assertJwtSecretOrThrow } from './core/plugins/external/jwt-secret-validator.js'
import { initGlobalCatalog } from './core/services/permission-catalog.service.js'
import { getEnabledPluginNames } from './core/plugin-platform/startup-state.js'
import {
  pluginGate,
  registerPluginGate,
  setPluginState,
  type PluginRuntimeState,
} from './core/middleware/plugin-gate.js'

// Wave 4 SDK validation is intentionally kept inline (rather than
// imported from packages/plugin-sdk) for two reasons:
//   1. packages/plugin-sdk is noEmit; importing it from compiled app.ts
//      forces tsc into mirrored layout (dist/apps/yishan-api/src/...).
//   2. The checks are small enough to live next to the boot path that
//      uses them, and keeping the surface dependency-free matches the
//      rest of `apps/yishan-api/src/core/`. PROPOSAL §2.2 / ADR-002
//      name this alignment as the SDK's whole point.
//
// If a future Wave needs additional SDK checks, restore the import and
// either emit the SDK package or split validation here.
interface SdkValidationIssue {
  field: string
  message: string
}
function validateSdkManifest(manifest: unknown): SdkValidationIssue[] {
  const issues: SdkValidationIssue[] = []
  const m = manifest as Partial<{
    id: string; version: string; coreVersion: string
    permissions: unknown; menus: unknown; api: { prefix?: string }
  }>
  const PLUGIN_ID_RE = /^[\w-]+\/[\w-]+$/
  const SEMVER_RE = /^\d+\.\d+\.\d+/
  const SEMVER_RANGE_RE = /^[\^~]?\d+\.\d+\.\d+/
  if (typeof m.id !== 'string' || !PLUGIN_ID_RE.test(m.id)) {
    issues.push({ field: 'id', message: 'must match ^[\\w-]+/[\\w-]+$' })
  }
  if (typeof m.version !== 'string' || !SEMVER_RE.test(m.version)) {
    issues.push({ field: 'version', message: 'must be semver' })
  }
  if (typeof m.coreVersion !== 'string' || !SEMVER_RANGE_RE.test(m.coreVersion)) {
    issues.push({ field: 'coreVersion', message: 'must be semver range' })
  }
  if (!Array.isArray(m.permissions)) {
    issues.push({ field: 'permissions', message: 'must be an array' })
  }
  if (!Array.isArray(m.menus)) {
    issues.push({ field: 'menus', message: 'must be an array' })
  }
  const apiPrefix = m.api?.prefix
  if (apiPrefix !== undefined) {
    if (typeof apiPrefix !== 'string' || !apiPrefix.startsWith('/api/')) {
      issues.push({ field: 'api.prefix', message: 'must start with /api/' })
    } else if (typeof m.id === 'string' && apiPrefix !== `/api/plugins/${m.id}/v1`) {
      issues.push({
        field: 'api.prefix',
        message: `must equal /api/plugins/${m.id}/v1 (derived from id)`,
      })
    }
  }
  return issues
}

interface CatalogEntry { id: string; kind?: 'sample' | 'production' }
interface CatalogShape { plugins: CatalogEntry[] }

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

  // Wave 4: plugin gate decorator + catalog-driven discovery.
  //
  // ADR-003 §3.2 brings the gate model: each plugin is wrapped in a sub-app
  // whose preHandler checks the in-memory `pluginState` map. Wave 4 only
  // wires boot-time state (catalog ∩ DB enable); runtime enable/disable from
  // admin endpoints will continue to use the same `setPluginState` helper
  // and is a Wave 5 concern.
  registerPluginGate(fastify)

  // Wave 4: release artifact friendly catalog + plugin resolution.
  //
  // The flat dist layout (set via tsconfig rootDir: src) lands compiled
  // code at apps/yishan-api/dist/<src-path>.js; artifacts live adjacent
  // at apps/yishan-api/dist/artifacts/plugin-catalog.json and
  // apps/yishan-api/dist/plugins/<id>/plugin.js (written by the
  // build-plugins companion script). Dev mode (vitest / ts-node)
  // lands src files at apps/yishan-api/src/*.ts; the catalog and
  // plugins live at the monorepo root, i.e. ../../../artifacts/...
  // and ../../../plugins/<id>/plugin.ts.
  const normDir = __dirname.split(sep).join('/')
  const isDist = normDir.includes('/dist/')
  const artifactRoot = isDist
    ? __dirname
    : join(__dirname, '..', '..', '..')
  const catalogPath = join(artifactRoot, 'artifacts', 'plugin-catalog.json')

  // Wave 4 fail-fast (PROPOSAL §11 — no silent degradation on catalog
  // bootstrap errors). Previously the catch swallowed missing/invalid
  // catalog JSON and the API booted with zero plugins, masking release
  // bugs as "no plugins enabled". We now re-throw so the surrounding
  // Fastify boot surfaces the error; the call chain above has already
  // installed the JWT-secret exit-on-failure guard.
  let catalog: CatalogShape
  try {
    catalog = JSON.parse(readFileSync(catalogPath, 'utf8')) as CatalogShape
  } catch (err) {
    fastify.log.error(
      { err, catalogPath },
      'catalog missing or invalid; refusing to boot',
    )
    throw err
  }
  if (!Array.isArray(catalog.plugins) || catalog.plugins.length === 0) {
    throw new Error(`plugin catalog is empty at ${catalogPath}; refusing to boot`)
  }

  const discoveredManifests: Array<{ manifest: any; moduleName: string }> = []
  // Phase 1: register + load (not yet enable). Wave 4 also drives the
  // pluginGate cache from this loop. Disabled/failed catalogs get a
  // `disabled` snapshot at boot, and `enabled` set after the DB state
  // step below. Catalog miss (entry id has no plugin.ts) is fatal.
  for (const entry of catalog.plugins) {
    // Wave 4 note: dev runs (vitest, ts-node) and dist runs share the
    // same layout offset — `__dirname/../../..` reaches the artifact root
    // (monorepo in dev, dist in release). Only the file extension differs.
    const manifestPath = isDist
      ? join(artifactRoot, 'plugins', entry.id, 'plugin.js')
      : join(artifactRoot, 'plugins', entry.id, 'plugin.ts')
    let mod: { default?: any }
    try {
      mod = (await import(manifestPath)) as { default?: any }
    } catch (err) {
      fastify.log.error(
        { err, plugin: entry.id, manifestPath },
        'plugin manifest load failed; refusing to boot',
      )
      throw err
    }
    const manifest = mod.default
    if (!manifest || typeof manifest !== 'object') {
      throw new Error(`plugin manifest missing default export at ${manifestPath}`)
    }
    const issues = validateSdkManifest(manifest)
    if (issues.length > 0) {
      const joined = issues.map((i) => `${i.field}: ${i.message}`).join('; ')
      throw new Error(`plugin ${entry.id} manifest invalid: ${joined}`)
    }
    const moduleName = manifest.id.split('/').pop() ?? manifest.id
    discoveredManifests.push({ manifest, moduleName })
    pluginRuntime.register(manifest)
    pluginRuntime.lifecycle.load(moduleName)
    // DB persistence is best-effort: a transient DB outage should not
    // block boot (the gate stays at the boot default and is overwritten
    // when the DB recovers on the next request — see ADR-003 §Consequences
    // "gate cache must be driven by DB state"). Catalogue miss above,
    // however, is a build-time bug and must fail.
    try {
      await pluginRuntime.persistence.syncManifest(manifest)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown syncManifest error'
      fastify.log.warn(
        { plugin: manifest.id, error: message },
        'plugin persistence sync skipped; continuing boot',
      )
    }
    fastify.log.info({ plugin: manifest.id, module: moduleName }, 'plugin manifest registered')
    // Gate defaults to `disabled` at boot — the DB enable pass below may
    // flip it to `enabled`. A plugin that fails lifecycle transitions is
    // surfaced as `failed`.
    const initialState: PluginRuntimeState = 'disabled'
    setPluginState(fastify, manifest.id, initialState)
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
  // Wave 4 also drives the pluginGate cache: any plugin present in the
  // "enabled" set flips from `disabled` to `enabled`; everything else
  // stays at the boot default.
  const enabledPluginNames = getEnabledPluginNames(
    discoveredManifests.map((item) => item.manifest),
    pluginStateSnapshots,
  )
  for (const item of discoveredManifests) {
    if (enabledPluginNames.has(item.manifest.name)) {
      pluginRuntime.lifecycle.enable(item.manifest.name)
      setPluginState(fastify, item.manifest.id, 'enabled')
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

  // Wave 2/4: catalog-driven route mount with ADR-003 pluginGate wrapping.
  // Each plugin's `plugins/<id>/api/...` tree mounts inside a dedicated
  // Fastify sub-app whose preHandler is the per-plugin gate. Fastify's
  // encapsulation keeps the gate isolated per plugin so it cannot leak
  // across plugin boundaries.
  for (const item of discoveredManifests) {
    // Wave 4 note: dev runs (vitest, ts-node) and dist runs share the
    // same layout offset — `__dirname/../../..` reaches the artifact root
    // (monorepo in dev, dist in release). Only the file extension differs.
    const apiDir = join(artifactRoot, 'plugins', item.manifest.id, 'api')
    const moduleExternalPlugins = join(apiDir, 'plugins/external')
    const moduleAppPlugins = join(apiDir, 'plugins/app')
    const moduleRoutes = join(apiDir, 'routes')

    // Manifest `api.prefix` always pins `/api/plugins/<id>/v1` per the SDK
    // contract — set as the sub-app's own `prefix` so each gate actually
    // wraps the public surface. The inner AutoLoad walks `routes/...` and
    // *appends* each path segment to the prefix; with
    // `plugins/yishan/hello/api/routes/v1/admin/index.ts` the traversal
    // already inserts `v1/admin`, so the AutoLoad prefix must stop BEFORE
    // the version segment, otherwise we'd emit
    // `/api/plugins/yishan/hello/v1/v1/admin/`.
    const apiPrefix = item.manifest.api?.prefix ?? `/api/plugins/${item.manifest.id}/v1`
    const fastifyPrefix = apiPrefix
      .replace(/^\/api\//, '')
      .replace(/\/v\d+.*$/, '')

    await fastify.register(async (instance) => {
      // Gate FIRST so it short-circuits before any sub-app route lookup.
      instance.addHook('preHandler', pluginGate(item.manifest.id))
      if (existsSync(moduleExternalPlugins)) {
        await instance.register(AutoLoad, {
          dir: moduleExternalPlugins,
          options: { ...opts }
        })
      }
      if (existsSync(moduleAppPlugins)) {
        // Module schemas/decorators must be registered before their route
        // tree is loaded; otherwise route $ref validation can run first.
        await instance.register(AutoLoad, {
          dir: moduleAppPlugins,
          options: { ...opts }
        })
      }
      if (existsSync(moduleRoutes)) {
        await instance.register(AutoLoad, {
          dir: moduleRoutes,
          autoHooks: true,
          cascadeHooks: true,
          options: { ...opts, prefix: fastifyPrefix }
        })
      }
    })
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
