#!/usr/bin/env node
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { dirname, resolve, join, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import manifest from './module-manifest.cjs'

const toolingRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const repositoryRoot = resolve(process.argv[2] ?? toolingRoot)
const ts = createRequire(join(toolingRoot, 'packages/core/api/package.json'))('typescript')
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
          console.error(`[module-naming] ${schemaPath}: invalid or duplicate table ${table}`)
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
    if (existsSync(schemaPath)) checkSchema(schemaPath, `${entry.name}_`)
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
