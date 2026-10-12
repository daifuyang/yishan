const fs = require('node:fs')
const path = require('node:path')
const { createRequire } = require('node:module')
const ts = createRequire(path.join(__dirname, '../packages/core/api/package.json'))('typescript')

function sourceFiles(directory) {
  if (!fs.existsSync(directory)) return []
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const target = path.join(directory, entry.name)
    return entry.isDirectory() ? sourceFiles(target) : /\.[cm]?[jt]sx?$/.test(entry.name) ? [target] : []
  })
}

function imports(source) {
  const found = []
  const visit = node => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const clause = node.importClause
      const bindings = clause?.namedBindings
      const names = bindings && ts.isNamedImports(bindings) ? bindings.elements.filter(element => !element.isTypeOnly).map(element => (element.propertyName ?? element.name).text) : []
      found.push({ specifier: node.moduleSpecifier.text, typeOnly: clause?.isTypeOnly || node.isTypeOnly, names, namespace: !!(bindings && ts.isNamespaceImport(bindings)) })
    }
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require')) && node.arguments.length === 1 && ts.isStringLiteralLike(node.arguments[0])) found.push({ specifier: node.arguments[0].text, namespace: true })
    ts.forEachChild(node, visit)
  }
  visit(source)
  return found
}

function exportTargets(value) {
  if (typeof value === 'string') return [value]
  return value && typeof value === 'object' ? Object.values(value).flatMap(exportTargets) : []
}

function exportedTargets(manifest, subpath) {
  if (Object.hasOwn(manifest.exports ?? {}, subpath)) return exportTargets(manifest.exports[subpath])
  for (const [key, value] of Object.entries(manifest.exports ?? {})) {
    if (!key.includes('*')) continue
    const [prefix, suffix] = key.split('*')
    if (subpath.startsWith(prefix) && subpath.endsWith(suffix)) {
      const replacement = subpath.slice(prefix.length, suffix ? -suffix.length : undefined)
      return exportTargets(value).map(target => target.replace('*', replacement))
    }
  }
  return []
}

function exposes(manifest, subpath) {
  if (!manifest.exports) return subpath === '.'
  if (typeof manifest.exports === 'string') return subpath === '.'
  const keys = Object.keys(manifest.exports)
  if (keys.every(key => !key.startsWith('.'))) return subpath === '.'
  if (Object.hasOwn(manifest.exports, subpath)) return manifest.exports[subpath] !== null
  return keys.some(key => manifest.exports[key] !== null && key.includes('*') && subpath.startsWith(key.split('*')[0]) && subpath.endsWith(key.split('*')[1]))
}

function applicationPackages(repositoryRoot) {
  const root = path.join(repositoryRoot, 'apps')
  const packages = []
  const visit = directory => {
    if (!fs.existsSync(directory)) return
    const manifestPath = path.join(directory, 'package.json')
    if (fs.existsSync(manifestPath)) {
      const segments = path.relative(root, directory).split(path.sep)
      packages.push({ directory, product: segments[0], inspect: segments.length > 1 && segments[0] !== 'yishan-components', manifest: JSON.parse(fs.readFileSync(manifestPath, 'utf8')) })
      return
    }
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory() && !['node_modules', 'dist', '.git', '.umi', '.umi-production', '.build', 'build'].includes(entry.name)) visit(path.join(directory, entry.name))
    }
  }
  visit(root)
  return packages
}

function collectArchitectureErrors(repositoryRoot) {
  const errors = []
  const packages = []
  const coreRoot = path.join(repositoryRoot, 'packages/core')
  for (const entry of fs.readdirSync(coreRoot, { withFileTypes: true }).filter(entry => entry.isDirectory())) {
    const directory = path.join(coreRoot, entry.name)
    const manifestPath = path.join(directory, 'package.json')
    if (!fs.existsSync(manifestPath)) continue
    packages.push({ directory, core: entry.name, manifest: JSON.parse(fs.readFileSync(manifestPath, 'utf8')) })
  }
  packages.push(...applicationPackages(repositoryRoot))
  const byName = new Map(packages.map(pkg => [pkg.manifest.name, pkg]))
  const allowedCore = {
    contracts: new Set(),
    api: new Set(['@yishan/core-contracts']),
    database: new Set(['@yishan/core-contracts']),
    'system-api': new Set(['@yishan/core-contracts', '@yishan/core-api', '@yishan/core-database']),
  }
  for (const owner of packages) {
    // Frontend runtime, build plugins and product Admin source have their own checker.
    // Keep them in byName so backend reverse dependencies remain visible.
    if (['admin', 'system-admin'].includes(owner.core) || (!owner.core && path.basename(owner.directory) === 'admin')) continue
    if (!owner.core && !owner.inspect) continue
    for (const dependency of Object.keys(owner.manifest.dependencies ?? {})) {
      if (owner.core === 'contracts') errors.push(`${owner.manifest.name}/package.json: contracts cannot depend on platform packages (${dependency})`)
      const target = byName.get(dependency)
      if (owner.core && target && target !== owner && (!target.core || !allowedCore[owner.core]?.has(dependency))) errors.push(`${owner.manifest.name}/package.json: forbidden dependency ${owner.manifest.name} -> ${dependency}`)
      if (!owner.core && target && !target.core && target !== owner && owner.product !== target.product) errors.push(`${owner.manifest.name}/package.json: cross-product dependency ${dependency}`)
    }
    for (const file of sourceFiles(path.join(owner.directory, 'src'))) {
      const relative = path.relative(owner.directory, file).replace(/\\/g, '/')
      const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
      for (const imported of imports(source)) {
        const { specifier } = imported
        const packageName = specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0]
        const target = byName.get(packageName)
        const report = message => errors.push(`${owner.manifest.name}/${relative}: ${message} (${specifier})`)
        if (owner.core === 'contracts' && !specifier.startsWith('.')) report('contracts cannot depend on platform packages')
        if (target) {
          if (owner.core && (!target.core || !allowedCore[owner.core]?.has(packageName)) && target !== owner) report(`forbidden dependency ${owner.manifest.name} -> ${packageName}`)
          const subpath = specifier === packageName ? '.' : `.${specifier.slice(packageName.length)}`
          if (owner !== target && !exposes(target.manifest, subpath)) report('cross-package import must use a public export')
          if (!owner.core && !target.core && owner !== target && owner.product !== target.product) report('cross-product import is forbidden')
          if (owner !== target && target.core === 'system-api') {
            const targets = exportedTargets(target.manifest, subpath)
            if (targets.some(value => /\/(?:repositories|auth)\//.test(value))) report('system private implementation cannot be exposed through aliases')
            // Integration fixtures may prepare public system schema; business implementation cannot query it.
            if (/^src\/modules\//.test(relative) && !/\/tests\/[^/]+\.integration\.test\.ts$/.test(relative) && (subpath === './schema' || targets.some(value => /\/db\/schema\//.test(value)))) report('business modules cannot import system tables')
          }
        } else if (owner.core && /(?:demo|products?)[/-]api/.test(packageName)) {
          report('Core cannot import a product application')
        }
        let resolved
        if (specifier.startsWith('.')) resolved = path.resolve(path.dirname(file), specifier)
        else if (specifier.startsWith('@/')) resolved = path.join(owner.directory, 'src', specifier.slice(2))
        if (resolved) {
          if (!resolved.startsWith(`${owner.directory}${path.sep}`)) report('cross-package relative import must use a public export')
          const moduleMatch = /\/modules\/([^/]+)\//.exec(relative)
          const resolvedRelative = path.relative(owner.directory, resolved).replace(/\\/g, '/')
          const targetMatch = /(?:^|\/)modules\/([^/]+)\//.exec(resolvedRelative)
          if (moduleMatch && targetMatch && moduleMatch[1] !== targetMatch[1]) report('cross-module import is forbidden')
          if (/\/routes\//.test(relative) && /\/db\/schema(?:[./]|$)/.test(resolvedRelative)) report('routes cannot import database schema')
        }
        if (/\/modules\/[^/]+\/routes\//.test(`/${relative}`) && /^(drizzle-orm|mysql2)(?:\/|$)/.test(specifier)) report('module routes cannot execute database queries')
        if (/\/modules\/[^/]+\/services\//.test(`/${relative}`) && /^@yishan\/core-(?:database|system-api)(?:\/|$)/.test(specifier) && !imported.typeOnly) {
          if (imported.names?.some(name => name === 'drizzleDb' || name === 'createDatabase') || imported.namespace && (packageName === '@yishan/core-database' || specifier.endsWith('/database'))) report('module services cannot import the concrete database client')
        }
      }
    }
  }
  return errors
}

if (require.main === module) {
  const errors = collectArchitectureErrors(path.resolve(process.argv[2] ?? path.join(__dirname, '..')))
  if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1 }
  else console.log('[api-architecture] public exports and dependency boundaries verified')
}
module.exports = { collectArchitectureErrors }
