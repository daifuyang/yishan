import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const ts = createRequire(join(here, '../packages/core/app/package.json'))('typescript')
const sharedPaths = ['packages/core/app', 'packages/ui', 'packages/yishan-tiptap']
const ignored = new Set(['node_modules', 'dist', 'build', 'coverage', 'example', '.git', '.docusaurus'])
const serverAdmin = new Set(['@yishan/core-api', '@yishan/core-system-api', '@yishan/core-database', '@yishan/core-admin', '@yishan/core-system-admin'])
function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = join(directory, entry.name)
    return entry.isDirectory() ? ignored.has(entry.name) ? [] : walk(file) : /\.(?:[cm]?[jt]sx?|s[ac]ss|css)$/.test(entry.name) ? [file] : []
  })
}
function specifiers(file) {
  const result = []
  if (/\.(?:s[ac]ss|css)$/.test(file)) {
    // Literal style directives only; include quoted url() and comma-separated imports.
    // Comments/other strings are skipped; Sass variables and interpolation are not resolved.
    for (const match of readFileSync(file, 'utf8').matchAll(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|@(?:use|forward|import)\s+((?:(?:['"][^'"]+['"]|url\(\s*['"][^'"]+['"]\s*\))\s*,?\s*)+)/gi)) {
      if (match[1]) for (const literal of match[1].matchAll(/['"]([^'"]+)['"]/g)) if (!literal[1].includes('#{')) result.push(literal[1])
    }
    return result
  }
  const visit = node => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) result.push(node.moduleSpecifier.text)
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteralLike(node.argument.literal)) result.push(node.argument.literal.text)
    if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference) && node.moduleReference.expression && ts.isStringLiteralLike(node.moduleReference.expression)) result.push(node.moduleReference.expression.text)
    // Computed import()/require()/require.resolve() arguments are intentionally unsupported.
    // Extra arguments (import attributes or resolver options) do not change a literal target.
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || ts.isIdentifier(node.expression) && node.expression.text === 'require' || ts.isPropertyAccessExpression(node.expression) && ts.isIdentifier(node.expression.expression) && node.expression.expression.text === 'require' && node.expression.name.text === 'resolve') && node.arguments.length >= 1 && ts.isStringLiteralLike(node.arguments[0])) result.push(node.arguments[0].text)
    ts.forEachChild(node, visit)
  }
  visit(ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true))
  return result
}
function exposes(exports, subpath) {
  // Check the public surface across conditions, not a particular runtime's condition flags.
  const hasTarget = value => typeof value === 'string' ? value.startsWith('./') : value !== null && typeof value === 'object' && Object.values(value).some(hasTarget)
  if (!exports || typeof exports === 'string' || Array.isArray(exports)) return subpath === '.' && hasTarget(exports)
  const keys = Object.keys(exports)
  if (keys.every(key => !key.startsWith('.'))) return subpath === '.' && hasTarget(exports)
  if (Object.hasOwn(exports, subpath)) return hasTarget(exports[subpath])
  // Node picks the most specific pattern, so a null exclusion cannot fall back to a broader one.
  const match = keys.filter(key => {
    const parts = key.split('*')
    return parts.length === 2 && subpath.length >= parts[0].length + parts[1].length && subpath.startsWith(parts[0]) && subpath.endsWith(parts[1])
  }).sort((a, b) => b.indexOf('*') - a.indexOf('*') || b.length - a.length)[0]
  return match !== undefined && hasTarget(exports[match])
}
function contains(directory, file) {
  const location = relative(directory, file)
  return location === '' || location !== '..' && !location.startsWith('..' + sep) && !isAbsolute(location)
}
export function collectAppBoundaryErrors(root) {
  root = resolve(root)
  const packages = []
  const scan = directory => {
    if (!existsSync(directory)) return
    if (existsSync(join(directory, 'package.json'))) {
      const location = relative(root, directory).split(sep).join('/')
      packages.push({ directory, manifest: JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8')), product: location.startsWith('apps/') ? location.split('/')[1] : undefined, serverAdmin: /^apps\/[^/]+\/(?:api|admin)$/.test(location) })
      return
    }
    for (const entry of readdirSync(directory, { withFileTypes: true })) if (entry.isDirectory() && !ignored.has(entry.name)) scan(join(directory, entry.name))
  }
  scan(join(root, 'apps')); scan(join(root, 'packages'))
  const byName = new Map(packages.map(pkg => [pkg.manifest.name, pkg]))
  const errors = []
  const shared = new Set(sharedPaths.map(location => join(root, location)))
  const docsDirectory = join(root, 'apps/docs')
  for (const owner of packages) {
    const mobile = shared.has(owner.directory) || /^apps\/[^/]+\/app$/.test(relative(root, owner.directory).split(sep).join('/'))
    const docs = owner.directory === docsDirectory
    const dependency = (name, report, target = byName.get(name)) => {
      if (target?.directory === docsDirectory && !docs) report('other workspace packages cannot depend on Docs')
      if (mobile && shared.has(owner.directory) && target?.product) report('shared packages cannot depend on products')
      if ((mobile || docs) && owner.product && target?.product && owner.product !== target.product) report('cross-product dependency is forbidden')
      if (mobile && (serverAdmin.has(name) || target?.serverAdmin)) report('mobile packages cannot depend on server/Admin runtime')
    }
    for (const kind of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
      for (const name of Object.keys(owner.manifest[kind] ?? {})) dependency(name, message => errors.push(owner.manifest.name + ': ' + message + ' (' + name + ')'))
    }
    for (const file of walk(owner.directory)) for (const specifier of specifiers(file)) {
      const report = message => errors.push(relative(root, file) + ': ' + message + ' (' + specifier + ')')
      let normalized = specifier.replaceAll('\\', '/')
      if (normalized.startsWith('file:')) {
        try { normalized = fileURLToPath(specifier).replaceAll('\\', '/') }
        catch { if (mobile || docs) report('invalid file URL import'); continue }
      }
      const absolute = isAbsolute(normalized) || /^[A-Za-z]:\//.test(normalized)
      const targetPath = absolute ? resolve(normalized) : normalized.startsWith('.') ? resolve(dirname(file), normalized) : normalized.startsWith('@/') ? resolve(owner.directory, 'src', normalized.slice(2)) : docs && normalized.startsWith('@site/') ? resolve(owner.directory, normalized.slice(6)) : undefined
      if (targetPath) {
        const target = packages.find(pkg => contains(pkg.directory, targetPath))
        dependency(target?.manifest.name, report, target)
        if ((mobile || docs) && !contains(owner.directory, targetPath)) report(`cross-package ${absolute ? 'absolute' : 'relative'} import is forbidden`)
        continue
      }
      const name = normalized.startsWith('@') ? normalized.split('/').slice(0, 2).join('/') : normalized.split('/')[0]
      dependency(name, report)
      const target = byName.get(name)
      if ((mobile || docs) && target && target !== owner) {
        const subpath = normalized === name ? '.' : '.' + normalized.slice(name.length)
        if (!exposes(target.manifest.exports, subpath)) report('cross-package import must use a public export')
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
