#!/usr/bin/env node
// scripts/migrate/dry-run.mjs — READ-ONLY migration dry-run.
//
// Usage:
//   pnpm migrate:dry-run                       # validate plan + checksums
//   DATABASE_URL=... pnpm migrate:dry-run      # + compare against applied records
//
// SAFETY (P1-4 follow-up): this command NEVER writes to the database. It is
// safe to point at any DATABASE_URL — including production — because it only
// runs read queries. It:
//   1. Collects the migration plan and checks every entry has SQL + a checksum.
//   2. If a database is reachable, reads the applied-migration records
//      (inspectMigrations — SELECT/SHOW only) and reports each migration as
//      applied / pending / modified. A `modified` entry (applied hash != file
//      hash) is checksum drift and fails the command.
//
// To actually APPLY migrations (which writes DDL), use `migrate:verify-apply`,
// which refuses to run outside an ephemeral database context.
//
// Exit codes: 0 = clean, 1 = plan error / checksum drift / load failure.
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const __filename = fileURLToPath(import.meta.url)
const SCRIPT_DIR = dirname(__filename)
const ROOT = join(SCRIPT_DIR, '..', '..')
const API_ROOT = join(ROOT, 'apps', 'yishan-api')
const COMPILED_MIGRATE = join(API_ROOT, 'dist', 'scripts', 'migrate.js')
const COMPILED_PLAN = join(API_ROOT, 'dist', 'scripts', 'migration-plan.js')

function hasDbEnv() {
  return Boolean(
    (process.env.DATABASE_URL && process.env.DATABASE_URL.length > 0) ||
      (process.env.DATABASE_HOST && process.env.DATABASE_HOST.length > 0),
  )
}

function ensureCompiled() {
  if (existsSync(COMPILED_MIGRATE) && existsSync(COMPILED_PLAN)) return true
  console.log('[migrate:dry-run] compiled migrate helpers missing; building API (build:ts)…')
  const build = spawnSync('pnpm', ['--filter', 'yishan-api', 'build:ts'], { cwd: ROOT, stdio: 'inherit' })
  return build.status === 0 && existsSync(COMPILED_MIGRATE) && existsSync(COMPILED_PLAN)
}

async function main() {
  if (!ensureCompiled()) {
    console.error('[migrate:dry-run] FAIL: could not build the migrate helpers')
    return 1
  }
  const require = createRequire(join(API_ROOT, 'package.json'))
  let planMod
  let migrateMod
  try {
    planMod = require(COMPILED_PLAN)
    migrateMod = require(COMPILED_MIGRATE)
  } catch (err) {
    console.error(`[migrate:dry-run] FAIL: could not load migrate helpers: ${err instanceof Error ? err.message : err}`)
    return 1
  }

  // collectMigrationPlan reads <cwd>/drizzle; run from the API package root.
  process.chdir(API_ROOT)

  // 1. Structural + checksum validation of the plan (no DB needed).
  let plan
  try {
    plan = planMod.collectMigrationPlan(API_ROOT)
  } catch (err) {
    console.error(`[migrate:dry-run] FAIL: invalid migration plan: ${err instanceof Error ? err.message : err}`)
    return 1
  }
  for (const m of plan) {
    if (typeof m.sql !== 'string' || m.sql.length === 0) {
      console.error(`[migrate:dry-run] FAIL: migration ${m.id} has no SQL body`)
      return 1
    }
  }
  console.log(`[migrate:dry-run] plan OK — ${plan.length} migration(s), all with SQL bodies`)

  // 2. Read-only comparison against the database's applied records, if reachable.
  if (!hasDbEnv()) {
    console.log('[migrate:dry-run] no DATABASE_URL; validated plan + checksums only (no applied-records check). Nothing was written.')
    return 0
  }
  let results
  try {
    results = await migrateMod.inspectMigrations() // SELECT/SHOW only — never writes
  } catch (err) {
    console.error(`[migrate:dry-run] FAIL: could not inspect migrations: ${err instanceof Error ? err.message : err}`)
    return 1
  }
  const counts = { applied: 0, pending: 0, modified: 0 }
  for (const r of results) counts[r.status] = (counts[r.status] ?? 0) + 1
  console.log(
    `[migrate:dry-run] applied=${counts.applied} pending=${counts.pending} modified=${counts.modified} (read-only; nothing written)`,
  )
  const modified = results.filter((r) => r.status === 'modified')
  if (modified.length > 0) {
    console.error(
      `[migrate:dry-run] FAIL: checksum drift — these migrations were modified after being applied: ${modified.map((r) => r.id).join(', ')}`,
    )
    return 1
  }
  return 0
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
