#!/usr/bin/env node
// scripts/release/build.mjs — Wave 4 release:build entry.
//
// Usage:
//   node scripts/release/build.mjs --profile <name> --version <semver>
//
// Produces a provider-neutral release artifact at
// `artifacts/release/<profile>/<version>/` per PROPOSAL §6.1:
//
//   api/                 (compiled API tree — out of scope for Wave 4)
//   admin/               (admin static bundle — out of scope, see notes)
//   app-weapp/, app-h5/  (optional — created only when target present)
//   docs/                (static docs — out of scope, see notes)
//   openapi.json         (per-profile OpenAPI excerpt — copied when present)
//   plugin-catalog.json  (copy of artifacts/plugin-catalog.json)
//   release-manifest.json
//
// Wave 4 scope:
//   - re-run profile:validate, refuse to build on failures
//   - write plugin-catalog.json into the artifact
//   - emit release-manifest.json with git SHA, node/pnpm versions,
//     profile, plugins[id,version,checksum], openapi checksum (if any),
//     timestamp
//
// The api/ admin/ docs/ subdirectories are intentionally left empty in
// this Wave — the full FC3 adapter / admin bundling / docusaurus build
// re-implementations belong to Wave 5 (ADR-007) and Wave 6. The script
// reserves the layout so downstream adapters can drop their outputs in
// without restructuring the artifact.
import { existsSync, mkdirSync, copyFileSync, writeFileSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'

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

function fail(msg) {
  console.error(`[release:build] FAIL: ${msg}`)
  process.exit(1)
}

function runStep(label, fn) {
  console.log(`[release:build] ${label}`)
  fn()
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

function loadPluginChecksums(catalog) {
  // We do not checksum the plugin bundle here yet — the artifact contains
  // plugin-catalog.json only, and plugin sources are bundled into the api/
  // tree by `scripts/build-plugins.mjs`. Until api/ is wired up in
  // Wave 5, the checksum of the plugin source file + manifest id serves
  // as a fingerprint.
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
  runStep(`creating ${ARTIFACT_ROOT}`, () => {
    mkdirSync(join(ARTIFACT_ROOT, 'api'), { recursive: true })
    mkdirSync(join(ARTIFACT_ROOT, 'admin'), { recursive: true })
    mkdirSync(join(ARTIFACT_ROOT, 'docs'), { recursive: true })
    // app-weapp/, app-h5/ created only when explicitly listed in targets.
    for (const target of catalog.targets ?? []) {
      if (target === 'app-weapp' || target === 'app-h5') {
        mkdirSync(join(ARTIFACT_ROOT, target), { recursive: true })
      }
    }
  })

  // 4. Copy plugin-catalog.json.
  runStep('copying plugin-catalog.json', () => {
    copyFileSync(SOURCE_CATALOG, join(ARTIFACT_ROOT, 'plugin-catalog.json'))
  })

  // 5. Copy OpenAPI if present (Wave 4: best-effort; gated by file
  // existence).
  let openapiChecksum = null
  if (existsSync(SOURCE_OPENAPI)) {
    runStep('copying openapi.json (API)', () => {
      copyFileSync(SOURCE_OPENAPI, join(ARTIFACT_ROOT, 'openapi.json'))
    })
    openapiChecksum = sha256(readFileSync(SOURCE_OPENAPI, 'utf8'))
  } else if (existsSync(SOURCE_OPENAPI_ADMIN)) {
    runStep('copying openapi.json (admin)', () => {
      copyFileSync(SOURCE_OPENAPI_ADMIN, join(ARTIFACT_ROOT, 'openapi.json'))
    })
    openapiChecksum = sha256(readFileSync(SOURCE_OPENAPI_ADMIN, 'utf8'))
  } else {
    console.log('[release:build] openapi.json not found, skipping (Wave 4)')
  }

  // 6. Compute per-plugin checksums.
  const pluginItems = loadPluginChecksums(catalog)

  // 7. Write release-manifest.json.
  const manifest = {
    schema: 'yishan.release-manifest',
    schemaVersion: 1,
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
    targets: catalog.targets ?? [],
  }
  writeFileSync(
    join(ARTIFACT_ROOT, 'release-manifest.json'),
    JSON.stringify(manifest, null, 2),
  )

  console.log(
    `[release:build] PASS artifact at ${ARTIFACT_ROOT} (${pluginItems.length} plugin(s))`,
  )
}

main()
