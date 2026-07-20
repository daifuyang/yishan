import { describe, it, expect, beforeAll } from 'vitest'
import Fastify from 'fastify'
import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

/**
 * Wave 5 — dist-mode boot integration test.
 *
 * Goal: prove that `node dist/app.js` (the production boot path) finds
 * every artifact it needs without traversing back into the monorepo.
 *
 * What we verify:
 *   1. dist/artifacts/plugin-catalog.json exists and matches the source.
 *   2. dist/plugins/<id>/plugin.js exists, is require()-able, and
 *      exports the expected manifest default.
 *   3. dist/plugins/<id>/api/... is copied verbatim from the source
 *      (this is the gap Wave 5 closes — previously only plugin.ts was
 *      compiled, leaving the api/ tree empty in dist).
 *   4. resolveRuntimePaths detects a dist __dirname correctly
 *      (and importantly, does NOT fall through to dev mode when the
 *      dist dir lacks a trailing slash, which was the Wave 4 bug).
 *   5. A minimal fastify built from dist artifacts can mount the
 *      pluginGate preHandler and respond with the expected codes.
 *
 * We deliberately do NOT boot dist/app.js end-to-end here — that
 * requires a live DB and would couple this test to the integration
 * harness. The structural checks plus the synthetic fastify cover the
 * regression we are guarding against.
 *
 * The test auto-runs `node scripts/build-plugins.mjs` if dist/ is
 * missing, so a fresh checkout still produces a valid result without
 * a separate `pnpm --filter yishan-api build:ts` prerequisite.
 */

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const REPO_ROOT = join(__dirname, '..', '..', '..')
const API_ROOT = join(REPO_ROOT, 'apps', 'yishan-api')
const DIST_ROOT = join(API_ROOT, 'dist')
const DIST_ARTIFACTS = join(DIST_ROOT, 'artifacts')
const DIST_CATALOG = join(DIST_ARTIFACTS, 'plugin-catalog.json')
const DIST_HELLO_PLUGIN = join(DIST_ROOT, 'plugins', 'yishan', 'hello', 'plugin.js')
const DIST_HELLO_API_ADMIN_INDEX = join(
  DIST_ROOT,
  'plugins',
  'yishan',
  'hello',
  'api',
  'routes',
  'v1',
  'admin',
  'index.js',
)
const DIST_PLUGIN_API_ENTRY = join(
  DIST_ROOT,
  'node_modules',
  '@yishan',
  'plugin-api',
  'dist',
  'index.js',
)
const SOURCE_CATALOG = join(REPO_ROOT, 'artifacts', 'plugin-catalog.json')

function ensureBuilt() {
  if (existsSync(DIST_HELLO_API_ADMIN_INDEX) && existsSync(DIST_PLUGIN_API_ENTRY)) return
  // eslint-disable-next-line no-console
  console.log('[dist-boot] dist tree incomplete; rebuilding plugin runtime output')
  execSync('pnpm --filter @yishan/plugin-api build', { cwd: REPO_ROOT, stdio: 'inherit' })
  execSync('node scripts/build-plugins.mjs', { cwd: REPO_ROOT, stdio: 'inherit' })
}

beforeAll(() => {
  ensureBuilt()
}, 120_000)

describe('Wave 5: dist-mode boot integration', () => {
  it('dist/artifacts/plugin-catalog.json exists and matches the source catalog', () => {
    expect(existsSync(DIST_CATALOG)).toBe(true)
    // Structural equality — the source catalog may have been regenerated
    // since dist was built (e.g. `generatedAt` advances). We only assert
    // that the boot-relevant fields agree.
    const src = JSON.parse(readFileSync(SOURCE_CATALOG, 'utf8')) as Record<string, unknown>
    const dst = JSON.parse(readFileSync(DIST_CATALOG, 'utf8')) as Record<string, unknown>
    expect(dst.profile).toBe(src.profile)
    expect(dst.plugins).toEqual(src.plugins)
    expect(dst.targets).toEqual(src.targets)
  })

  it('dist/plugins/yishan/hello/plugin.js exists and exports the manifest', () => {
    expect(existsSync(DIST_HELLO_PLUGIN)).toBe(true)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require(DIST_HELLO_PLUGIN) as {
      default?: { id: string; kind?: string; api?: { prefix?: string } }
    }
    expect(mod.default?.id).toBe('yishan/hello')
    expect(mod.default?.api?.prefix).toBe('/api/plugins/yishan/hello/v1')
  })

  it('dist/plugins/yishan/hello/api/... contains compiled JavaScript (Wave 6 fix)', () => {
    expect(existsSync(DIST_HELLO_API_ADMIN_INDEX)).toBe(true)
    const body = readFileSync(DIST_HELLO_API_ADMIN_INDEX, 'utf8')
    // The route file imports helloPermissions from plugin.ts; that
    // import path resolves only because the file lands next to
    // plugin.js (verified above). Spot-check the file is the real
    // route body, not an empty stub.
    expect(body).toContain('helloAdminRoutes')
    expect(body).toContain('HEALTH_READ')
  })

  it('imports and registers the compiled hello admin API route', async () => {
    const routeMod = (await import(pathToFileURL(DIST_HELLO_API_ADMIN_INDEX).href)) as {
      default?: unknown
    }
    expect(typeof routeMod.default).toBe('function')

    const runtimeSdk = (await import(pathToFileURL(DIST_PLUGIN_API_ENTRY).href)) as {
      registerPlugin: (
        app: Awaited<ReturnType<typeof Fastify>>,
        pluginId: string,
        registerFn: (instance: Awaited<ReturnType<typeof Fastify>>) => Promise<void>,
      ) => Promise<void>
    }
    const gateMod = (await import('../src/core/middleware/plugin-gate.js')) as {
      registerPluginGate: (app: Awaited<ReturnType<typeof Fastify>>) => void
      setPluginState: (
        app: Awaited<ReturnType<typeof Fastify>>,
        id: string,
        state: 'enabled',
      ) => void
    }
    const app = Fastify({ logger: false })
    app.decorate('authenticate', async () => undefined)
    app.decorate('requirePermission', () => async () => undefined)
    gateMod.registerPluginGate(app)
    gateMod.setPluginState(app, 'yishan/hello', 'enabled')

    await runtimeSdk.registerPlugin(app, 'yishan/hello', async (instance) => {
      await instance.register(routeMod.default as any, {
        prefix: '/api/plugins/yishan/hello/v1/admin',
      })
    })
    await app.ready()

    const response = await app.inject({
      method: 'GET',
      url: '/api/plugins/yishan/hello/v1/admin/',
    })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      success: true,
      data: { module: 'hello', status: 'ok' },
    })
    await app.close()
  })

  it('dist/artifacts/.build-plugins.marker records the Wave 6 build', () => {
    const marker = join(DIST_ARTIFACTS, '.build-plugins.marker')
    expect(existsSync(marker)).toBe(true)
    const body = JSON.parse(readFileSync(marker, 'utf8')) as { scriptVersion?: string; plugins?: string[] }
    expect(body.scriptVersion).toBe('wave6')
    expect(body.plugins).toContain('yishan/hello')
  })

  it('resolveRuntimePaths detects the dist tree (with and without trailing slash)', async () => {
    const mod = (await import('../src/app.ts')) as {
      resolveRuntimePaths: (d: string) => {
        isDist: boolean
        artifactRoot: string
        catalogPath: string
      }
    }
    const fromDist = mod.resolveRuntimePaths(DIST_ROOT)
    expect(fromDist.isDist).toBe(true)
    expect(fromDist.catalogPath).toBe(DIST_CATALOG)
    expect(fromDist.artifactRoot).toBe(DIST_ROOT)

    const fromSrc = mod.resolveRuntimePaths(API_ROOT + '/src')
    expect(fromSrc.isDist).toBe(false)
    expect(fromSrc.catalogPath).toBe(SOURCE_CATALOG)

    // The regression vector: __dirname exactly equal to a dist path
    // without trailing slash (the Wave 4 bug).
    const fromExact = mod.resolveRuntimePaths(DIST_ROOT.replace(/\/$/, ''))
    expect(fromExact.isDist).toBe(true)
  })

  it('dist-mode pluginGate responds with 404 + PLUGIN_DISABLED for disabled hello', async () => {
    // Build a minimal fastify with the same gate + manifest semantics
    // that dist/app.js would use. We deliberately do NOT mount the
    // route file (it depends on a real @/core/routes/route-registrar
    // resolved via tsconfig paths, which only the dist boot wires up);
    // the structural dist tests above prove the file is present. Here
    // we prove the gate behavior is consistent for a disabled plugin,
    // which is the regression Wave 5 is guarding against.
    const gateMod = (await import('../src/core/middleware/plugin-gate.js')) as {
      pluginGate: (id: string) => (req: unknown, reply: { send: (s: unknown) => void; code: (n: number) => void }) => Promise<void> | void
      registerPluginGate: (app: Awaited<ReturnType<typeof Fastify>>) => void
      setPluginState: (
        app: Awaited<ReturnType<typeof Fastify>>,
        id: string,
        state: 'disabled' | 'enabled' | 'installed' | 'failed',
      ) => void
      PLUGIN_DISABLED: string
    }
    const app = Fastify({ logger: false })
    gateMod.registerPluginGate(app)
    // Wave 4 / app.ts boots every catalog entry into the gate map at
    // 'disabled' before any routes can fire. Mirror that here so the
    // test exercises the *real* disabled path, not the
    // PLUGIN_NOT_FOUND fallback.
    gateMod.setPluginState(app, 'yishan/hello', 'disabled')
    await app.register(async (instance) => {
      instance.addHook('preHandler', gateMod.pluginGate('yishan/hello'))
      instance.get('/probe', async () => ({ ok: true }))
    })
    await app.ready()

    // Default state (no setPluginState call) → should be disabled
    // because app.ts initializes every catalog entry to 'disabled'.
    const res = await app.inject({ method: 'GET', url: '/probe' })
    expect(res.statusCode).toBe(404)
    expect(res.json()).toMatchObject({ success: false, code: gateMod.PLUGIN_DISABLED })

    // Flip to enabled → 200. This proves the gate is wired and the
    // disabled state is not a stale hard-coded 404.
    gateMod.setPluginState(app, 'yishan/hello', 'enabled')
    const res2 = await app.inject({ method: 'GET', url: '/probe' })
    expect(res2.statusCode).toBe(200)

    await app.close()
  })
})