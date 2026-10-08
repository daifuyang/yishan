#!/usr/bin/env node
/**
 * Module 命名校验。
 *
 * 规则：
 *   - 每个 module 目录：apps/yishan-api/src/modules/<id>/
 *   - 表名必须以 `<id>_` 开头（ex: demo_documents）
 *   - 不同 module 之间表名不得重复
 *
 * 扫描所有 modules/<id>/db/schema.ts，提取 `mysqlTable('xxx', ...)` 的表名。
 * AST 用正则足够，不必引入额外解析依赖。
 *
 * 用法：
 *   node scripts/check-module-naming.mjs
 *
 * 违规 → 输出错误并 exit 1。CI 上挂在 pnpm lint。
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const MODULES_ROOT = 'apps/yishan-api/src/modules'

const TABLE_RE = /mysqlTable\(\s*['"]([^'"]+)['"]/g

/**
 * @returns {string[]}
 */
function extractTablesFromSchema(schemaPath) {
  let src
  try {
    src = readFileSync(schemaPath, 'utf8')
  } catch {
    return []
  }
  const names = []
  for (const match of src.matchAll(TABLE_RE)) {
    names.push(match[1])
  }
  return names
}

function listModuleDirs() {
  let entries
  try {
    entries = readdirSync(MODULES_ROOT)
  } catch {
    return []
  }
  return entries.filter((id) => {
    try {
      return statSync(join(MODULES_ROOT, id)).isDirectory()
    } catch {
      return false
    }
  })
}

function fail(msg) {
  // eslint-disable-next-line no-console
  console.error(`[check-module-naming] ${msg}`)
}

let errorCount = 0
const seenTables = new Map()

// 与 core/module-loader 的 MODULE_ID_PATTERN 一致（启动时同样校验，这里提前在 lint 失败）。
const MODULE_ID_PATTERN = /^[a-z][a-z0-9_]{0,23}$/
const META_ID_RE = /export\s+const\s+meta\s*=\s*\{[\s\S]*?\bid\s*:\s*['"]([^'"]+)['"]/

for (const id of listModuleDirs()) {
  if (!MODULE_ID_PATTERN.test(id)) {
    fail(`module directory '${id}' is not a valid module id (${MODULE_ID_PATTERN})`)
    errorCount++
  }
  let moduleSrc = ''
  try {
    moduleSrc = readFileSync(join(MODULES_ROOT, id, 'module.ts'), 'utf8')
  } catch {
    // 没有 module.ts 的目录不是模块，启动扫描会跳过
  }
  const metaId = moduleSrc.match(META_ID_RE)?.[1]
  if (moduleSrc && metaId !== id) {
    fail(`module '${id}': meta.id ${JSON.stringify(metaId)} must equal its directory name`)
    errorCount++
  }

  const schemaPath = join(MODULES_ROOT, id, 'db/schema.ts')
  const tables = extractTablesFromSchema(schemaPath)

  if (tables.length === 0) continue

  for (const table of tables) {
    const expectedPrefix = `${id}_`

    if (!table.startsWith(expectedPrefix)) {
      fail(`module '${id}' declares table '${table}'; must start with '${expectedPrefix}'`)
      errorCount++
    }

    if (seenTables.has(table)) {
      const otherId = seenTables.get(table)
      fail(`duplicate table name '${table}' used by module '${otherId}' and '${id}'`)
      errorCount++
    } else {
      seenTables.set(table, id)
    }
  }
}

if (errorCount > 0) {
  // eslint-disable-next-line no-console
  console.error(`[check-module-naming] ${errorCount} error(s) found`)
  process.exit(1)
}

// eslint-disable-next-line no-console
console.log(`[check-module-naming] ok (${seenTables.size} tables across ${listModuleDirs().length} modules)`)
