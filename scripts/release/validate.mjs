#!/usr/bin/env node
// scripts/release/validate.mjs — Wave 4 release:validate entry.
//
// Usage:
//   node scripts/release/validate.mjs --artifact <path>
//
// Checks that the artifact at <path> is internally consistent:
//   1. release-manifest.json parses and matches the schema
//   2. plugin-catalog.json inside the artifact matches the one in
//      release-manifest.json's profile (re-runs profile:validate against
//      the artifact's catalog if drift is detected)
//   3. every plugin listed in release-manifest.json.plugins has a
//      matching source file on disk (the plugin.ts checksum we recorded
//      must reproduce)
//   4. openapi.json (if present inside artifact) checksum matches
//      release-manifest.json.openapi.checksum
//
// Intentionally does NOT validate the compiled api/ admin/ docs/
// bundles (Wave 5). Their absence is allowed but surface a warning.
//
// Exit codes:
//   0 — clean
//   1 — violation
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
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

if (!args.artifact) {
  console.error('usage: node scripts/release/validate.mjs --artifact <path>')
  process.exit(1)
}

const ARTIFACT = args.artifact
const MANIFEST_PATH = join(ARTIFACT, 'release-manifest.json')
const CATALOG_PATH = join(ARTIFACT, 'plugin-catalog.json')
const OPENAPI_PATH = join(ARTIFACT, 'openapi.json')

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

function readJsonMaybe(path) {
  if (!existsSync(path)) return null
  return JSON.parse(readFileSync(path, 'utf8'))
}

function checkManifest() {
  const manifest = readJsonMaybe(MANIFEST_PATH)
  if (!manifest) fail(`release-manifest.json missing at ${MANIFEST_PATH}`)
  if (manifest.schema !== 'yishan.release-manifest') {
    fail(`release-manifest.json schema field must be 'yishan.release-manifest'`)
  }
  if (manifest.schemaVersion !== 1) {
    fail(`release-manifest.json schemaVersion must be 1 (got ${manifest.schemaVersion})`)
  }
  if (typeof manifest.profile !== 'string') fail('manifest.profile missing')
  if (typeof manifest.version !== 'string') fail('manifest.version missing')
  if (!Array.isArray(manifest.plugins)) fail('manifest.plugins must be an array')
  if (typeof manifest.git?.sha !== 'string') fail('manifest.git.sha missing')
  if (typeof manifest.toolchain?.node !== 'string') fail('manifest.toolchain.node missing')
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
}

function checkPluginsChecksum(manifest) {
  for (const item of manifest.plugins) {
    const tsPath = join(ROOT, 'plugins', item.id, 'plugin.ts')
    if (!existsSync(tsPath)) {
      fail(`manifest.plugins[${item.id}].sourceChecksum references missing source at ${tsPath}`)
    }
    const actual = sha256(readFileSync(tsPath, 'utf8'))
    if (actual !== item.sourceChecksum) {
      fail(
        `manifest.plugins[${item.id}].sourceChecksum drifted: recorded ${item.sourceChecksum}, current ${actual}`,
      )
    }
  }
}

function checkOpenapiChecksum(manifest) {
  const openapi = readJsonMaybe(OPENAPI_PATH)
  if (manifest.openapi?.present) {
    if (!openapi) fail('manifest.openapi.present is true but openapi.json is missing in artifact')
    const fileContent = readFileSync(OPENAPI_PATH, 'utf8')
    const fileChecksum = sha256(fileContent)
    if (fileChecksum !== manifest.openapi.checksum) {
      fail(
        `openapi.json checksum drifted: recorded ${manifest.openapi.checksum}, current ${fileChecksum}`,
      )
    }
  } else if (openapi) {
    warn('openapi.json present in artifact but manifest.openapi.present is false')
  }
}

function checkOptionalTargets(manifest) {
  // Wave 4 does not validate api/ admin/ docs/ bundles. Their layout
  // directories must exist if the target is in the manifest, but the
  // contents are left to downstream adapters.
  const targets = manifest.targets ?? []
  for (const target of targets) {
    if (target === 'api' || target === 'admin' || target === 'docs' ||
        target === 'app-weapp' || target === 'app-h5') {
      const dir = join(ARTIFACT, target)
      if (!existsSync(dir)) {
        warn(`target '${target}' declared but directory ${dir} is absent`)
      }
    }
  }
}

function rerunProfileValidate(manifest) {
  // Re-run profile:validate against the catalog embedded in the artifact
  // so any shape drift since build time is caught now. We deliberately
  // skip when manifest.profile is empty (would error anyway in step 1).
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

function main() {
  if (!existsSync(ARTIFACT)) {
    fail(`artifact path does not exist: ${ARTIFACT}`)
  }
  const manifest = checkManifest()
  checkCatalogVsManifest(manifest)
  checkPluginsChecksum(manifest)
  checkOpenapiChecksum(manifest)
  checkOptionalTargets(manifest)
  rerunProfileValidate(manifest)

  console.log(
    `[release:validate] PASS artifact=${ARTIFACT} profile=${manifest.profile} version=${manifest.version} plugins=${manifest.plugins.length}`,
  )
}

main()
