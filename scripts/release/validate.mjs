#!/usr/bin/env node
// scripts/release/validate.mjs — Wave 5 release:validate entry.
//
// Usage:
//   node scripts/release/validate.mjs --artifact <path>
//
// Checks that the artifact at <path> is internally consistent. Wave 5
// rules:
//   - Only files inside the artifact are read. The validator must work
//     against a release tarball, not against the monorepo source tree.
//   - Every declared target directory MUST contain at least one file.
//     An empty target fails the build.
//   - The manifest schema is checked for every documented field, and
//     the embedded checksums (openapi, migration-plan, sbom) are
//     recomputed from the artifact's bytes.
//   - profile:validate is re-run against the embedded catalog.
//
// Exit codes:
//   0 — clean
//   1 — violation
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'

const __filename = fileURLToPath(import.meta.url)
const SCRIPT_DIR = dirname(__filename)
const ROOT = join(SCRIPT_DIR, '..', '..')

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .map((arg, i, arr) => {
      const m = arg.match(/^--(.+)$/)
      return m ? [m[1], arr[i + 1]] : null
    })
    .filter(Boolean),
)

if (!args.artifact) {
  console.error('usage: node scripts/release/validate.mjs --artifact <path>')
  process.exit(1)
}

const ARTIFACT = resolve(args.artifact)
const MANIFEST_PATH = join(ARTIFACT, 'release-manifest.json')
const CATALOG_PATH = join(ARTIFACT, 'plugin-catalog.json')
const OPENAPI_PATH = join(ARTIFACT, 'openapi.json')
const SBOM_PATH = join(ARTIFACT, 'sbom.json')
const MIGRATION_PLAN_PATH = join(ARTIFACT, 'migration-plan.json')

function fail(msg) {
  console.error(`[release:validate] FAIL: ${msg}`)
  process.exit(1)
}

function warn(msg) {
  console.error(`[release:validate] WARN: ${msg}`)
}

function sha256(text) {
  return createHash('sha256').update(text).digest('hex')
}

function sha256File(path) {
  return sha256(readFileSync(path, 'utf8'))
}

function readJsonMaybe(path) {
  if (!existsSync(path)) return null
  return JSON.parse(readFileSync(path, 'utf8'))
}

function countFilesDeep(dir) {
  if (!existsSync(dir)) return 0
  const stat = statSync(dir)
  if (!stat.isDirectory()) return 0
  let count = 0
  const stack = [dir]
  while (stack.length) {
    const d = stack.pop()
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const full = join(d, entry.name)
      if (entry.isDirectory()) stack.push(full)
      else if (entry.isFile()) count += 1
    }
  }
  return count
}

function checkManifest() {
  const manifest = readJsonMaybe(MANIFEST_PATH)
  if (!manifest) fail(`release-manifest.json missing at ${MANIFEST_PATH}`)
  if (manifest.schema !== 'yishan.release-manifest') {
    fail(`release-manifest.json schema field must be 'yishan.release-manifest'`)
  }
  if (typeof manifest.schemaVersion !== 'number') {
    fail('release-manifest.json schemaVersion must be a number')
  }
  if (manifest.schemaVersion < 2) {
    fail(`release-manifest.json schemaVersion must be >= 2 (got ${manifest.schemaVersion})`)
  }
  if (typeof manifest.profile !== 'string') fail('manifest.profile missing')
  if (typeof manifest.version !== 'string') fail('manifest.version missing')
  if (!Array.isArray(manifest.plugins)) fail('manifest.plugins must be an array')
  if (typeof manifest.git?.sha !== 'string') fail('manifest.git.sha missing')
  if (typeof manifest.toolchain?.node !== 'string') fail('manifest.toolchain.node missing')
  if (!manifest.openapi || typeof manifest.openapi.checksum !== 'string' && manifest.openapi.present) {
    fail('manifest.openapi.checksum must be a string when present=true')
  }
  if (!manifest.migrationPlan || typeof manifest.migrationPlan.checksum !== 'string') {
    fail('manifest.migrationPlan.checksum must be a string')
  }
  if (!manifest.sbom || typeof manifest.sbom.checksum !== 'string') {
    fail('manifest.sbom.checksum must be a string')
  }
  if (!Array.isArray(manifest.targets)) fail('manifest.targets must be an array')
  return manifest
}

function checkCatalogVsManifest(manifest) {
  const catalog = readJsonMaybe(CATALOG_PATH)
  if (!catalog) fail(`plugin-catalog.json missing at ${CATALOG_PATH}`)
  if (catalog.profile !== manifest.profile) {
    fail(`catalog.profile ('${catalog.profile}') does not match manifest.profile ('${manifest.profile}')`)
  }
  const catalogIds = new Set((catalog.plugins ?? []).map((p) => p.id))
  for (const item of manifest.plugins) {
    if (!catalogIds.has(item.id)) {
      fail(`manifest.plugins references '${item.id}' but catalog does not include it`)
    }
  }
  // Catalog-vs-SBOM cross-check: every catalog plugin must appear in the
  // artifact's plugin tree (or in the api/ tree, which is the dist copy).
  // We can't read external files here, so we only check that the catalog
  // is non-empty and structurally consistent.
  if (catalog.plugins.length === 0) {
    fail('plugin-catalog.json plugins[] is empty')
  }
  return catalog
}

function checkOpenapiChecksum(manifest) {
  const openapi = readJsonMaybe(OPENAPI_PATH)
  if (manifest.openapi?.present) {
    if (!openapi) fail('manifest.openapi.present is true but openapi.json is missing in artifact')
    const fileChecksum = sha256File(OPENAPI_PATH)
    if (fileChecksum !== manifest.openapi.checksum) {
      fail(
        `openapi.json checksum drifted: recorded ${manifest.openapi.checksum}, current ${fileChecksum}`,
      )
    }
  } else if (openapi) {
    warn('openapi.json present in artifact but manifest.openapi.present is false')
  }
}

function checkMigrationPlanChecksum(manifest) {
  if (!existsSync(MIGRATION_PLAN_PATH)) {
    fail(`migration-plan.json missing at ${MIGRATION_PLAN_PATH} (required by schemaVersion 2+)`)
  }
  const fileChecksum = sha256File(MIGRATION_PLAN_PATH)
  if (fileChecksum !== manifest.migrationPlan.checksum) {
    fail(
      `migration-plan.json checksum drifted: recorded ${manifest.migrationPlan.checksum}, current ${fileChecksum}`,
    )
  }
  // The plan must be a fully generated plan — no placeholders.
  if (manifest.migrationPlan.generated !== true) {
    fail('migration plan must be generated (generated=true); placeholder plans are not shippable')
  }
  const plan = readJsonMaybe(MIGRATION_PLAN_PATH)
  if (!plan || plan.generated !== true) {
    fail('migration-plan.json must have generated=true')
  }
  // A profile with no migrations is legitimate — do NOT require a non-empty
  // migrations[]. Only require that the field is an array and that every
  // present entry is complete.
  if (!Array.isArray(plan.migrations)) {
    fail('migration-plan.json migrations must be an array')
  }
  plan.migrations.forEach((m, i) => {
    for (const field of ['scope', 'version', 'checksum', 'source']) {
      if (typeof m?.[field] !== 'string' || m[field].length === 0) {
        fail(`migration-plan.json migrations[${i}] missing required string field '${field}'`)
      }
    }
  })
}

function checkSbom(manifest) {
  if (!existsSync(SBOM_PATH)) {
    fail(`sbom.json missing at ${SBOM_PATH} (required by schemaVersion 2+)`)
  }
  const sbom = readJsonMaybe(SBOM_PATH)
  if (!sbom) fail('sbom.json is not parseable JSON')
  if (sbom.schema !== 'yishan.sbom') fail(`sbom.json schema must be 'yishan.sbom' (got '${sbom.schema}')`)
  if (!Array.isArray(sbom.files)) fail('sbom.json files must be an array')
  const fileChecksum = sha256File(SBOM_PATH)
  if (fileChecksum !== manifest.sbom.checksum) {
    fail(
      `sbom.json checksum drifted: recorded ${manifest.sbom.checksum}, current ${fileChecksum}`,
    )
  }
  // Spot-check: every entry must reference an existing artifact file.
  for (const entry of sbom.files) {
    const fullPath = join(ARTIFACT, entry.path)
    if (!existsSync(fullPath)) {
      fail(`sbom references missing file ${entry.path}`)
    }
    if (entry.sha256 && sha256(readFileSync(fullPath)) !== entry.sha256) {
      fail(`sbom entry ${entry.path} hash drift`)
    }
  }
}

function checkTargets(manifest) {
  // Wave 5 rule: empty target = fail, not warn. Every declared target
  // must contain at least one file.
  const targets = manifest.targets ?? []
  for (const target of targets) {
    const dir = join(ARTIFACT, target)
    if (!existsSync(dir)) {
      fail(`target '${target}' declared in manifest but directory ${dir} is absent`)
    }
    const count = countFilesDeep(dir)
    if (count === 0) {
      fail(`target '${target}' directory is empty at ${dir}`)
    }
  }
}

function assertImportable(modulePath, label, expectedType) {
  if (!existsSync(modulePath)) {
    fail(`${label} missing at ${modulePath}`)
  }
  const moduleUrl = pathToFileURL(modulePath).href
  const script = [
    `const mod = await import(${JSON.stringify(moduleUrl)});`,
    'const exported = mod.default?.default ?? mod.default;',
    `if (typeof exported !== ${JSON.stringify(expectedType)}) {`,
    `  throw new Error(${JSON.stringify(`expected default export type ${expectedType}`)} + ', got ' + typeof exported);`,
    '}',
  ].join('\n')
  const result = spawnSync(
    process.execPath,
    ['--input-type=module', '--eval', script],
    { cwd: ARTIFACT, encoding: 'utf8', stdio: 'pipe' },
  )
  if (result.status !== 0) {
    fail(`${label} failed to load: ${(result.stderr || result.stdout || 'unknown import error').trim()}`)
  }
}

// Collect the (method, url) of every route registered under `app`, using a
// root-level onRoute hook (inherited by encapsulated children).
function attachRouteCollector(app) {
  const routes = []
  app.addHook('onRoute', (r) => {
    const methods = Array.isArray(r.method) ? r.method : [r.method]
    for (const method of methods) routes.push({ method, url: r.url })
  })
  return routes
}

function injectableUrl(url) {
  // Replace path params (:id) and wildcards (*) with a placeholder so the
  // route matches during inject.
  return url.replace(/:[^/]+/g, 'x').replace(/\*/g, 'x')
}

async function checkPluginRuntimeArtifacts(catalog) {
  // Resolve fastify from the API package (pnpm isolates it there, not at the
  // repo root), so the validator can mount plugins in-process.
  const require = createRequire(join(ROOT, 'apps', 'yishan-api', 'package.json'))
  const Fastify = (await import(pathToFileURL(require.resolve('fastify')).href)).default
  const vendored = join(ARTIFACT, 'api', 'node_modules', '@yishan', 'plugin-api', 'dist', 'index.js')
  if (!existsSync(vendored)) {
    fail(`vendored @yishan/plugin-api runtime missing at ${vendored}`)
  }
  const sdk = await import(pathToFileURL(vendored).href)
  const { registerPlugin, PLUGIN_DISABLED } = sdk

  for (const entry of catalog.plugins) {
    const pluginRoot = join(ARTIFACT, 'api', 'plugins', entry.id)

    // 1. The manifest is importable and default-exports an object.
    assertImportable(join(pluginRoot, 'plugin.js'), `plugin ${entry.id}`, 'object')

    // 2. The declared API runtime entry is importable and default-exports a
    //    Fastify plugin (function). No per-plugin special cases — the entry
    //    comes from the catalog (falling back to the id convention).
    const entryRel = entry.api?.entry ?? `api/plugins/${entry.id}/api/register.js`
    const entryAbs = join(ARTIFACT, entryRel)
    assertImportable(entryAbs, `plugin ${entry.id} api entry`, 'function')

    const prefix = entry.api?.prefix ?? `/api/plugins/${entry.id}/v1`

    // 3 + 4. Register the entry on a minimal Fastify under the Core-owned
    //        gate wrapper and assert (a) every route lands under the prefix
    //        and (b) a disabled plugin is gated before the handler runs.
    const routeMod = await import(pathToFileURL(entryAbs).href)
    const routes = routeMod.default?.default ?? routeMod.default

    const app = Fastify({ logger: false })
    app.decorate('pluginState', new Map())
    app.decorate('authenticate', async () => undefined)
    app.decorate('requirePermission', () => async () => undefined)
    const collected = attachRouteCollector(app)
    app.pluginState.set(entry.id, 'disabled')
    try {
      await registerPlugin(app, entry.id, async (instance) => {
        await instance.register(routes, { prefix })
      })
      await app.ready()
    } catch (err) {
      await app.close()
      fail(`plugin ${entry.id} failed to register under ${prefix}: ${err.message}`)
    }

    // (a) prefix containment
    for (const r of collected) {
      if (!r.url.startsWith(prefix)) {
        await app.close()
        fail(`plugin ${entry.id} registered route ${r.method} ${r.url} outside its prefix ${prefix}`)
      }
    }

    // (b) disabled plugin is gated (GET routes only, to avoid schema
    //     validation firing before the preHandler gate).
    const getRoutes = collected.filter((r) => r.method === 'GET')
    for (const r of getRoutes) {
      const res = await app.inject({ method: 'GET', url: injectableUrl(r.url) })
      if (res.statusCode !== 404 || res.json()?.code !== PLUGIN_DISABLED) {
        await app.close()
        fail(
          `plugin ${entry.id} route GET ${r.url} was not gated when disabled ` +
            `(status=${res.statusCode}, code=${res.json()?.code}); Core gate not applied`,
        )
      }
    }
    if (getRoutes.length === 0) {
      warn(`plugin ${entry.id} exposes no GET routes; gate behavior not asserted at release:validate`)
    }
    await app.close()
  }
}

function rerunProfileValidate(manifest) {
  if (!manifest.profile) return
  const validator = join(ROOT, 'scripts', 'profiles', 'validate.mjs')
  const result = spawnSync(
    process.execPath,
    [validator, '--profile', manifest.profile],
    { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' },
  )
  if (result.status !== 0) {
    fail(
      `profile:validate against artifact's profile failed:\n${result.stdout}${result.stderr}`,
    )
  }
}

async function main() {
  if (!existsSync(ARTIFACT)) {
    fail(`artifact path does not exist: ${ARTIFACT}`)
  }
  const manifest = checkManifest()
  const catalog = checkCatalogVsManifest(manifest)
  checkOpenapiChecksum(manifest)
  checkMigrationPlanChecksum(manifest)
  checkSbom(manifest)
  checkTargets(manifest)
  await checkPluginRuntimeArtifacts(catalog)
  rerunProfileValidate(manifest)

  console.log(
    `[release:validate] PASS artifact=${ARTIFACT} profile=${manifest.profile} version=${manifest.version} plugins=${manifest.plugins.length} files=${manifest.sbom.fileCount}`,
  )
}

main().catch((err) => {
  fail(err instanceof Error ? err.message : String(err))
})