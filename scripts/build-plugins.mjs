#!/usr/bin/env node
// scripts/build-plugins.mjs — Wave 4 release-artifact builder.
//
// PROPOSAL §6.1 says the release artifact must contain
//   - compiled API server tree
//   - compiled plugin source (plugins/<vendor>/<slug>/plugin.js)
//   - plugin-catalog.json
// so that `node dist/app.js` (production boot) finds everything next to it
// without traversing back into the monorepo.
//
// This script is invoked by apps/yishan-api/package.json#build:ts after
// the main API tsc completes. It compiles every plugin.ts under
// plugins/<vendor>/<slug>/plugin.ts to
// apps/yishan-api/dist/plugins/<vendor>/<slug>/plugin.js and copies the
// active artifacts/plugin-catalog.json next to it under
// apps/yishan-api/dist/artifacts/.
//
// Per-plugin tsc (no project) is the simplest reliable layout: each
// plugin becomes one CommonJS module under apps/yishan-api/dist/plugins/.
// Because the source already lives at plugins/<v>/<s>/plugin.ts, tsc
// mirrors that path inside outDir. We use a per-plugin intermediate
// outDir and then move the plugin.js file up to the canonical release
// path so dist/plugins/<v>/<s>/plugin.js contains exactly one file.
//
// Note: this only handles plugin.ts itself — admin route registration
// and admin app/webpack payloads belong to the admin build pipeline
// (pnpm --filter yishan-admin build) and are out of scope here.
import { execSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Resolve the script directory and the monorepo root from it, so the
// script works regardless of which cwd it was launched from (pnpm filter
// scripts typically land the cwd inside the package, not at the repo
// root).
const __filename = fileURLToPath(import.meta.url)
const SCRIPT_DIR = dirname(__filename)
const ROOT = join(SCRIPT_DIR, '..')
const PLUGINS_ROOT = join(ROOT, 'plugins')
const DIST_ROOT = join(ROOT, 'apps', 'yishan-api', 'dist')
const DIST_PLUGINS = join(DIST_ROOT, 'plugins')
const DIST_ARTIFACTS = join(DIST_ROOT, 'artifacts')
const SOURCE_CATALOG = join(ROOT, 'artifacts', 'plugin-catalog.json')
const TARGET_CATALOG = join(DIST_ARTIFACTS, 'plugin-catalog.json')

function log(message) {
  // eslint-disable-next-line no-console
  console.log(`[build-plugins] ${message}`)
}

function die(message) {
  // eslint-disable-next-line no-console
  console.error(`[build-plugins] FAIL: ${message}`)
  process.exit(1)
}

function readDirDirs(dir) {
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
}

function listPlugins() {
  if (!existsSync(PLUGINS_ROOT)) {
    die(`plugins directory not found at ${PLUGINS_ROOT}`)
  }
  const plugins = []
  for (const vendor of readDirDirs(PLUGINS_ROOT)) {
    const vendorPath = join(PLUGINS_ROOT, vendor)
    for (const slug of readDirDirs(vendorPath)) {
      const pluginTs = join(PLUGINS_ROOT, vendor, slug, 'plugin.ts')
      if (existsSync(pluginTs)) {
        plugins.push({ id: `${vendor}/${slug}`, source: pluginTs })
      }
    }
  }
  return plugins
}

function findCompiledJs(rootDir, targetName) {
  const stack = [rootDir]
  let found = null
  while (stack.length) {
    const dir = stack.pop()
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) stack.push(full)
      else if (entry.name === targetName) found = full
    }
  }
  return found
}

function compilePlugin({ id, source }) {
  // Use a temp outDir sibling to DIST_PLUGINS so we can mv/cp the single
  // plugin.js result to <DIST_PLUGINS>/<vendor>/<slug>/plugin.js without
  // having tsc mirror the leading `plugins/` segment.
  const [vendor, slug] = id.split('/')
  const tmpOut = join(DIST_ROOT, '.plugin-build', vendor, slug)
  if (existsSync(tmpOut)) rmSync(tmpOut, { recursive: true, force: true })
  mkdirSync(tmpOut, { recursive: true })
  const args = [
    source,
    '--outDir', tmpOut,
    '--module', 'nodenext',
    '--moduleResolution', 'nodenext',
    '--target', 'es2022',
    '--esModuleInterop',
    '--skipLibCheck',
  ]
  log(`tsc ${args.join(' ')}`)
  execSync(`npx tsc ${args.map((a) => `"${a.replace(/"/g, '\\"')}"`).join(' ')}`, {
    cwd: ROOT,
    stdio: 'inherit',
  })
  // Find the compiled plugin.js (tsc mirrors source path inside outDir).
  const compiled = findCompiledJs(tmpOut, 'plugin.js')
  if (!compiled) {
    die(`tsc produced no plugin.js for ${id}`)
  }
  const finalOut = join(DIST_PLUGINS, vendor, slug)
  mkdirSync(finalOut, { recursive: true })
  copyFileSync(compiled, join(finalOut, 'plugin.js'))
  // Also copy the .d.ts if produced (helpful for downstream type
  // consumers; production boot does not need it).
  const dts = findCompiledJs(tmpOut, 'plugin.d.ts')
  if (dts) {
    copyFileSync(dts, join(finalOut, 'plugin.d.ts'))
  }
  // Tidy temp.
  rmSync(tmpOut, { recursive: true, force: true })
}

function copyCatalog() {
  if (!existsSync(SOURCE_CATALOG)) {
    die(`catalog not found at ${SOURCE_CATALOG}; run pnpm profile:catalog first`)
  }
  mkdirSync(DIST_ARTIFACTS, { recursive: true })
  copyFileSync(SOURCE_CATALOG, TARGET_CATALOG)
  log(`copied ${SOURCE_CATALOG} -> ${TARGET_CATALOG}`)
}

function main() {
  log('Wave 4 release-artifact builder starting')
  const plugins = listPlugins()
  if (plugins.length === 0) {
    log('no plugins found under plugins/<v>/<s>/ — nothing to compile')
  }
  if (existsSync(DIST_PLUGINS)) {
    rmSync(DIST_PLUGINS, { recursive: true, force: true })
  }
  for (const plugin of plugins) {
    compilePlugin(plugin)
  }
  copyCatalog()
  log(`done. compiled ${plugins.length} plugin(s); catalog at ${TARGET_CATALOG}`)
}

main()
