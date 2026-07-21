#!/usr/bin/env node
// scripts/migrate/dry-run.mjs — READ-ONLY migration dry-run.
//
// Implementation note (modules-autoload-stage1 + drizzle-kit migration):
//   Prior version hand-rolled a SHA-256 tracking table. We now delegate to
//   `drizzle-kit`, the official Drizzle migration runner. drizzle-kit reads
//   `drizzle/meta/_journal.json` (gitignored) plus the existing
//   `__drizzle_migrations` table in the database, and reports drift.
//
// Usage:
//   pnpm migrate:dry-run                       # schema drift check (no DB needed)
//   DATABASE_URL=... pnpm migrate:dry-run      # + applied / pending status
//
// Exit codes: 0 = clean, 1 = drift / checksum mismatch / load failure.
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const SCRIPT_DIR = dirname(__filename)
const ROOT = join(SCRIPT_DIR, '..', '..')

console.log('[migrate:dry-run] drizzle-kit check (schema drift)')
const check = spawnSync('npx', ['--no-install', 'drizzle-kit', 'check'], {
  cwd: join(ROOT, 'apps', 'yishan-api'),
  stdio: 'inherit',
})
if (check.status !== 0) {
  process.exit(check.status ?? 1)
}

console.log('')
console.log('[migrate:dry-run] drizzle-kit status (journal)')
const status = spawnSync('npx', ['--no-install', 'drizzle-kit', 'migrate'], {
  cwd: join(ROOT, 'apps', 'yishan-api'),
  stdio: 'inherit',
})
process.exit(status.status ?? 0)