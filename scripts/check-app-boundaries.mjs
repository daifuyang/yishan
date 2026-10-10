import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const ts = createRequire(join(here, '../packages/core/app/package.json'))('typescript')
const sharedPaths = ['packages/core/app', 'packages/ui', 'packages/yishan-tiptap']
const ignored = new Set(['node_modules', 'dist', 'build', 'coverage', 'example', '.git'])
function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = join(directory, entry.name)
    return entry.isDirectory() ? ignored.has(entry.name) ? [] : walk(file) : /\.(?:[cm]?[jt]sx?|s[ac]ss|css)$/.test(entry.name) ? [file] : []
  })
}
function specifiers(file) {
  const result = []
  if (/\.(?:s[ac]ss|css)$/.test(file)) return [...readFileSync(file, 'utf8').matchAll(/@(?:use|forward|import)\s+['"]([^'"]+)['"]/g)].map(match => match[1])
  const visit = node => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) result.push(node.moduleSpecifier.text)
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteralLike(node.argument.literal)) result.push(node.argument.literal.text)
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || ts.isIdentifier(node.expression) && node.expression.text === 'require' || ts.isPropertyAccessExpression(node.expression) && ts.isIdentifier(node.expression.expression) && node.expression.expression.text === 'require' && node.expression.name.text === 'resolve') && node.arguments.length === 1 && ts.isStringLiteralLike(node.arguments[0])) result.push(node.arguments[0].text)
    ts.forEachChild(node, visit)
  }
  visit(ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true))
  return result
}
export function collectAppBoundaryErrors(root) {
  root = resolve(root)
  const packages = []
  const scan = directory => {
    if (!existsSync(directory)) return
    if (existsSync(join(directory, 'package.json'))) {
      packages.push({ directory, manifest: JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8')) })
      return
    }
    for (const entry of readdirSync(directory, { withFileTypes: true })) if (entry.isDirectory() && !ignored.has(entry.name)) scan(join(directory, entry.name))
  }
  scan(join(root, 'apps')); scan(join(root, 'packages'))
  const byName = new Map(packages.map(pkg => [pkg.manifest.name, pkg]))
  const errors = []
  const shared = new Set(sharedPaths.map(location => join(root, location)))
  for (const owner of packages.filter(pkg => shared.has(pkg.directory) || pkg.manifest.name === 'yishan-app')) {
    const dependency = (name, report) => {
      const target = byName.get(name)
      if (shared.has(owner.directory) && target && relative(root, target.directory).startsWith('apps' + sep)) report('shared packages cannot depend on products')
      if (['@yishan/core-api', '@yishan/core-system-api', '@yishan/core-database', '@yishan/core-admin', '@yishan/core-system-admin'].includes(name)) report('mobile packages cannot depend on server/Admin runtime')
    }
    for (const kind of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
      for (const name of Object.keys(owner.manifest[kind] ?? {})) dependency(name, message => errors.push(owner.manifest.name + ': ' + message + ' (' + name + ')'))
    }
    for (const file of walk(owner.directory)) for (const specifier of specifiers(file)) {
      const report = message => errors.push(relative(root, file) + ': ' + message + ' (' + specifier + ')')
      const name = specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0]
      dependency(name, report)
      const target = byName.get(name)
      if (target && target !== owner) {
        const subpath = specifier === name ? '.' : '.' + specifier.slice(name.length)
        const exports = target.manifest.exports
        const exposed = typeof exports === 'string' ? subpath === '.' : exports && Object.hasOwn(exports, subpath) && exports[subpath] !== null
        if (!exposed) report('cross-package import must use a public export')
      }
      if (specifier.startsWith('.')) {
        const targetPath = resolve(dirname(file), specifier)
        // Runtime sources cannot reach another workspace's private files. Test loaders may read fixtures.
        if (!file.includes(sep + 'tests' + sep) && !targetPath.startsWith(owner.directory + sep) && targetPath !== owner.directory) report('cross-package relative import is forbidden')
      }
    }
  }
  return errors
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const errors = collectAppBoundaryErrors(process.argv[2] ?? join(here, '..'))
  if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1 }
  else console.log('[app-boundaries] public exports and product-independent shared packages verified')
}
