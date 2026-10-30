import { readFileSync, readdirSync, existsSync, realpathSync, statSync, lstatSync, readlinkSync, mkdirSync, mkdtempSync, cpSync, rmSync, writeFileSync, symlinkSync } from 'node:fs'
import { join, resolve, dirname, relative, isAbsolute, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire, isBuiltin } from 'node:module'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import manifest from '@yishan/core-admin/manifest'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function contains(root, target) {
  const rel = relative(root, target)
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

/**
 * 产物里的符号链接必须是**相对**路径，否则产物只在本机能用。
 *
 * 为什么这条必须单独查：`contains(artifactRoot, realpathSync(link))` 只保证链接
 * 指向产物内部，Windows 上 `pnpm deploy` 生成的 junction（目标形如
 * `\?\C:\Users\...`）指向的确实是内部路径，能通过检查 —— 但拷到任何另一台机器
 * 都是死链。症状是部署后才暴露的 `Cannot find module 'dotenv/config'`，那时产物
 * 已经进了发布目录。
 *
 * 为什么不能在事后「修正」：Windows junction 不支持相对目标，没有后处理的空间。
 * 唯一的正确做法是在打包机上就拒绝 —— 即在 Linux / CI 上打包。
 */
export function assertPortableLink(target, label, allow = false) {
  if (allow) return
  if (isAbsolute(target) || /^[A-Za-z]:/.test(target) || target.startsWith('\\\\')) {
    throw new Error([
      `Artifact link is not portable: ${label} -> ${target}`,
      'pnpm on Windows emits absolute junction targets, so this artifact only works on this machine.',
      'Build on Linux (or CI) to produce a deployable artifact.',
      'Pass --allow-nonportable-links only for a local smoke check, never for deployment.',
    ].join('\n'))
  }
}

function exportTargets(value) {
  if (typeof value === 'string') return [value]
  if (!value || typeof value !== 'object') return []
  return Object.values(value).flatMap(exportTargets)
}

function verifyPackage(directory, artifactRoot) {
  const packageJson = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'))
  for (const target of [...exportTargets(packageJson.exports), packageJson.main, packageJson.types].filter(Boolean)) {
    if (!target.startsWith('./') && !target.startsWith('dist/')) throw new Error(`Export must point to package-local compiled files: ${packageJson.name}/${target}`)
    const absolute = resolve(directory, target)
    if (!contains(directory, absolute)) throw new Error(`Export escapes package: ${packageJson.name}/${target}`)
    if (target.includes('*')) {
      const expression = new RegExp(`^${basename(target).split('*').map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.+')}$`)
      if (!existsSync(dirname(absolute)) || !readdirSync(dirname(absolute)).some(name => expression.test(name))) throw new Error(`Missing wildcard export: ${packageJson.name}/${target}`)
    } else if (!existsSync(absolute)) throw new Error(`Missing export file: ${packageJson.name}/${target}`)
  }
  if (!contains(artifactRoot, realpathSync(directory))) throw new Error(`Package link escapes artifact: ${packageJson.name}`)
  return packageJson
}

export function verifyApiArtifact(directory, { allowNonPortableLinks = false } = {}) {
  const artifactRoot = realpathSync(directory)
  const application = verifyPackage(artifactRoot, artifactRoot)
  const visited = new Set()
  const workspace = new Set()
  const verifyDependencies = (packageJson, packageRoot) => {
    const require = createRequire(join(packageRoot, 'package.json'))
    for (const name of Object.keys(packageJson.dependencies ?? {})) {
      if (isBuiltin(name)) continue
      const specifier = packageJson.dependencies[name]
      const actualName = specifier.startsWith('npm:') ? /^npm:((?:@[^/]+\/)?[^@]+)/.exec(specifier)?.[1] ?? name : name
      let entry
      try { entry = require.resolve(name) }
      catch (error) {
        if (error.code !== 'ERR_PACKAGE_PATH_NOT_EXPORTED') throw error
        const packageFile = require.resolve.paths(name).map(directory => join(directory, name, 'package.json')).find(existsSync)
        if (!packageFile) throw error
        entry = packageFile
      }
      if (!contains(artifactRoot, realpathSync(entry))) throw new Error(`Dependency resolves outside artifact: ${name}`)
      let root = dirname(entry)
      while (!existsSync(join(root, 'package.json')) || JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).name !== actualName) {
        const parent = dirname(root)
        if (parent === root) throw new Error(`Cannot locate artifact package: ${name}`)
        root = parent
      }
      root = realpathSync(root)
      if (visited.has(root)) continue
      visited.add(root)
      const dependency = name.startsWith('@yishan/') ? verifyPackage(root, artifactRoot) : JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
      if (name.startsWith('@yishan/')) workspace.add(name)
      if (name === '@yishan/core-system-api') {
        for (const resource of ['dist/drizzle/meta/_journal.json', 'dist/scripts/seed/config/pca-code.json']) {
          if (!existsSync(join(root, resource))) throw new Error(`Missing runtime resource: ${name}/${resource}`)
        }
      }
      verifyDependencies(dependency, root)
    }
  }
  verifyDependencies(application, artifactRoot)
  const walk = dir => {
    for (const entry of readdirSync(dir)) {
      const target = join(dir, entry)
      const stats = lstatSync(target)
      if (stats.isSymbolicLink()) {
        if (!contains(artifactRoot, realpathSync(target))) throw new Error(`Artifact symlink escapes output: ${relative(artifactRoot, target)}`)
        assertPortableLink(readlinkSync(target), relative(artifactRoot, target), allowNonPortableLinks)
      } else if (stats.isDirectory()) walk(target)
      else if (entry === '.env' || /^\.env\./.test(entry)) throw new Error(`Artifact contains an environment file: ${relative(artifactRoot, target)}`)
    }
  }
  walk(artifactRoot)
  return [...workspace]
}

export function smokeApiArtifact(directory) {
  if (contains(repositoryRoot, resolve(directory))) {
    const temporary = mkdtempSync(join(tmpdir(), 'yishan-api-relocated-'))
    try {
      const links = []
      cpSync(directory, temporary, { recursive: true, filter(source, destination) {
        if (!lstatSync(source).isSymbolicLink()) return true
        const sourceTarget = realpathSync(source)
        if (!contains(resolve(directory), sourceTarget)) throw new Error(`Artifact symlink escapes output: ${source}`)
        links.push({ source, destination, target: join(temporary, relative(resolve(directory), sourceTarget)) })
        return false
      } })
      for (const link of links) {
        const isDirectory = statSync(link.source).isDirectory()
        const type = process.platform === 'win32' && isDirectory ? 'junction' : (isDirectory ? 'dir' : 'file')
        // 重建链接必须用**相对**目标。link.target 指向临时目录里的绝对路径，
        // 直接拿来建链接会让紧随其后的 verifyApiArtifact 立刻判定"不可移植"
        // 并失败 —— 那是自己刚建的链接。Windows 的 junction 不支持相对目标，
        // 保持原样（这类产物本来就不能跨机器部署）。
        const target = type === 'junction' ? link.target : relative(dirname(link.destination), link.target)
        symlinkSync(target, link.destination, type)
      }
      verifyApiArtifact(temporary)
      smokeApiArtifact(temporary)
    } finally { rmSync(temporary, { recursive: true, force: true }) }
    return
  }
  const script = `const {createRequire}=require('node:module'); const req=createRequire(process.cwd()+'/package.json'); const application=req('./package.json'); const entry=application.exports?.['.']?.default; if(entry) req(entry); for(const name of ['@yishan/core-contracts','@yishan/core-database','@yishan/core-system-api']) req(name); req('@yishan/core-api').createYishanApi({modules:[],context:{}}).then(app=>app.inject('/missing').then(response=>{if(response.json().code!==25005)throw new Error('Missing envelope');return app.close()})).catch(error=>{console.error(error);process.exitCode=1})`
  const result = spawnSync(process.execPath, ['-e', script], { cwd: directory, stdio: 'inherit', env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP, TMP: process.env.TMP } })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error('Standalone artifact import/startup smoke failed')
}

export function pruneUninstalledModules(directory, modules) {
  const modulesRoot = join(resolve(directory), 'dist/modules')
  if (!existsSync(modulesRoot)) return
  const installed = new Set(modules.map(module => module.id))
  for (const entry of readdirSync(modulesRoot, { withFileTypes: true })) {
    if (entry.isDirectory() && !installed.has(entry.name)) rmSync(join(modulesRoot, entry.name), { recursive: true, force: true })
  }
}

export function packageApi({ apiRoot = join(repositoryRoot, 'apps/demo/api'), output, admin, allowNonPortableLinks = false }) {
  const root = resolve(apiRoot)
  const target = resolve(output ?? join(root, 'deploy/fc3/.build/function-code'))
  if (contains(target, repositoryRoot) || contains(target, root)) throw new Error('Artifact output cannot contain the repository or application source')
  if (existsSync(target) && readdirSync(target).length) {
    const marker = join(target, '.yishan-api-artifact-owner.json')
    if (!existsSync(marker) || JSON.parse(readFileSync(marker, 'utf8')).application !== root) throw new Error(`Output is not a previously generated API artifact: ${target}`)
    rmSync(target, { recursive: true, force: true })
  }
  mkdirSync(dirname(target), { recursive: true })
  const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
  const deployment = spawnSync(command, ['--filter', packageJson.name, 'deploy', '--prod', target], { cwd: repositoryRoot, stdio: 'inherit', shell: process.platform === 'win32' })
  if (deployment.error) throw deployment.error
  if (deployment.status !== 0) throw new Error(`pnpm deploy failed: ${deployment.status}`)
  writeFileSync(join(target, '.yishan-api-artifact-owner.json'), JSON.stringify({ application: root }))
  const installed = manifest.readInstalledModules(root)
  pruneUninstalledModules(target, installed)
  for (const module of installed) {
    const resources = join(target, 'dist/modules', module.id, 'drizzle')
    if (module.local && existsSync(join(dirname(module.entry), 'drizzle')) && !existsSync(join(resources, 'meta/_journal.json'))) throw new Error(`Missing module migration resources: ${module.id}`)
  }
  if (admin) {
    const resources = resolve(admin)
    if (!statSync(resources).isDirectory() || !existsSync(join(resources, 'index.html'))) throw new Error(`Admin build does not contain index.html: ${resources}`)
    cpSync(resources, join(target, 'public/admin'), { recursive: true })
  }
  const dependencies = verifyApiArtifact(target, { allowNonPortableLinks })
  smokeApiArtifact(target)
  writeFileSync(join(target, '.yishan-api-artifact.json'), JSON.stringify({ application: root, dependencies }, null, 2))
  console.log(`[api-package] standalone production closure verified: ${target}`)
  return target
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  const options = {}
  for (let index = 0; index < args.length; index += 2) {
    if (args[index] === '--allow-nonportable-links') {
      // 无值开关，所以要自己把游标往前挪一格（下面的循环按 2 步进）。
      options.allowNonPortableLinks = true
      index -= 1
      continue
    }
    const key = { '--api': 'apiRoot', '--output': 'output', '--admin': 'admin' }[args[index]]
    if (!key || !args[index + 1]) throw new Error('Usage: node scripts/package-api.mjs [--api path] [--output path] [--admin path] [--allow-nonportable-links]')
    options[key] = args[index + 1]
  }
  packageApi(options)
}
