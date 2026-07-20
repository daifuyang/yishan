#!/usr/bin/env node
// scripts/build-plugins.mjs — Wave 5 release-artifact builder.
//
// PROPOSAL §6.1 says the release artifact must contain
//   - compiled API server tree
//   - compiled plugin source (plugins/<vendor>/<slug>/plugin.js)
//   - plugin-catalog.json
//   - plugin API routes (plugins/<vendor>/<slug>/api/...)
//   - plugin admin assets (plugins/<vendor>/<slug>/admin/...)
// so that `node dist/app.js` (production boot) finds everything next to it
// without traversing back into the monorepo.
//
// Wave 4 only compiled plugin.ts; the runtime then could not find the
// `api/routes/...` tree because it lives outside plugin.ts and was not
// copied into dist. Wave 5 closes that gap by:
//   1. Reading artifacts/plugin-catalog.json (single source of truth) and
//      iterating only the plugins selected by the active profile.
//   2. Per plugin, compiling plugin.ts via tsc and recursively copying the
//      api/ and admin/ source trees verbatim under
//      apps/yishan-api/dist/plugins/<vendor>/<slug>/{api,admin}/. The dist
//      layout now matches what `app.ts` looks up via `resolveRuntimePaths`.
//
// `pnpm --filter yishan-api build:ts` runs this script after the main API
// `tsc` completes. The script is invoked from the monorepo root by the
// package script — paths are resolved relative to the script location so
// the cwd can vary.
import { execSync } from 'node:child_process'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

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

function listCatalogPluginIds() {
  if (!existsSync(SOURCE_CATALOG)) {
    die(`catalog not found at ${SOURCE_CATALOG}; run pnpm profile:catalog first`)
  }
  let parsed
  try {
    parsed = JSON.parse(readFileSync(SOURCE_CATALOG, 'utf8'))
  } catch (err) {
    die(`catalog at ${SOURCE_CATALOG} is not valid JSON: ${err.message}`)
  }
  if (!Array.isArray(parsed?.plugins) || parsed.plugins.length === 0) {
    die(`catalog at ${SOURCE_CATALOG} has empty plugins[]; refusing to build zero-plugin artifact`)
  }
  return parsed.plugins.map((p) => p.id)
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

function compilePlugin(id) {
  // Use a temp outDir sibling to DIST_PLUGINS so we can move the single
  // plugin.js result to <DIST_PLUGINS>/<vendor>/<slug>/plugin.js without
  // having tsc mirror the leading `plugins/` segment.
  const [vendor, slug] = id.split('/')
  const source = join(PLUGINS_ROOT, vendor, slug, 'plugin.ts')
  if (!existsSync(source)) {
    die(`plugin source missing at ${source}`)
  }
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
  // Use pnpm exec to resolve the local TypeScript binary (the yishan-api
  // workspace package depends on typescript). npx tsc would otherwise fetch
  // the deprecated tsc@2.0.4 npm package.
  execSync(`pnpm exec tsc ${args.map((a) => `"${a.replace(/"/g, '\\"')}"`).join(' ')}`, {
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

function copyDirRecursive(srcDir, dstDir) {
  if (!existsSync(srcDir)) return 0
  const stat = statSync(srcDir)
  if (!stat.isDirectory()) {
    die(`expected directory at ${srcDir}, got ${stat.isFile() ? 'file' : 'other'}`)
  }
  let count = 0
  const stack = [{ src: srcDir, dst: dstDir }]
  while (stack.length) {
    const { src, dst } = stack.pop()
    mkdirSync(dst, { recursive: true })
    for (const entry of readdirSync(src, { withFileTypes: true })) {
      const s = join(src, entry.name)
      const d = join(dst, entry.name)
      if (entry.isDirectory()) {
        stack.push({ src: s, dst: d })
      } else if (entry.isFile()) {
        copyFileSync(s, d)
        count += 1
      } else if (entry.isSymbolicLink()) {
        // Skip symlinks — the artifact is meant to be self-contained
        // and links would dangle outside the dist tree.
        log(`skipping symlink ${relative(ROOT, s)}`)
      }
    }
  }
  return count
}

function copyPluginApiAndAdmin(id) {
  const [vendor, slug] = id.split('/')
  const pluginRoot = join(PLUGINS_ROOT, vendor, slug)
  const finalOut = join(DIST_PLUGINS, vendor, slug)
  mkdirSync(finalOut, { recursive: true })

  // api/ tree holds the runtime Fastify routes — AutoLoad walks it
  // recursively, so every file (.ts included for source map legibility)
  // must be present at the dist path.
  const apiSrc = join(pluginRoot, 'api')
  if (existsSync(apiSrc)) {
    const apiDst = join(finalOut, 'api')
    if (existsSync(apiDst)) rmSync(apiDst, { recursive: true, force: true })
    const n = copyDirRecursive(apiSrc, apiDst)
    log(`copied api/ for ${id}: ${n} file(s)`)
  } else {
    log(`no api/ tree for ${id}; skipping`)
  }

  // admin/ tree is static assets consumed by the admin bundler; we still
  // ship it for parity (an admin build pipeline could pluck from dist/).
  const adminSrc = join(pluginRoot, 'admin')
  if (existsSync(adminSrc)) {
    const adminDst = join(finalOut, 'admin')
    if (existsSync(adminDst)) rmSync(adminDst, { recursive: true, force: true })
    const n = copyDirRecursive(adminSrc, adminDst)
    log(`copied admin/ for ${id}: ${n} file(s)`)
  }
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
  log('Wave 5 release-artifact builder starting')

  // 1. Drive from the catalog — only plugins in the active profile ship
  //    into dist. Plugins that exist on disk but are not in the catalog
  //    (e.g. portal/shop on a core branch) are intentionally NOT compiled
  //    so the dist surface matches what `app.ts` will look up at boot.
  const pluginIds = listCatalogPluginIds()
  log(`catalog lists ${pluginIds.length} plugin(s): ${pluginIds.join(', ')}`)

  // 2. Wipe the previous plugin tree to avoid stale entries from an
  //    earlier profile (e.g. switching from official → core must drop
  //    portal/shop from dist/plugins/).
  if (existsSync(DIST_PLUGINS)) {
    rmSync(DIST_PLUGINS, { recursive: true, force: true })
  }
  if (existsSync(join(DIST_ROOT, '.plugin-build'))) {
    rmSync(join(DIST_ROOT, '.plugin-build'), { recursive: true, force: true })
  }

  for (const id of pluginIds) {
    const [vendor, slug] = id.split('/')
    if (!vendor || !slug) die(`invalid catalog plugin id '${id}'`)
    compilePlugin(id)
    copyPluginApiAndAdmin(id)
  }

  copyCatalog()

  // 3. Smoke check — surface the final dist tree shape so a CI log makes
  //    the result obvious without a follow-up `find dist/plugins`.
  const summary = []
  for (const id of pluginIds) {
    const [vendor, slug] = id.split('/')
    const finalOut = join(DIST_PLUGINS, vendor, slug)
    const exists = existsSync(join(finalOut, 'plugin.js'))
    const apiExists = existsSync(join(finalOut, 'api'))
    summary.push(`  - ${id}: plugin.js=${exists} api=${apiExists}`)
  }
  log('dist summary:')
  for (const line of summary) log(line)

  // Cross-platform path print (sep differs on Windows); use forward slashes
  // for stable assertions in tests/CI.
  log(`done. catalog=${TARGET_CATALOG.split(sep).join('/')}`)
  // Touch a build marker so tests can detect "this dist was built by
  // Wave 5 build-plugins" without checking internal layout.
  const marker = join(DIST_ARTIFACTS, '.build-plugins.marker')
  writeFileSync(
    marker,
    JSON.stringify(
      {
        builtAt: new Date().toISOString(),
        plugins: pluginIds,
        scriptVersion: 'wave5',
      },
      null,
      2,
    ),
  )
  log(`wrote marker ${marker}`)
}

main()