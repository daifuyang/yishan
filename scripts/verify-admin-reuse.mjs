#!/usr/bin/env node
// Run with the repository's pinned Node version. Every build/cache/probe artifact
// stays in OS temp; package source is reused only through its public exports.
// Usage: node scripts/verify-admin-reuse.mjs --admin apps/demo/admin
// Optional: --mode all|reuse|product, --modules catalog[,other], --skip-hmr.
// PLAYWRIGHT_CHANNEL=chrome selects installed Chrome; default is Playwright Chromium.
// Temp logs, screenshots and report.json are retained for review.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { dirname, extname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createWriteStream, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs'

export function parseArguments(args) {
  const options = { admin: 'apps/demo/admin', combinations: [['catalog'], ['catalog', 'other']], mode: 'all', hmr: true }
  for (let index = 0; index < args.length; index++) {
    const flag = args[index]
    if (flag === '--skip-hmr') options.hmr = false
    else if (['--admin', '--modules', '--mode'].includes(flag)) {
      const value = args[++index]
      if (!value || value.startsWith('--')) throw new Error(`${flag} requires a value`)
      if (flag === '--admin') options.admin = value
      if (flag === '--mode') {
        if (!['all', 'reuse', 'product'].includes(value)) throw new Error('--mode must be all, reuse or product')
        options.mode = value
      }
      if (flag === '--modules') {
        const modules = value.split(',')
        if (modules[0] !== 'catalog' || modules.some(id => !['catalog', 'other'].includes(id)) || new Set(modules).size !== modules.length) throw new Error('--modules must be catalog or catalog,other')
        options.combinations = [modules]
      }
    } else throw new Error(`Unknown option ${flag}`)
  }
  return options
}

function manifestSource(ids) {
  return `${ids.map(id => `import ${id.replaceAll('-', '_')} from './modules/${id}/module'`).join('\n')}\nexport const installedModules = [${ids.map(id => id.replaceAll('-', '_')).join(', ')}] as const\n`
}

export function fixtureSources(ids) {
  const files = {
    'admin/package.json': JSON.stringify({ name: '@reuse-fixture/admin', private: true, dependencies: { '@yishan/core-admin': 'workspace:*', '@yishan/core-system-admin': 'workspace:*', react: '^19.2.5', 'react-dom': '^19.2.5' } }),
    'api/package.json': JSON.stringify({ name: '@reuse-fixture/api', private: true }),
    'api/src/manifest.ts': manifestSource(ids),
    'admin/.umirc.ts': `import { defineConfig } from '@umijs/max';\nexport default defineConfig({routes:[{path:'/',component:'./index'}],base:'/reuse/',publicPath:'/reuse/',hash:true,request:{},model:{},initialState:{},antd:{},mako:{},outputPath:'dist'});\n`,
    'admin/plugin.ts': `import type { IApi } from '@umijs/max';\nimport { mkdirSync, writeFileSync } from 'node:fs';\nimport path from 'node:path';\nimport { createAdminPlugin } from '@yishan/core-admin/umi-plugin';\nimport { systemPages } from '@yishan/core-system-admin/umi';\nexport default (api:IApi)=>{createAdminPlugin({apiRoot:'../api',systemPages})(api);api.addTmpGenerateWatcherPaths(()=>{const paths=Object.values(systemPages).map(specifier=>require.resolve(specifier));const directory=path.join(api.cwd,'node_modules/.cache');mkdirSync(directory,{recursive:true});writeFileSync(path.join(directory,'reuse-watchers.json'),JSON.stringify(paths));return paths;});};\n`,
    'admin/src/app.tsx': `export async function getInitialState(){return {}}\n`,
    'admin/src/pages/index.tsx': `import React, { lazy, Suspense } from 'react';\nimport { App } from 'antd';\nimport { SystemAdminProvider } from '@yishan/core-system-admin';\nimport { moduleComponentsMap } from '@@/module-components';\nconst key = new URLSearchParams(window.location.search).get('page') || './system/region';\nconst Page = moduleComponentsMap[key] ? lazy(moduleComponentsMap[key]) : ()=> <div>Module not installed</div>;\nexport default function Fixture(){return <App><SystemAdminProvider value={{dictDataMap:{default_status:[{label:'启用',value:'1'}]}}}><Suspense fallback={<div>Loading</div>}><Page /></Suspense></SystemAdminProvider></App>}\n`,
    'admin/src/system-types.d.ts': `import type {} from '@yishan/core-system-admin/types';\n`,
    'admin/tsconfig.json': JSON.stringify({ compilerOptions: { target: 'esnext', module: 'esnext', moduleResolution: 'bundler', jsx: 'react-jsx', strict: true, skipLibCheck: true, esModuleInterop: true, types: ['node', 'react'], paths: { '@/*': ['./src/*'], '@@/*': ['./src/.umi-production/*'] } }, include: ['src/**/*.ts', 'src/**/*.tsx', 'src/**/*.d.ts', '.umirc.ts', 'plugin.ts'] }),
  }
  for (const id of ['catalog', 'other', 'excluded']) {
    files[`api/src/modules/${id}/module.ts`] = `export default {id:'${id}',version:'1.0.0'} as const\n`
    files[`admin/src/modules/${id}/pages/index/index.tsx`] = id === 'excluded'
      ? `throw new Error('UNINSTALLED_REUSE_FIXTURE_MUST_NOT_COMPILE'); export default ()=>null;\n`
      : `import React from 'react'; import styles from './index.module.less';\nexport default function Module(){return <h1 data-testid="${id}-version" className={styles.card}>${id} fixture v1</h1>}\n`
    files[`admin/src/modules/${id}/pages/index/index.module.less`] = '.card { color: rgb(17, 82, 51); padding: 17px; }\n'
  }
  return files
}

function writeFiles(root, files) {
  for (const [file, content] of Object.entries(files)) {
    const target = join(root, file)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, content)
  }
}

function linkDependencies(source, target, overrides = {}) {
  mkdirSync(target, { recursive: true })
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue
    const from = join(source, entry.name)
    if (entry.name.startsWith('@')) {
      mkdirSync(join(target, entry.name), { recursive: true })
      for (const child of readdirSync(from)) {
        if (existsSync(join(from, child))) symlinkSync(overrides[`${entry.name}/${child}`] || realpathSync(join(from, child)), join(target, entry.name, child), process.platform === 'win32' ? 'junction' : 'dir')
      }
    } else if (existsSync(from)) symlinkSync(overrides[entry.name] || realpathSync(from), join(target, entry.name), process.platform === 'win32' ? 'junction' : 'dir')
  }
}

export function copyOwnedSystemPackage(source, owned) {
  assert.ok(resolve(source) !== resolve(owned) && !resolve(owned).startsWith(`${resolve(source)}${sep}`), 'The owned package must be outside the original package')
  const manifest = JSON.parse(readFileSync(join(source, 'package.json'), 'utf8'))
  mkdirSync(owned, { recursive: true })
  cpSync(join(source, 'package.json'), join(owned, 'package.json'))
  for (const entry of manifest.files) cpSync(join(source, entry), join(owned, entry), { recursive: true })
  linkDependencies(join(source, 'node_modules'), join(owned, 'node_modules'))
  assert.deepEqual(JSON.parse(readFileSync(join(owned, 'package.json'), 'utf8')).exports, manifest.exports)
  return { sourcePackage: source, ownedPackage: owned, publicExportsPreserved: true }
}

function executable(requireFromAdmin, packageName, binary) {
  const manifest = requireFromAdmin.resolve(`${packageName}/package.json`)
  const config = JSON.parse(readFileSync(manifest, 'utf8'))
  return resolve(dirname(manifest), typeof config.bin === 'string' ? config.bin : config.bin[binary])
}

function startCommand(binary, args, cwd, logPath, extraEnv = {}) {
  const output = createWriteStream(logPath)
  const env = { ...process.env, BROWSER: 'none', ...extraEnv }
  delete env.UMI_ENV
  const child = spawn(process.execPath, [binary, ...args], { cwd, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
  child.stdout.pipe(output)
  child.stderr.pipe(output)
  const completion = new Promise((accept, reject) => {
    child.once('error', reject)
    child.once('close', code => { output.end(); code === 0 ? accept() : reject(new Error(`Command failed (${code}). See ${logPath}`)) })
  })
  // A dev server's later shutdown is expected; keep its rejected promise handled.
  completion.catch(() => {})
  return { child, completion, logPath }
}

async function stopCommand(command) {
  if (command.child.exitCode !== null) return
  if (process.platform === 'win32') {
    await new Promise(accept => { const killer = spawn('taskkill', ['/PID', String(command.child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }); killer.once('close', accept); killer.once('error', accept) })
  } else command.child.kill('SIGTERM')
}

async function runCommand(binary, args, cwd, logPath, env = {}) {
  const command = startCommand(binary, args, cwd, logPath, env)
  const timeout = setTimeout(() => { void stopCommand(command) }, 300_000)
  try { await command.completion } finally { clearTimeout(timeout) }
}

function registry(root) {
  const file = ['.umi-production', '.umi'].map(name => join(root, 'src', name, 'module-components.ts')).find(existsSync)
  assert.ok(file, 'Umi must generate the module registry')
  const source = readFileSync(file, 'utf8')
  return { file, source, keys: [...source.matchAll(/"(\.\/[^"\n]+)":\s*\(\)\s*=>/g)].map(match => match[1]) }
}

function validateRegistry(admin, installed, systemPages) {
  const result = registry(admin)
  for (const key of Object.keys(systemPages)) assert.ok(result.keys.includes(key), `Missing System page ${key}`)
  for (const key of result.keys.filter(key => key.startsWith('./modules/'))) assert.ok(installed.includes(key.split('/')[2]), `Uninstalled page registered: ${key}`)
  for (const id of installed) assert.ok(result.keys.some(key => key.startsWith(`./modules/${id}/`)), `No actual pages for installed module ${id}`)
  assert.ok(!result.source.includes('excluded'), 'Excluded fixture must be absent')
  return result.keys
}

async function staticServer(directory, base) {
  const server = createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname)
    if (!pathname.startsWith(base)) { response.writeHead(404).end(); return }
    const file = resolve(directory, pathname.slice(base.length) || 'index.html')
    if (!file.startsWith(`${resolve(directory)}${sep}`)) { response.writeHead(403).end(); return }
    const target = existsSync(file) ? file : extname(file) ? undefined : join(directory, 'index.html')
    if (!target) { response.writeHead(404).end(); return }
    const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json' }[extname(target)] || 'application/octet-stream'
    response.writeHead(200, { 'content-type': mime }).end(readFileSync(target))
  })
  await new Promise(accept => server.listen(0, '127.0.0.1', accept))
  return { origin: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(accept => server.close(accept)) }
}

async function browserProbe(browser, admin, evidenceDirectory) {
  const server = await staticServer(join(admin, 'dist'), '/reuse/')
  const page = await browser.newPage()
  const errors = [], resources = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('response', response => { if (/\.(?:css|js)(?:\?|$)/.test(response.url())) resources.push({ url: response.url(), status: response.status() }) })
  await page.route('**/api/v1/admin/system/regions/tree**', route => route.fulfill({ json: { success: true, data: [{ code: 110000, name: '北京市', level: 1, parentCode: 0, sortOrder: 0 }] } }))
  try {
    await page.goto(`${server.origin}/reuse/`, { waitUntil: 'networkidle' })
    await page.getByText('北京市', { exact: true }).waitFor()
    await page.screenshot({ path: join(evidenceDirectory, 'system-region.png'), fullPage: true })
    await page.goto(`${server.origin}/reuse/?page=./modules/catalog/index`, { waitUntil: 'networkidle' })
    await page.getByTestId('catalog-version').waitFor()
    assert.equal(await page.getByTestId('catalog-version').evaluate(element => getComputedStyle(element).color), 'rgb(17, 82, 51)')
    await page.goto(`${server.origin}/reuse/?page=./modules/excluded/index`, { waitUntil: 'networkidle' })
    await page.getByText('Module not installed', { exact: true }).waitFor()
    assert.deepEqual(errors, [], 'The second product must not have browser errors')
    assert.ok(resources.some(resource => resource.url.endsWith('.css')), 'Browser must load emitted CSS')
    assert.ok(resources.every(resource => resource.status === 200 && new URL(resource.url).pathname.startsWith('/reuse/')), 'Public-path resources must load successfully')
    return { realLazySystemPage: 'region', fixtureCss: true, excludedModuleUnavailable: true, browserErrors: errors, resources }
  } finally { await page.close(); await server.close() }
}

async function freePort() {
  const server = createServer()
  await new Promise(accept => server.listen(0, '127.0.0.1', accept))
  const port = server.address().port
  await new Promise(accept => server.close(accept))
  return port
}

async function waitForHttp(url, command) {
  const deadline = Date.now() + 120_000
  while (Date.now() < deadline) {
    if (command.child.exitCode !== null) throw new Error(`Dev server exited. See ${command.logPath}`)
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2000) })
      if (response.ok) {
        const html = await response.text()
        const assets = [...html.matchAll(/(?:src|href)="([^" ]+\.(?:js|css))"/g)].map(match => new URL(match[1], url))
        // Umi's HTTP listener starts before the Mako asset proxy. Waiting only
        // for HTML can load a permanently empty browser document during startup.
        if (assets.length && (await Promise.all(assets.map(asset => fetch(asset, { signal: AbortSignal.timeout(2000) })))).every(asset => asset.ok)) return
      }
    } catch {}
    await new Promise(accept => setTimeout(accept, 500))
  }
  throw new Error(`Dev server did not start. See ${command.logPath}`)
}

async function starterProbe(admin, evidenceDirectory) {
  const starter = join(admin, 'scripts/start.cjs')
  if (!existsSync(starter)) return { tested: false, reason: 'No product starter script' }
  const adminPort = await freePort(), fallbackPort = await freePort()
  const command = startCommand(starter, ['dev'], admin, join(evidenceDirectory, 'starter.log'), { NODE_ENV: 'development', ADMIN_PORT: String(adminPort), PORT: String(fallbackPort), PUBLIC_PATH: '/admin/', HOST: '127.0.0.1' })
  try {
    await waitForHttp(`http://127.0.0.1:${adminPort}/admin/`, command)
    return { tested: true, adminPort, fallbackPort, adminPortTakesPrecedence: true, htmlAndAssetsResponsive: true }
  } finally { await stopCommand(command) }
}

async function hmrProbe(browser, admin, maxBin, evidenceDirectory, ownedSystemPackage) {
  const port = await freePort()
  const url = `http://127.0.0.1:${port}/reuse/?page=./modules/catalog/index`
  const command = startCommand(maxBin, ['dev'], admin, join(evidenceDirectory, 'dev.log'), { NODE_ENV: 'development', PORT: String(port), HOST: '127.0.0.1' })
  const page = await browser.newPage()
  const catalogFile = join(admin, 'src/modules/catalog/pages/index/index.tsx')
  const originalCatalog = readFileSync(catalogFile, 'utf8')
  const regionFile = createRequire(join(admin, 'package.json')).resolve('@yishan/core-system-admin/pages/region')
  assert.ok(realpathSync(regionFile).startsWith(`${realpathSync(ownedSystemPackage)}${sep}`), 'System HMR must mutate only the owned package copy')
  const originalRegion = readFileSync(regionFile, 'utf8')
  const header = originalRegion.match(/headerTitle="([^"\n]+)"/)
  assert.ok(header, 'Region must expose a visible table title for the HMR probe')
  const updatedHeader = `${header[1]} HMR`
  await page.route('**/api/v1/admin/system/regions/tree**', route => route.fulfill({ json: { success: true, data: [{ code: 110000, name: '北京市', level: 1, parentCode: 0, sortOrder: 0 }] } }))
  try {
    await waitForHttp(url, command)
    await page.goto(url)
    await page.getByTestId('catalog-version').waitFor()
    await page.evaluate(() => { window.__reuseDocumentMarker = 'same-document' })
    writeFileSync(catalogFile, originalCatalog.replace('catalog fixture v1', 'catalog fixture v2'))
    await page.getByText('catalog fixture v2', { exact: true }).waitFor({ timeout: 60_000 })
    assert.equal(await page.evaluate(() => window.__reuseDocumentMarker), 'same-document', 'HMR must preserve the document')
    await page.screenshot({ path: join(evidenceDirectory, 'hmr-catalog.png') })
    await page.goto(`http://127.0.0.1:${port}/reuse/?page=./system/region`)
    await page.getByText('北京市', { exact: true }).waitFor()
    await page.getByText(header[1], { exact: true }).waitFor()
    await page.evaluate(() => { window.__reuseDocumentMarker = 'system-same-document' })
    writeFileSync(regionFile, originalRegion.replace(header[0], `headerTitle="${updatedHeader}"`))
    await page.getByText(updatedHeader, { exact: true }).waitFor({ timeout: 60_000 })
    assert.equal(await page.evaluate(() => window.__reuseDocumentMarker), 'system-same-document', 'Public System source HMR must preserve the document')
    await page.screenshot({ path: join(evidenceDirectory, 'hmr-system-region.png') })
    return { localModuleHmr: true, documentPreserved: true, systemSourceHmr: true, systemDocumentPreserved: true, ownedRegionSource: regionFile, updatedSystemTitle: updatedHeader }
  } finally {
    writeFileSync(catalogFile, originalCatalog)
    writeFileSync(regionFile, originalRegion)
    await page.close()
    await stopCommand(command)
  }
}

function sourceWatcherEvidence(requireFromAdmin, admin, systemPages) {
  const paths = Object.values(systemPages).map(specifier => requireFromAdmin.resolve(specifier))
  const file = join(admin, 'node_modules/.cache/reuse-watchers.json')
  const observed = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null
  if (observed) assert.ok(paths.every(path => observed.includes(path)), 'Umi must register every public System source entry for watching')
  return { publicSystemSourcePaths: paths, observedUmiWatcherPaths: observed, evidenceFile: observed ? file : null }
}

async function buildFixture(admin, maxBin, tscBin, installed, systemPages, logDirectory, publicPath = '/reuse/') {
  console.log(`Building ${admin} (${installed.join(', ')})`)
  await runCommand(maxBin, ['build'], admin, join(logDirectory, 'build.log'), { NODE_ENV: 'production', PUBLIC_PATH: '/admin/' })
  const keys = validateRegistry(admin, installed, systemPages)
  const html = readFileSync(join(admin, 'dist/index.html'), 'utf8')
  const emittedResources = [...html.matchAll(/(?:src|href)="([^" ]+\.(?:js|css))"/g)].map(match => match[1])
  assert.ok(emittedResources.length && emittedResources.every(resource => resource.startsWith(publicPath)), 'HTML resources must respect the configured public path')
  for (const file of readdirSync(join(admin, 'dist')).filter(file => file.endsWith('.js'))) assert.ok(!readFileSync(join(admin, 'dist', file), 'utf8').includes('UNINSTALLED_REUSE_FIXTURE_MUST_NOT_COMPILE'), 'The uninstalled fixture must not be compiled')
  const configPath = join(admin, 'tsconfig.json')
  const config = JSON.parse(readFileSync(configPath, 'utf8'))
  config.compilerOptions.paths['@@/*'] = ['./src/.umi-production/*']
  config.include = [...config.include, './src/.umi-production/**/*.d.ts']
  writeFileSync(configPath, JSON.stringify(config, null, 2))
  await runCommand(tscBin, ['-p', 'tsconfig.json', '--noEmit'], admin, join(logDirectory, 'typecheck.log'))
  return { installed, generatedKeys: keys, productionBuild: true, hostTypecheck: true, publicPath, emittedResources, excludedFixtureNotCompiled: true, buildLog: join(logDirectory, 'build.log'), typecheckLog: join(logDirectory, 'typecheck.log') }
}

function copyActualProduct(adminSource, apiSource, target, ids, moduleIds) {
  const admin = join(target, 'admin')
  cpSync(adminSource, admin, { recursive: true, dereference: false, filter: file => !file.split(/[\\/]/).some(part => ['node_modules', 'dist', '.git', '.openai', '.playwright', 'playwright-report', 'test-results', '.umi', '.umi-production', '.umi-test'].includes(part)) })
  const api = join(target, 'api')
  mkdirSync(join(api, 'src'), { recursive: true })
  cpSync(join(apiSource, 'openapi.json'), join(api, 'openapi.json'))
  writeFiles(target, { 'api/package.json': JSON.stringify({ name: '@reuse-fixture/copied-api', private: true }), 'api/src/manifest.ts': manifestSource(ids), ...Object.fromEntries(moduleIds.map(id => [`api/src/modules/${id}/module.ts`, `export default {id:${JSON.stringify(id)},version:'1.0.0'} as const\n`])) })
  return admin
}

export async function main(args = process.argv.slice(2)) {
  const options = parseArguments(args)
  const adminSource = realpathSync(resolve(options.admin))
  const dependencyRoot = join(adminSource, 'node_modules')
  const requireFromAdmin = createRequire(join(adminSource, 'package.json'))
  const { systemPages } = requireFromAdmin('@yishan/core-system-admin/umi')
  const maxBin = executable(requireFromAdmin, '@umijs/max', 'max')
  const tscBin = executable(requireFromAdmin, 'typescript', 'tsc')
  const artifacts = mkdtempSync(join(tmpdir(), 'yishan-admin-reuse-'))
  const browserChannel = process.env.PLAYWRIGHT_CHANNEL
  const report = { node: process.version, browserChannel: browserChannel || 'Playwright default Chromium', adminDependencyGraph: adminSource, artifacts, syntheticProducts: [], copiedActualProducts: [], sourceMutationScope: 'HMR mutates and restores only owned temp copies; repository package source is never changed.' }
  console.log(`Reuse verification artifacts: ${artifacts}`)
  let browser
  try {
    if (options.mode !== 'product') {
      console.log(`Launching ${browserChannel || 'Playwright Chromium'} for independent consumer checks`)
      browser = await requireFromAdmin('@playwright/test').chromium.launch({ ...(browserChannel ? { channel: browserChannel } : {}), headless: true })
      for (const ids of options.combinations) {
        const target = join(artifacts, `consumer-${ids.join('-')}`)
        writeFiles(target, fixtureSources(ids))
        const admin = join(target, 'admin')
        const ownedSystemPackage = join(target, 'external-system-admin')
        const packageCopy = copyOwnedSystemPackage(dirname(dirname(requireFromAdmin.resolve('@yishan/core-system-admin/umi'))), ownedSystemPackage)
        const originalRegionFile = requireFromAdmin.resolve('@yishan/core-system-admin/pages/region')
        const originalRegion = readFileSync(originalRegionFile, 'utf8')
        linkDependencies(dependencyRoot, join(admin, 'node_modules'), { '@yishan/core-system-admin': ownedSystemPackage })
        const fixtureRequire = createRequire(join(admin, 'package.json'))
        const react = fixtureRequire.resolve('react')
        assert.equal(realpathSync(react), realpathSync(createRequire(fixtureRequire.resolve('@yishan/core-system-admin/pages/region')).resolve('react')), 'System and product must resolve one React singleton')
        const result = await buildFixture(admin, maxBin, tscBin, ids, systemPages, target)
        result.systemPackageCopy = packageCopy
        result.reactSingleton = react
        result.browser = await browserProbe(browser, admin, target)
        if (options.hmr && ids === options.combinations.at(-1)) result.hmr = await hmrProbe(browser, admin, maxBin, target, ownedSystemPackage)
        assert.equal(readFileSync(originalRegionFile, 'utf8'), originalRegion, 'Repository System Region source must remain byte-for-byte unchanged')
        result.repositorySystemSourceUnchanged = true
        result.watchers = sourceWatcherEvidence(fixtureRequire, admin, systemPages)
        if (result.hmr) assert.ok(result.watchers.observedUmiWatcherPaths, 'Dev probe must observe the actual Umi source watcher callback')
        report.syntheticProducts.push(result)
      }
    }
    if (options.mode !== 'reuse') {
      const apiSource = resolve(adminSource, '../api')
      const moduleIds = requireFromAdmin('@yishan/core-admin/manifest').readInstalledModules(apiSource).map(module => module.id)
      assert.ok(moduleIds.length, 'The actual product must install a module')
      const combinations = moduleIds.length === 1 ? [moduleIds] : [[moduleIds[0]], moduleIds]
      for (const ids of combinations) {
        const target = join(artifacts, `actual-${ids.join('-')}`)
        const admin = copyActualProduct(adminSource, apiSource, target, ids, moduleIds)
        linkDependencies(dependencyRoot, join(admin, 'node_modules'))
        const result = await buildFixture(admin, maxBin, tscBin, ids, systemPages, target, '/admin/')
        if (options.hmr && ids === combinations.at(-1)) result.starter = await starterProbe(admin, target)
        report.copiedActualProducts.push(result)
      }
    }
    report.success = true
    console.log(`PASS: ${report.syntheticProducts.length} independent consumers; ${report.copiedActualProducts.length} actual product manifest builds`)
    return report
  } catch (error) {
    report.success = false
    report.error = error.message
    throw error
  } finally {
    if (browser) await browser.close()
    writeFileSync(join(artifacts, 'report.json'), JSON.stringify(report, null, 2))
    console.log(`Evidence report: ${join(artifacts, 'report.json')}`)
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1 })
