const fs = require('node:fs')
const path = require('node:path')
const { createRequire } = require('node:module')
const ts = createRequire(path.join(__dirname, '../packages/core/api/package.json'))('typescript')

function parse(file) {
  return ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
}

function unwrap(node) {
  while (node && (ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isParenthesizedExpression(node))) node = node.expression
  return node
}

function resolveEntry(from, specifier) {
  if (!specifier.startsWith('.')) return createRequire(from).resolve(specifier)
  const base = path.resolve(path.dirname(from), specifier)
  const sourceBase = base.replace(/\.js$/, '')
  return [`${sourceBase}.ts`, base, `${base}.js`, path.join(base, 'index.ts'), path.join(base, 'index.js')].find(file => fs.existsSync(file) && fs.statSync(file).isFile()) ?? base
}

function descriptorId(entry, name, seen = new Set()) {
  const key = `${entry}:${name}`
  if (seen.has(key)) throw new Error(`${entry}: cyclic module export`)
  seen.add(key)
  const source = parse(entry)
  const variables = new Map()
  const exports = new Map()
  for (const statement of source.statements) {
    if (ts.isVariableStatement(statement)) for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name)) variables.set(declaration.name.text, unwrap(declaration.initializer))
    }
    if (ts.isExportAssignment(statement)) exports.set('default', unwrap(statement.expression))
    if (ts.isExportDeclaration(statement) && statement.exportClause && ts.isNamedExports(statement.exportClause)) {
      for (const element of statement.exportClause.elements) {
        if (element.name.text !== name) continue
        const original = (element.propertyName ?? element.name).text
        if (statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)) return descriptorId(resolveEntry(entry, statement.moduleSpecifier.text), original, seen)
        exports.set(name, variables.get(original))
      }
    }
    if (ts.isExpressionStatement(statement) && ts.isBinaryExpression(statement.expression)) {
      const assignment = statement.expression
      if (assignment.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isPropertyAccessExpression(assignment.left) && assignment.left.expression.getText(source) === 'exports') exports.set(assignment.left.name.text, unwrap(assignment.right))
      if (assignment.left.getText(source) === 'module.exports') exports.set('default', unwrap(assignment.right))
    }
  }
  let descriptor = exports.get(name) ?? variables.get(name)
  if (descriptor && ts.isIdentifier(descriptor)) descriptor = variables.get(descriptor.text)
  if (!descriptor || !ts.isObjectLiteralExpression(descriptor)) throw new Error(`${entry}: module must export a static descriptor`)
  const id = descriptor.properties.find(property => ts.isPropertyAssignment(property) && property.name.getText(source).replace(/['"]/g, '') === 'id')
  if (!id || !ts.isStringLiteral(id.initializer)) throw new Error(`${entry}: module id must be a string literal`)
  return { id: id.initializer.text, entry }
}

function readInstalledModules(apiRoot) {
  const manifestPath = path.join(apiRoot, 'src/manifest.ts')
  const source = parse(manifestPath)
  const imports = new Map()
  const arrays = []
  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      const clause = statement.importClause
      if (clause?.name) imports.set(clause.name.text, { file: statement.moduleSpecifier.text, name: 'default' })
      if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) {
        for (const element of clause.namedBindings.elements) imports.set(element.name.text, { file: statement.moduleSpecifier.text, name: element.propertyName?.text ?? element.name.text })
      }
    }
    if (ts.isVariableStatement(statement) && statement.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
      for (const declaration of statement.declarationList.declarations) {
        const value = unwrap(declaration.initializer)
        if (value && ts.isArrayLiteralExpression(value)) arrays.push(value)
      }
    }
  }
  if (arrays.length !== 1) throw new Error(`${manifestPath}: declare exactly one exported installation array`)
  return arrays[0].elements.map(element => {
    if (!ts.isIdentifier(element)) throw new Error(`${manifestPath}: installation entries must be imported module identifiers`)
    const imported = imports.get(element.text)
    if (!imported) throw new Error(`${manifestPath}: module ${element.text} requires an explicit import`)
    const entry = resolveEntry(manifestPath, imported.file)
    if (imported.file.startsWith('.') && !entry.startsWith(`${path.resolve(apiRoot)}${path.sep}`)) throw new Error(`${manifestPath}: module import escapes product API`)
    return { ...descriptorId(entry, imported.name), local: imported.file.startsWith('.') }
  })
}

function findProductApis(repositoryRoot) {
  const productsRoot = path.join(repositoryRoot, 'apps')
  if (!fs.existsSync(productsRoot)) return []
  return fs.readdirSync(productsRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && fs.existsSync(path.join(productsRoot, entry.name, 'api/package.json')))
    .map(entry => path.join(productsRoot, entry.name, 'api'))
    .sort()
}

module.exports = { readInstalledModules, findProductApis }
