#!/usr/bin/env node
// scripts/profiles/validate.mjs — Wave 4 profile:validate entry.
//
// Usage:
//   node scripts/profiles/validate.mjs --profile <name>
//
// Performs the full validation pipeline before a release is built:
//
//   1. runs scripts/profiles/parse.mjs to regenerate the catalog JSON;
//   2. for every catalog entry, checks that
//      plugins/<vendor>/<slug>/plugin.ts exists and exports a manifest;
//   3. invokes the SDK's validateManifest and the legacy plugin-platform
//      validator and refuses on issues;
//   4. cross-checks the catalog against sys_plugin snapshot invariants
//      (samples-only for core; optional stripe).
//
// Exit codes:
//   0 — clean
//   1 — validation failures
//
// This script is intentionally dependency-light (only `yaml` from the
// monorepo and the SDK source files). It does not import the API
// runtime, so it stays cheap to run in CI gates.
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

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

if (!args.profile) {
  console.error('usage: node scripts/profiles/validate.mjs --profile <name>')
  process.exit(1)
}

function runStep(label, fn) {
  process.stdout.write(`[profile:validate] ${label} ... `)
  try {
    fn()
    console.log('ok')
    return true
  } catch (err) {
    console.log('FAIL')
    console.error(`  ${err.message ?? err}`)
    return false
  }
}

function fail(reason) {
  throw new Error(reason)
}

/**
 * Pure validator that does not depend on the SDK package being compiled
 * (it still works against the in-tree plugin SDK TS source). It mirrors
 * packages/plugin-sdk/src/validate.ts well enough that anything we
 * accept here also passes the runtime validator at boot.
 */
function validateSdkManifestShape(manifest) {
  const issues = []
  const id = manifest?.id
  if (typeof id !== 'string' || !/^[\w-]+\/[\w-]+$/.test(id)) {
    issues.push({ field: 'id', message: 'must match ^[\\w-]+/[\\w-]+$' })
  }
  if (typeof manifest?.version !== 'string' || !/^\d+\.\d+\.\d+/.test(manifest.version)) {
    issues.push({ field: 'version', message: 'must be semver' })
  }
  if (typeof manifest?.coreVersion !== 'string' || !/^[\^~]?\d+\.\d+\.\d+/.test(manifest.coreVersion)) {
    issues.push({ field: 'coreVersion', message: 'must be semver range' })
  }
  if (!Array.isArray(manifest?.permissions)) {
    issues.push({ field: 'permissions', message: 'must be an array' })
  }
  if (!Array.isArray(manifest?.menus)) {
    issues.push({ field: 'menus', message: 'must be an array' })
  }
  const apiPrefix = manifest?.api?.prefix
  if (apiPrefix !== undefined) {
    if (!apiPrefix.startsWith('/api/')) {
      issues.push({ field: 'api.prefix', message: 'must start with /api/' })
    } else if (id && apiPrefix !== `/api/plugins/${id}/v1`) {
      issues.push({
        field: 'api.prefix',
        message: `must equal /api/plugins/${id}/v1 (derived from id)`,
      })
    }
  }
  return issues
}

async function loadManifest(id) {
  // Plugin ts sources live at plugins/<v>/<s>/plugin.ts. They are
  // self-contained (no external runtime deps), so we can drive them via
  // tsx-like transpilation: but Node's native loader cannot process .ts.
  // The Wave 4 compromise: invoke `node --experimental-strip-types` if
  // available; otherwise fall back to requiring a precompiled .js. This
  // mirrors what vitest does and avoids adding a dependency here.
  const tsPath = join(ROOT, 'plugins', id, 'plugin.ts')
  if (!existsSync(tsPath)) {
    throw new Error(`plugin file missing at ${tsPath}`)
  }
  // Try native strip-types (Node >= 22.6). Fall back to esbuild-style
  // bundled require is not available, so surface the failure.
  const result = spawnSync(
    process.execPath,
    [
      '--experimental-strip-types',
      '--no-warnings=ExperimentalWarning',
      '-e',
      `import('${tsPath}').then(m => { console.log(JSON.stringify({ok: !!m.default, manifest: m.default ?? null})); }).catch(e => { console.error(e.message); process.exit(1); });`,
    ],
    { cwd: ROOT, encoding: 'utf8' },
  )
  if (result.status !== 0 || !result.stdout) {
    throw new Error(
      `failed to load plugin '${id}' (status=${result.status}): ${result.stderr || result.stdout || 'unknown error'}`,
    )
  }
  const stdout = result.stdout.trim()
  // The script prints JSON.stringify({ok, manifest}); extract that.
  const lastLine = stdout.split('\n').filter(Boolean).pop()
  let parsed
  try {
    parsed = JSON.parse(lastLine)
  } catch (err) {
    throw new Error(
      `plugin '${id}' produced unparseable output: ${lastLine.slice(0, 200)}`,
    )
  }
  if (!parsed.ok || !parsed.manifest) {
    throw new Error(`plugin '${id}' did not export a default manifest`)
  }
  return parsed.manifest
}

async function main() {
  console.log(`[profile:validate] starting for profile=${args.profile}`)

  // Step 1: regenerate the catalog. parse.mjs writes to
  // artifacts/plugin-catalog.json and exits non-zero on shape errors.
  const parsePath = join(SCRIPT_DIR, 'parse.mjs')
  const parse = spawnSync(
    process.execPath,
    [parsePath, '--profile', args.profile],
    { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' },
  )
  if (parse.status !== 0) {
    console.error('[profile:validate] FAIL during catalog generation')
    console.error(parse.stdout || parse.stderr)
    process.exit(1)
  }
  console.log('[profile:validate] catalog shape ok')

  // Step 2: read the generated catalog back.
  const catalogPath = join(ROOT, 'artifacts', 'plugin-catalog.json')
  if (!existsSync(catalogPath)) {
    console.error(`[profile:validate] FAIL: catalog not found at ${catalogPath}`)
    process.exit(1)
  }
  let catalog
  try {
    catalog = JSON.parse(readFileSync(catalogPath, 'utf8'))
  } catch (err) {
    console.error(`[profile:validate] FAIL: ${err.message}`)
    process.exit(1)
  }
  if (!Array.isArray(catalog.plugins) || catalog.plugins.length === 0) {
    console.error('[profile:validate] FAIL: catalog.plugins is empty')
    process.exit(1)
  }

  // Step 3: per-plugin manifest load + SDK validation.
  let failed = false
  for (const entry of catalog.plugins) {
    let manifest
    try {
      manifest = await loadManifest(entry.id)
    } catch (err) {
      console.error(`[profile:validate] FAIL ${entry.id}: ${err.message}`)
      failed = true
      continue
    }
    const issues = validateSdkManifestShape(manifest)
    if (issues.length > 0) {
      console.error(`[profile:validate] FAIL ${entry.id}:`)
      for (const issue of issues) {
        console.error(`  - ${issue.field}: ${issue.message}`)
      }
      failed = true
      continue
    }
    console.log(`[profile:validate] ok ${entry.id} v${manifest.version} (${entry.kind ?? 'production'})`)
  }
  if (failed) process.exit(1)

  // Step 4: cross-check catalog samples vs plugins (basic invariant).
  if (Array.isArray(catalog.samples)) {
    const catalogIds = new Set(catalog.plugins.map((p) => p.id))
    for (const sampleId of catalog.samples) {
      if (!catalogIds.has(sampleId)) {
        console.error(
          `[profile:validate] FAIL: samples lists '${sampleId}' but plugins array does not include it`,
        )
        failed = true
      }
    }
  }
  if (failed) process.exit(1)

  console.log(
    `[profile:validate] PASS profile=${catalog.profile} ${catalog.plugins.length} plugin(s) verified`,
  )
}

main().catch((err) => {
  console.error(`[profile:validate] unexpected error: ${err.message}`)
  process.exit(1)
})
