#!/usr/bin/env node
// scripts/migrate/dry-run.mjs — migration dry-run against a real database.
//
// Usage:
//   pnpm migrate:dry-run          # requires DATABASE_URL / DATABASE_HOST
//
// Behavior (P1-4): this NEVER silently skips.
//   1. If no DATABASE_URL / DATABASE_HOST is set → exit non-zero. The verify
//      orchestrator (scripts/verify.mjs) is responsible for provisioning an
//      ephemeral mysql:8 and injecting the connection string.
//   2. Otherwise it loads the COMPILED migrate helper (dist/scripts/migrate.js
//      — the CJS twin of migrate.ts; the .ts source can't be import-loaded
//      because apps/yishan-api is a CommonJS package) and runs runMigrations()
//      against the database. Applying every migration to the (typically
//      ephemeral, throwaway) database is a genuine dry-run: if any migration
//      SQL fails to apply, runMigrations throws and we exit non-zero.
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const __filename = fileURLToPath(import.meta.url)
const SCRIPT_DIR = dirname(__filename)
const ROOT = join(SCRIPT_DIR, '..', '..')
const API_ROOT = join(ROOT, 'apps', 'yishan-api')
const COMPILED = join(API_ROOT, 'dist', 'scripts', 'migrate.js')

function hasDbEnv() {
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.length > 0) return true
  if (process.env.DATABASE_HOST && process.env.DATABASE_HOST.length > 0) return true
  return false
}

async function main() {
  if (!hasDbEnv()) {
    console.error('[migrate:dry-run] FAIL: DATABASE_URL (or DATABASE_HOST) is required; refusing to skip.')
    console.error(
      '[migrate:dry-run] Provide a reachable MySQL, or run `pnpm verify -- --profile <name>` which ' +
        'provisions an ephemeral database for the dry-run.',
    )
    return 1
  }

  // Ensure the compiled migrate helper exists (build the API if needed so a
  // clean checkout still works standalone).
  if (!existsSync(COMPILED)) {
    console.log('[migrate:dry-run] compiled migrate helper missing; building API (build:ts)…')
    const build = spawnSync('pnpm', ['--filter', 'yishan-api', 'build:ts'], { cwd: ROOT, stdio: 'inherit' })
    if (build.status !== 0 || !existsSync(COMPILED)) {
      console.error('[migrate:dry-run] FAIL: could not build the migrate helper')
      return 1
    }
  }

  let migrate
  try {
    const require = createRequire(join(API_ROOT, 'package.json'))
    migrate = require(COMPILED)
  } catch (err) {
    console.error(`[migrate:dry-run] FAIL: could not load migrate helper: ${err instanceof Error ? err.message : err}`)
    return 1
  }
  if (typeof migrate.runMigrations !== 'function') {
    console.error('[migrate:dry-run] FAIL: migrate helper does not export runMigrations()')
    return 1
  }

  // collectMigrationPlan() (inside runMigrations) reads <cwd>/drizzle, so run
  // from the API package root.
  process.chdir(API_ROOT)
  try {
    console.log('[migrate:dry-run] applying migrations against the database (dry-run)…')
    const results = await migrate.runMigrations()
    console.log(`[migrate:dry-run] OK — ${results.length} migration(s) validated:`)
    console.log(JSON.stringify(results, null, 2))
    return 0
  } catch (err) {
    console.error(`[migrate:dry-run] FAIL: migration did not apply cleanly: ${err instanceof Error ? err.message : err}`)
    return 1
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
