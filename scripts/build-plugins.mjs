#!/usr/bin/env node
// scripts/build-plugins.mjs — Wave 6 plugin runtime-artifact builder.
//
// The active catalog drives the build. Each selected plugin gets a compiled
// plugin.js plus an ESM api/ tree containing executable .js files only. The
// runtime SDK is vendored beside the API dist so the resulting tree remains
// loadable after it is detached from the monorepo.
import { execSync } from 'node:child_process'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const SCRIPT_DIR = dirname(__filename)
const ROOT = join(SCRIPT_DIR, '..')
const PLUGINS_ROOT = join(ROOT, 'plugins')
const PLUGIN_API_ROOT = join(ROOT, 'packages', 'plugin-api')
const PLUGIN_API_DIST = join(PLUGIN_API_ROOT, 'dist')
const DIST_ROOT = join(ROOT, 'apps', 'yishan-api', 'dist')
const DIST_PLUGINS = join(DIST_ROOT, 'plugins')
const DIST_ARTIFACTS = join(DIST_ROOT, 'artifacts')
const SOURCE_CATALOG = join(ROOT, 'artifacts', 'plugin-catalog.json')
const TARGET_CATALOG = join(DIST_ARTIFACTS, 'plugin-catalog.json')

function log(message) {
  console.log(`[build-plugins] ${message}`)
}

function die(message) {
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
  return parsed.plugins.map((plugin) => plugin.id)
}

function findCompiledFile(rootDir, targetName) {
  const stack = [rootDir]
  while (stack.length) {
    const dir = stack.pop()
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) stack.push(full)
      else if (entry.name === targetName) return full
    }
  }
  return null
}

function copyDirRecursive(srcDir, dstDir) {
  let count = 0
  const stack = [{ src: srcDir, dst: dstDir }]
  while (stack.length) {
    const { src, dst } = stack.pop()
    mkdirSync(dst, { recursive: true })
    for (const entry of readdirSync(src, { withFileTypes: true })) {
      const source = join(src, entry.name)
      const target = join(dst, entry.name)
      if (entry.isDirectory()) {
        stack.push({ src: source, dst: target })
      } else if (entry.isFile()) {
        copyFileSync(source, target)
        count += 1
      }
    }
  }
  return count
}

function countFilesRecursive(rootDir, extension) {
  if (!existsSync(rootDir)) return 0
  let count = 0
  const stack = [rootDir]
  while (stack.length) {
    const dir = stack.pop()
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) stack.push(full)
      else if (entry.isFile() && entry.name.endsWith(extension)) count += 1
    }
  }
  return count
}

function compilePlugin(id) {
  const [vendor, slug] = id.split('/')
  const source = join(PLUGINS_ROOT, vendor, slug, 'plugin.ts')
  if (!existsSync(source)) die(`plugin source missing at ${source}`)

  const tmpOut = join(DIST_ROOT, '.plugin-build', vendor, slug)
  rmSync(tmpOut, { recursive: true, force: true })
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
  execSync(`pnpm exec tsc ${args.map((arg) => `"${arg.replace(/"/g, '\\"')}"`).join(' ')}`, {
    cwd: ROOT,
    stdio: 'inherit',
  })

  const compiled = findCompiledFile(tmpOut, 'plugin.js')
  if (!compiled) die(`tsc produced no plugin.js for ${id}`)
  const finalOut = join(DIST_PLUGINS, vendor, slug)
  mkdirSync(finalOut, { recursive: true })
  copyFileSync(compiled, join(finalOut, 'plugin.js'))
  // Copy plugin root package.json (if present) so dist subtree carries the
  // `{"type": "module"}` marker that Node ESM resolver needs.
  const pluginPkg = join(PLUGINS_ROOT, vendor, slug, 'package.json')
  if (existsSync(pluginPkg)) {
    copyFileSync(pluginPkg, join(finalOut, 'package.json'))
  } else {
    writeFileSync(join(finalOut, 'package.json'), JSON.stringify({ type: 'module' }, null, 2))
  }
  rmSync(tmpOut, { recursive: true, force: true })
}

function compilePluginApi(id) {
  const [vendor, slug] = id.split('/')
  const pluginRoot = join(PLUGINS_ROOT, vendor, slug)
  const apiSrc = join(pluginRoot, 'api')
  if (!existsSync(apiSrc)) {
    log(`no api/ tree for ${id}; skipping`)
    return 0
  }

  const finalOut = join(DIST_PLUGINS, vendor, slug)
  const apiDst = join(finalOut, 'api')
  const tmpOut = join(DIST_ROOT, '.plugin-api-build', vendor, slug)
  const tsconfig = join(DIST_ROOT, '.plugin-tsconfig.json')
  rmSync(apiDst, { recursive: true, force: true })
  rmSync(tmpOut, { recursive: true, force: true })
  mkdirSync(tmpOut, { recursive: true })

  writeFileSync(
    tsconfig,
    JSON.stringify(
      {
        compilerOptions: {
          module: 'nodenext',
          moduleResolution: 'nodenext',
          target: 'es2022',
          esModuleInterop: true,
          skipLibCheck: true,
          outDir: tmpOut,
          rootDir: ROOT,
          declaration: false,
        },
        include: [join(apiSrc, '**/*.ts')],
      },
      null,
      2,
    ),
  )

  try {
    log(`tsc -p ${tsconfig}`)
    execSync(`pnpm exec tsc -p "${tsconfig}"`, {
      cwd: ROOT,
      stdio: 'inherit',
    })
    const compiledApi = join(tmpOut, 'plugins', vendor, slug, 'api')
    if (!existsSync(compiledApi)) {
      die(`tsc produced no api/ output for ${id}`)
    }
    copyDirRecursive(compiledApi, apiDst)
    const apiPackage = join(apiSrc, 'package.json')
    if (existsSync(apiPackage)) {
      copyFileSync(apiPackage, join(apiDst, 'package.json'))
    } else {
      writeFileSync(join(apiDst, 'package.json'), JSON.stringify({ type: 'module' }, null, 2))
    }
  } finally {
    rmSync(tsconfig, { force: true })
    rmSync(tmpOut, { recursive: true, force: true })
  }

  const count = countFilesRecursive(apiDst, '.js')
  log(`compiled api/ for ${id}: ${count} JavaScript file(s)`)
  return count
}

function vendorPluginApiRuntime() {
  const entry = join(PLUGIN_API_DIST, 'index.js')
  if (!existsSync(entry)) {
    die(`@yishan/plugin-api is not built at ${entry}; run pnpm --filter @yishan/plugin-api build first`)
  }
  const target = join(DIST_ROOT, 'node_modules', '@yishan', 'plugin-api')
  rmSync(target, { recursive: true, force: true })
  mkdirSync(target, { recursive: true })
  copyFileSync(join(PLUGIN_API_ROOT, 'package.json'), join(target, 'package.json'))
  const count = copyDirRecursive(PLUGIN_API_DIST, join(target, 'dist'))
  log(`vendored @yishan/plugin-api runtime: ${count} file(s)`)
}

function copyCatalog() {
  mkdirSync(DIST_ARTIFACTS, { recursive: true })
  copyFileSync(SOURCE_CATALOG, TARGET_CATALOG)
  log(`copied ${SOURCE_CATALOG} -> ${TARGET_CATALOG}`)
}

function main() {
  log('Wave 6 plugin runtime-artifact builder starting')
  const pluginIds = listCatalogPluginIds()
  log(`catalog lists ${pluginIds.length} plugin(s): ${pluginIds.join(', ')}`)

  rmSync(DIST_PLUGINS, { recursive: true, force: true })
  rmSync(join(DIST_ROOT, '.plugin-build'), { recursive: true, force: true })
  rmSync(join(DIST_ROOT, '.plugin-api-build'), { recursive: true, force: true })

  for (const id of pluginIds) {
    const [vendor, slug] = id.split('/')
    if (!vendor || !slug) die(`invalid catalog plugin id '${id}'`)
    compilePlugin(id)
    const apiFiles = compilePluginApi(id)
    if (apiFiles === 0) die(`plugin ${id} api/ produced no executable JavaScript`)
  }

  vendorPluginApiRuntime()
  copyCatalog()

  for (const id of pluginIds) {
    const [vendor, slug] = id.split('/')
    const finalOut = join(DIST_PLUGINS, vendor, slug)
    log(
      `  - ${id}: plugin.js=${existsSync(join(finalOut, 'plugin.js'))} api.js=${countFilesRecursive(join(finalOut, 'api'), '.js')}`,
    )
  }

  const marker = join(DIST_ARTIFACTS, '.build-plugins.marker')
  writeFileSync(
    marker,
    JSON.stringify(
      {
        builtAt: new Date().toISOString(),
        plugins: pluginIds,
        scriptVersion: 'wave6',
      },
      null,
      2,
    ),
  )
  log(`done. catalog=${TARGET_CATALOG.split(sep).join('/')}`)
}

main()
