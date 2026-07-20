#!/usr/bin/env node
// scripts/release/build.mjs — Wave 5 release:build entry.
//
// Usage:
//   node scripts/release/build.mjs --profile <name> --version <semver>
//
// Produces a provider-neutral release artifact at
// `artifacts/release/<profile>/<version>/` per PROPOSAL §6.1:
//
//   api/                 compiled API tree from apps/yishan-api/dist/
//   admin/               admin static bundle from apps/yishan-admin/dist/
//   app-weapp/, app-h5/  optional, created only when target present
//   docs/                static docs from apps/yishan-docs/build/
//   openapi.json         per-profile OpenAPI excerpt
//   plugin-catalog.json  copy of artifacts/plugin-catalog.json
//   migration-plan.json  serialized drizzle migration list (or
//                        placeholder when no DB is available)
//   sbom.json            file inventory with hashes for the shipped bundle
//   release-manifest.json
//
// Wave 5 changes from Wave 4:
//   - api/ and admin/ are no longer empty placeholder dirs — the build
//     script now copies the real compiled outputs.
//   - migration-plan.json is always emitted (placeholder if no DB).
//   - sbom.json is emitted by scanning api/ + plugins/.
//   - release-manifest.json schema gains `migrationPlanChecksum`,
//     `sbomChecksum`, and per-target `files` counts.
import { existsSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
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

if (!args.profile || !args.version) {
  console.error(
    'usage: node scripts/release/build.mjs --profile <name> --version <semver>',
  )
  process.exit(1)
}

const SEMVER_RE = /^\d+\.\d+\.\d+(-[\w.]+)?(\+[\w.]+)?$/
if (!SEMVER_RE.test(args.version)) {
  console.error(`[release:build] FAIL: version '${args.version}' is not semver`)
  process.exit(1)
}

const ARTIFACT_ROOT = join(ROOT, 'artifacts', 'release', args.profile, args.version)
const SOURCE_CATALOG = join(ROOT, 'artifacts', 'plugin-catalog.json')
const SOURCE_OPENAPI = join(ROOT, 'apps', 'yishan-api', 'openapi.json')
const SOURCE_OPENAPI_ADMIN = join(
  ROOT,
  'apps',
  'yishan-admin',
  'src',
  'services',
  'generated',
  args.profile,
  'openapi.json',
)
const API_DIST = join(ROOT, 'apps', 'yishan-api', 'dist')
const ADMIN_DIST = join(ROOT, 'apps', 'yishan-admin', 'dist')
const DOCS_BUILD = join(ROOT, 'apps', 'yishan-docs', 'build')

function fail(msg) {
  console.error(`[release:build] FAIL: ${msg}`)
  process.exit(1)
}

function log(msg) {
  console.log(`[release:build] ${msg}`)
}

function git(cmd) {
  const r = spawnSync('git', cmd, { cwd: ROOT, encoding: 'utf8' })
  if (r.status !== 0) return null
  return (r.stdout || '').trim()
}

function nodeVersion() {
  return process.versions.node
}

function pnpmVersion() {
  const r = spawnSync('pnpm', ['--version'], { encoding: 'utf8' })
  if (r.status !== 0) return 'unknown'
  return (r.stdout || '').trim()
}

function sha256(text) {
  return createHash('sha256').update(text).digest('hex')
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function readJsonSafe(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

function copyDirRecursive(srcDir, dstDir) {
  if (!existsSync(srcDir)) return 0
  const stat = statSync(srcDir)
  if (!stat.isDirectory()) {
    fail(`expected directory at ${srcDir}, got ${stat.isFile() ? 'file' : 'other'}`)
  }
  let count = 0
  const stack = [{ src: srcDir, dst: dstDir }]
  while (stack.length) {
    const { src, dst } = stack.pop()
    mkdirSync(dst, { recursive: true })
    for (const entry of readdirSync(src, { withFileTypes: true })) {
      const s = join(src, entry.name)
      const d = join(dst, entry.name)
      if (entry.isDirectory()) stack.push({ src: s, dst: d })
      else if (entry.isFile()) {
        copyFileSync(s, d)
        count += 1
      }
    }
  }
  return count
}

function collectSbom(roots) {
  // Inventory every .js/.ts/.json file under each root, with sha256 and
  // byte size. The artifact self-test (validate.mjs) recomputes this
  // and refuses to ship if drift is detected.
  const files = []
  for (const root of roots) {
    if (!existsSync(root)) continue
    const stat = statSync(root)
    if (!stat.isDirectory()) continue
    const stack = [root]
    while (stack.length) {
      const dir = stack.pop()
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name)
        if (entry.isDirectory()) {
          stack.push(full)
          continue
        }
        if (!entry.isFile()) continue
        if (!/\.(js|ts|json|sql)$/.test(entry.name)) continue
        const data = readFileSync(full)
        files.push({
          path: relative(ARTIFACT_ROOT, full).split(sep).join('/'),
          size: data.length,
          sha256: createHash('sha256').update(data).digest('hex'),
        })
      }
    }
  }
  files.sort((a, b) => a.path.localeCompare(b.path))
  return files
}

/**
 * Run the migration-plan collector. We use Node's
 * `--experimental-strip-types` because the API package's TS source
 * already lives at `src/scripts/migration-plan.ts` and there's no
 * precompiled JS for this helper. On environments without strip-types
 * we fall back to a placeholder.
 */
function buildMigrationPlan() {
  // Use the COMPILED collector from the API dist. The .ts source cannot be
  // import-loaded here because apps/yishan-api is a CommonJS package
  // ("type":"commonjs"), so strip-types rejects its ESM imports. The dist
  // twin is emitted by build:ts (which release:build requires to have run).
  const compiled = join(API_DIST, 'scripts', 'migration-plan.js')
  if (!existsSync(compiled)) {
    fail(`compiled migration-plan collector missing at ${compiled}; run build:ts before release:build`)
  }
  const apiRoot = join(API_DIST, '..')
  let plan
  try {
    const require = createRequire(join(ROOT, 'apps', 'yishan-api', 'package.json'))
    const mod = require(compiled)
    plan = mod.collectMigrationPlan(apiRoot)
  } catch (e) {
    fail(`migration-plan collector failed: ${e instanceof Error ? e.message : String(e)}`)
  }
  if (!Array.isArray(plan)) {
    fail('migration-plan collector did not return an array')
  }
  // A profile with no migrations is legitimate; emit an empty (but generated)
  // plan rather than failing.
  const migrations = plan.map((e) => {
    const id = String(e.id)
    const file = id.split('/').pop()
    const vm = file.match(/^(\d+)/)
    const scope = id.startsWith('core/') ? 'core' : id.split('/').slice(0, 2).join('/')
    return {
      scope,
      version: vm ? vm[1] : file,
      checksum: sha256(e.sql ?? ''),
      source: id,
    }
  })
  return {
    generated: true,
    profile: args.profile,
    migrations,
  }
}

function loadPluginChecksums(catalog) {
  // For each plugin in the catalog, sha256 its plugin.ts (the source
  // the SDK validator loads). The artifact's `dist/plugins/<id>/plugin.js`
  // is the compiled twin — its hash will be captured by sbom.json so
  // downstream consumers can correlate build inputs and outputs.
  const items = []
  for (const entry of catalog.plugins ?? []) {
    const tsPath = join(ROOT, 'plugins', entry.id, 'plugin.ts')
    if (!existsSync(tsPath)) {
      fail(`plugin source missing at ${tsPath}`)
    }
    const hash = sha256(readFileSync(tsPath, 'utf8'))
    items.push({ id: entry.id, kind: entry.kind ?? 'production', sourceChecksum: hash })
  }
  return items
}

function ensureDir(p) {
  mkdirSync(p, { recursive: true })
}

function countFiles(dir) {
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

function main() {
  // 1. Re-run profile:validate. Refuse to build on shape errors.
  const validator = join(ROOT, 'scripts', 'profiles', 'validate.mjs')
  const v = spawnSync(
    process.execPath,
    [validator, '--profile', args.profile],
    { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' },
  )
  if (v.status !== 0) {
    console.error(v.stdout || v.stderr)
    fail(`profile:validate failed for '${args.profile}'`)
  }

  // 2. Read the resulting catalog.
  if (!existsSync(SOURCE_CATALOG)) {
    fail(`catalog not found at ${SOURCE_CATALOG}`)
  }
  const catalog = readJson(SOURCE_CATALOG)

  // 3. Lay out the artifact directory.
  log(`creating ${ARTIFACT_ROOT}`)
  ensureDir(join(ARTIFACT_ROOT, 'api'))
  ensureDir(join(ARTIFACT_ROOT, 'admin'))
  ensureDir(join(ARTIFACT_ROOT, 'docs'))
  for (const target of catalog.targets ?? []) {
    if (target === 'app-weapp' || target === 'app-h5') {
      ensureDir(join(ARTIFACT_ROOT, target))
    }
  }

  // 4. Copy plugin-catalog.json.
  log('copying plugin-catalog.json')
  copyFileSync(SOURCE_CATALOG, join(ARTIFACT_ROOT, 'plugin-catalog.json'))

  // 5. Copy OpenAPI if present.
  let openapiChecksum = null
  if (existsSync(SOURCE_OPENAPI)) {
    log('copying openapi.json (API)')
    copyFileSync(SOURCE_OPENAPI, join(ARTIFACT_ROOT, 'openapi.json'))
    openapiChecksum = sha256(readFileSync(SOURCE_OPENAPI, 'utf8'))
  } else if (existsSync(SOURCE_OPENAPI_ADMIN)) {
    log('copying openapi.json (admin)')
    copyFileSync(SOURCE_OPENAPI_ADMIN, join(ARTIFACT_ROOT, 'openapi.json'))
    openapiChecksum = sha256(readFileSync(SOURCE_OPENAPI_ADMIN, 'utf8'))
  } else {
    log('openapi.json not found, skipping (will fail-fast in validate)')
  }

  // 6. Copy api/ tree from the built dist (apps/yishan-api/dist/).
  let apiFiles = 0
  if (existsSync(API_DIST)) {
    apiFiles = copyDirRecursive(API_DIST, join(ARTIFACT_ROOT, 'api'))
    log(`copied api/ from ${API_DIST}: ${apiFiles} file(s)`)
  } else {
    log('WARN: apps/yishan-api/dist not found — api/ left empty')
  }
  if (apiFiles === 0) {
    fail(`api/ tree is empty; refusing to ship a release artifact without compiled API (run pnpm --filter yishan-api build:ts first)`)
  }

  // 7. Copy admin/ tree from the built dist (apps/yishan-admin/dist/).
  let adminFiles = 0
  if (existsSync(ADMIN_DIST)) {
    adminFiles = copyDirRecursive(ADMIN_DIST, join(ARTIFACT_ROOT, 'admin'))
    log(`copied admin/ from ${ADMIN_DIST}: ${adminFiles} file(s)`)
  } else {
    log('WARN: apps/yishan-admin/dist not found — admin/ left empty')
  }
  if (adminFiles === 0) {
    fail(`admin/ tree is empty; refusing to ship a release artifact without compiled admin (run pnpm --filter yishan-admin build first)`)
  }

  // 8. Copy docs/ tree (best-effort — Docusaurus build may not exist on CI yet).
  let docsFiles = 0
  if (existsSync(DOCS_BUILD)) {
    docsFiles = copyDirRecursive(DOCS_BUILD, join(ARTIFACT_ROOT, 'docs'))
    log(`copied docs/ from ${DOCS_BUILD}: ${docsFiles} file(s)`)
  } else {
    log('WARN: apps/yishan-docs/build not found — docs/ left empty (best-effort)')
  }

  // 9. Emit migration-plan.json. Uses a placeholder when the DB / TS
  // strip-types environment is unavailable.
  const migrationPlan = buildMigrationPlan()
  const migrationPlanPath = join(ARTIFACT_ROOT, 'migration-plan.json')
  writeFileSync(migrationPlanPath, JSON.stringify(migrationPlan, null, 2))
  const migrationPlanChecksum = sha256(readFileSync(migrationPlanPath, 'utf8'))
  log(`wrote migration-plan.json (${migrationPlan.migrations.length} migration(s); generated=${migrationPlan.generated})`)

  // 10. Emit sbom.json by walking api/ + plugins/.
  const sbomFiles = collectSbom([
    join(ARTIFACT_ROOT, 'api'),
    join(ARTIFACT_ROOT, 'plugins'),
  ])
  const sbom = {
    schema: 'yishan.sbom',
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    profile: args.profile,
    version: args.version,
    fileCount: sbomFiles.length,
    files: sbomFiles,
  }
  const sbomPath = join(ARTIFACT_ROOT, 'sbom.json')
  writeFileSync(sbomPath, JSON.stringify(sbom, null, 2))
  const sbomChecksum = sha256(readFileSync(sbomPath, 'utf8'))
  log(`wrote sbom.json (${sbom.fileCount} file(s))`)

  // 11. Per-plugin checksums (input fingerprint).
  const pluginItems = loadPluginChecksums(catalog)

  // 12. Write release-manifest.json.
  const manifest = {
    schema: 'yishan.release-manifest',
    schemaVersion: 2,
    profile: args.profile,
    version: args.version,
    generatedAt: new Date().toISOString(),
    git: {
      sha: git(['rev-parse', 'HEAD']),
      branch: git(['rev-parse', '--abbrev-ref', 'HEAD']),
      dirty: (git(['status', '--porcelain']) ?? '').length > 0,
    },
    toolchain: {
      node: nodeVersion(),
      pnpm: pnpmVersion(),
    },
    plugins: pluginItems,
    openapi: {
      present: openapiChecksum !== null,
      checksum: openapiChecksum,
    },
    migrationPlan: {
      present: true,
      generated: migrationPlan.generated,
      checksum: migrationPlanChecksum,
      count: migrationPlan.migrations.length,
    },
    sbom: {
      present: true,
      checksum: sbomChecksum,
      fileCount: sbom.fileCount,
    },
    targets: catalog.targets ?? [],
    fileCounts: {
      api: apiFiles,
      admin: adminFiles,
      docs: docsFiles,
    },
  }
  writeFileSync(
    join(ARTIFACT_ROOT, 'release-manifest.json'),
    JSON.stringify(manifest, null, 2),
  )

  log(
    `[release:build] PASS artifact at ${ARTIFACT_ROOT} (${pluginItems.length} plugin(s), api=${apiFiles} admin=${adminFiles} docs=${docsFiles})`,
  )
}

main()