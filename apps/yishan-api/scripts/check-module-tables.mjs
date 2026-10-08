#!/usr/bin/env node
/**
 * check-module-tables.mjs — 只读诊断：已装载模块在 db/schema.ts 中声明的表是否真实存在于数据库。
 *
 * 背景（P0 R-01）：模块迁移与 Core 共用 `__drizzle_migrations`，drizzle-kit migrate 可能跳过模块
 * 迁移却以 0 退出。迁移命令的退出码不能证明模块表已创建，必须在迁移后用本脚本核对。
 *
 * 用法：DATABASE_URL=mysql://... node scripts/check-module-tables.mjs
 *   只执行 SELECT（information_schema）；不写入、不建表。
 *   缺表 → 退出码 1，并列出模块与缺失的表。
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isPackedModuleDir } from './module-pack.mjs'

const API_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const MODULES = join(API_ROOT, 'src', 'modules')
const TABLE_RE = /mysqlTable\(\s*['"]([^'"]+)['"]/g

export function declaredModuleTables(modulesRoot = MODULES) {
  const out = {}
  if (!existsSync(modulesRoot)) return out
  for (const id of readdirSync(modulesRoot).sort()) {
    const dir = join(modulesRoot, id)
    if (!statSync(dir).isDirectory() || !isPackedModuleDir(dir)) continue
    const schema = join(dir, 'db', 'schema.ts')
    if (!existsSync(schema)) continue
    out[id] = [...readFileSync(schema, 'utf8').matchAll(TABLE_RE)].map((m) => m[1]).sort()
  }
  return out
}

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('[module-tables] DATABASE_URL is required')
    process.exit(2)
  }
  const mysql = createRequire(join(API_ROOT, 'package.json'))('mysql2/promise')
  const conn = await mysql.createConnection(url)
  try {
    const [rows] = await conn.query('SELECT table_name AS t FROM information_schema.tables WHERE table_schema = DATABASE()')
    const present = new Set(rows.map((r) => r.t))
    let missingTotal = 0
    for (const [id, tables] of Object.entries(declaredModuleTables())) {
      const missing = tables.filter((t) => !present.has(t))
      missingTotal += missing.length
      console.log(`[module-tables] ${id}: ${tables.length - missing.length}/${tables.length} present${missing.length ? `; MISSING: ${missing.join(', ')}` : ''}`)
    }
    if (missingTotal) {
      console.error(`[module-tables] ${missingTotal} declared module table(s) missing — a migrate exit code of 0 does not mean module migrations ran (see P0 R-01)`)
      process.exitCode = 1
    }
  } finally {
    await conn.end()
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main()
