import { createRequire } from 'node:module'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const ts = createRequire(join(scriptDirectory, '../packages/core/api/package.json'))('typescript')
const ignored = new Set(['node_modules', 'dist', 'build', 'coverage', '.git', '.umi', '.umi-production', '.cache', '.build', 'example'])
const frontendCore = new Set(['@yishan/core-admin', '@yishan/core-system-admin'])
const backendCore = new Set(['@yishan/core-api', '@yishan/core-system-api', '@yishan/core-database'])

function packages(root) {
  const result = []
  const visit = directory => {
    if (!existsSync(directory)) return
    if (existsSync(join(directory, 'package.json'))) {
      const location = relative(root, directory).replaceAll('\\', '/')
      const manifest = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'))
      result.push({ directory, manifest, core: location.startsWith('packages/core/'), product: location.startsWith('apps/') && !location.startsWith('apps/yishan-components/') ? location.split('/')[1] : undefined, admin: frontendCore.has(manifest.name) || /^apps\/[^/]+\/admin$/.test(location) })
      return
    }
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory() && !ignored.has(entry.name)) visit(join(directory, entry.name))
    }
  }
  visit(join(root, 'packages'))
  visit(join(root, 'apps'))
  return result
}

function sourceFiles(directory, includeBuildSource = false) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const target = join(directory, entry.name)
    const excluded = ignored.has(entry.name) && !(includeBuildSource && entry.name === 'build')
    return entry.isDirectory() ? excluded ? [] : sourceFiles(target, includeBuildSource) : /\.[cm]?[jt]sx?$/.test(entry.name) ? [target] : []
  })
}

function imports(file) {
  const found = []
  const visit = node => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) found.push(node.moduleSpecifier.text)
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteralLike(node.argument.literal)) found.push(node.argument.literal.text)
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || ts.isIdentifier(node.expression) && node.expression.text === 'require') && node.arguments.length === 1 && ts.isStringLiteralLike(node.arguments[0])) found.push(node.arguments[0].text)
    ts.forEachChild(node, visit)
  }
  visit(ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true))
  return found
}

function exposes(manifest, subpath) {
  const exports = manifest.exports
  if (!exports || typeof exports === 'string') return subpath === '.'
  const keys = Object.keys(exports)
  if (keys.every(key => !key.startsWith('.'))) return subpath === '.'
  if (Object.hasOwn(exports, subpath)) return exports[subpath] !== null
  // Node resolves the most specific matching export, including null exclusions.
  const match = keys.filter(key => key.includes('*') && subpath.startsWith(key.split('*')[0]) && subpath.endsWith(key.split('*')[1])).sort((a, b) => b.split('*')[0].length - a.split('*')[0].length || b.length - a.length)[0]
  return match !== undefined && exports[match] !== null
}

export function collectAdminBoundaryErrors(repositoryRoot) {
  const errors = []
  const all = packages(resolve(repositoryRoot))
  const byName = new Map(all.map(pkg => [pkg.manifest.name, pkg]))
  for (const owner of all.filter(pkg => pkg.admin)) {
    const checkDependency = (name, report) => {
      const target = byName.get(name)
      if (owner.core && target?.product) report('Core cannot depend on products')
      if (owner.product && target?.product && owner.product !== target.product) report('cross-product dependency is forbidden')
      if (backendCore.has(name) || owner.manifest.name === '@yishan/core-admin' && name === '@yishan/core-system-admin') report(`forbidden dependency ${owner.manifest.name} -> ${name}`)
    }
    for (const kind of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
      for (const name of Object.keys(owner.manifest[kind] ?? {})) checkDependency(name, message => errors.push(`${owner.manifest.name}/package.json: ${message} (${name})`))
    }
    // Core Admin's build/ contains shipped CJS plugin source, not build output.
    for (const file of sourceFiles(owner.directory, owner.core)) {
      for (const specifier of imports(file)) {
        const report = message => errors.push(`${owner.manifest.name}/${relative(owner.directory, file).replaceAll('\\', '/')}: ${message} (${specifier})`)
        const name = specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0]
        checkDependency(name, report)
        const target = byName.get(name)
        const subpath = specifier === name ? '.' : `.${specifier.slice(name.length)}`
        if (target && target !== owner && !exposes(target.manifest, subpath)) report('cross-package import must use a public export')
        const targetPath = specifier.startsWith('.') ? resolve(dirname(file), specifier) : specifier.startsWith('@/') ? resolve(owner.directory, 'src', specifier.slice(2)) : undefined
        if (targetPath && targetPath !== owner.directory && !targetPath.startsWith(`${owner.directory}${sep}`)) report('cross-package relative import must use a public export')
      }
    }
  }
  return errors
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const errors = collectAdminBoundaryErrors(resolve(process.argv[2] ?? join(scriptDirectory, '..')))
  if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1 }
  else console.log('[admin-boundaries] public exports and dependency boundaries verified')
}
