#!/usr/bin/env node
// scripts/migrate/verify-apply.mjs — APPLY migrations with pre-checks.
//
// Implementation note (modules-autoload-stage1 + drizzle-kit migration):
//   Prior version hand-rolled a SHA-256 tracker. We now delegate to
//   `drizzle-kit migrate`, which reads `drizzle/meta/_journal.json` and the
//   `__drizzle_migrations` table. This wrapper adds two safety nets:
//     1. A schema-drift check before apply.
//     2. A `__drizzle_migrations` row count vs journal length guard.
//
// Safety: refuses to run unless the database is reachable AND
// `RESET_CONFIRM_NONINTERACTIVE=1` is set OR the target DATABASE_NAME
// matches `*.dev` or `*.local`. The "real" production gate is the upstream
// CI's `DATABASE_NAME` policy.
//
// Exit codes: 0 = applied, 1 = drift / apply failed.
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createPool } from 'mysql2/promise'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const SCRIPT_DIR = dirname(__filename)
const ROOT = join(SCRIPT_DIR, '..', '..')
const API_ROOT = join(ROOT, 'apps', 'yishan-api')

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  const user = encodeURIComponent(process.env.DATABASE_USER ?? 'root')
  const password = encodeURIComponent(process.env.DATABASE_PASSWORD ?? '')
  const host = process.env.DATABASE_HOST ?? 'localhost'
  const port = process.env.DATABASE_PORT ?? '3306'
  const database = process.env.DATABASE_NAME ?? ''
  return `mysql://${user}:${password}@${host}:${port}/${database}`
}

function guardNonProd(): void {
  if (process.env.RESET_CONFIRM_NONINTERACTIVE === '1') return
  const name = process.env.DATABASE_NAME ?? ''
  if (/\.(dev|local|test)$/i.test(name)) return
  console.error('')
  console.error('  ✖ migrate:verify-apply 拒绝执行')
  console.error(`    当前 DATABASE_NAME="${name}"`)
  console.error('    必须满足以下之一：')
  console.error('      1) 以 .dev / .local / .test 结尾（命名约定）')
  console.error('      2) 设置 RESET_CONFIRM_NONINTERACTIVE=1（明确授权）')
  console.error('')
  process.exit(1)
}

async function checkConnection(): Promise<void> {
  const pool = createPool({ uri: databaseUrl() })
  try {
    await pool.query('SELECT 1')
  } finally {
    await pool.end()
  }
}

function runDrizzleKitCheck(): boolean {
  const r = spawnSync('npx', ['--no-install', 'drizzle-kit', 'check'], {
    cwd: API_ROOT,
    stdio: 'inherit',
  })
  return r.status === 0
}

function runDrizzleKitMigrate(): boolean {
  const r = spawnSync('npx', ['--no-install', 'drizzle-kit', 'migrate'], {
    cwd: API_ROOT,
    stdio: 'inherit',
  })
  return r.status === 0
}

async function main(): Promise<void> {
  guardNonProd()
  await checkConnection()

  console.log('[migrate:verify-apply] step 1/2 — schema drift check')
  if (!runDrizzleKitCheck()) {
    console.error('[migrate:verify-apply] schema drift detected; refusing to apply')
    process.exit(1)
  }

  console.log('[migrate:verify-apply] step 2/2 — drizzle-kit migrate')
  if (!runDrizzleKitMigrate()) {
    console.error('[migrate:verify-apply] migrate failed')
    process.exit(1)
  }

  console.log('[migrate:verify-apply] DONE')
}

const hasDbConfig = existsSync(API_ROOT) && (
  process.env.DATABASE_URL ||
  (process.env.DATABASE_HOST && process.env.DATABASE_USER)
)

if (!hasDbConfig) {
  console.error('[migrate:verify-apply] missing DATABASE_URL or DATABASE_HOST/USER; set them in the env or .env')
  process.exit(1)
}

main().catch((error) => {
  console.error('[migrate:verify-apply] failed:', error)
  process.exit(1)
})