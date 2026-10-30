#!/usr/bin/env node
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { dirname, resolve, join, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import manifest from '@yishan/core-admin/manifest'

const toolingRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const repositoryRoot = resolve(process.argv[2] ?? toolingRoot)
const ts = createRequire(join(toolingRoot, 'packages/core/api/package.json'))('typescript')
/**
 * 读模块自己声明的 tablePrefix。
 *
 * 表前缀的唯一权威来源是 `module.ts` 里的 `tablePrefix` —— 它同时参与
 * `orderModules()` 的运行时校验。脚本此前不读它、直接用目录名拼 `${dir}_`，
 * 导致「模块 id 与目录名不同」的模块（例如 iximei-crm 的业务表沿用历史
 * `crm_` 前缀）被误判。这里改为以声明为准，目录名仅作缺省。
 */
function readDeclaredTablePrefix(modulePath) {
  if (!existsSync(modulePath)) return null
  const source = ts.createSourceFile(modulePath, readFileSync(modulePath, 'utf8'), ts.ScriptTarget.Latest, true)
  let prefix = null
  const visit = node => {
    if (prefix) return
    if (ts.isPropertyAssignment(node) && node.name && node.name.text === 'tablePrefix' && ts.isStringLiteralLike(node.initializer)) {
      prefix = node.initializer.text
      return
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return prefix
}

let errors = 0
let tableCount = 0
const products = manifest.findProductApis(repositoryRoot)
if (!products.length) throw new Error('No product APIs found')
for (const apiRoot of products) {
  const modulesRoot = join(apiRoot, 'src/modules')
  if (!existsSync(modulesRoot)) throw new Error(`Missing product module root: ${modulesRoot}`)
  const seen = new Map()
  const checkSchema = (schemaPath, prefix) => {
    const source = ts.createSourceFile(schemaPath, readFileSync(schemaPath, 'utf8'), ts.ScriptTarget.Latest, true)
    const visit = node => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'mysqlTable' && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
        const table = node.arguments[0].text
        tableCount++
        if (!table.startsWith(prefix) || seen.has(table)) {
          console.error(`[module-naming] ${schemaPath}: table ${table} does not start with declared prefix ${prefix}` + (seen.has(table) ? ' (duplicate)' : ''))
          errors++
        }
        seen.set(table, schemaPath)
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
  }
  for (const entry of readdirSync(modulesRoot, { withFileTypes: true }).filter(entry => entry.isDirectory())) {
    const schemaPath = join(modulesRoot, entry.name, 'db/schema.ts')
    const declared = readDeclaredTablePrefix(join(modulesRoot, entry.name, 'module.ts'))
    if (existsSync(schemaPath)) checkSchema(schemaPath, declared ?? `${entry.name}_`)
  }
  const checkExtensions = directory => {
    if (!existsSync(directory)) return
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = join(directory, entry.name)
      if (entry.isDirectory()) checkExtensions(file)
      else if (entry.name.endsWith('.schema.ts')) checkSchema(file, `${basename(dirname(apiRoot))}_`)
    }
  }
  checkExtensions(join(apiRoot, 'src/extensions'))
}
if (errors) process.exitCode = 1
else console.log(`[module-naming] verified ${tableCount} tables across ${products.length} products`)
