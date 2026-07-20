#!/usr/bin/env node
// scripts/migrate/verify-apply.mjs — APPLY migrations against an EPHEMERAL DB.
//
// Usage (verify-only):
//   YISHAN_EPHEMERAL_DB=1 DATABASE_URL=<throwaway> node scripts/migrate/verify-apply.mjs
//
// This command WRITES DDL (it actually applies every migration). To prevent it
// from ever touching an unmanaged/production database by mistake, it refuses to
// run unless YISHAN_EPHEMERAL_DB=1 is set — a flag that only scripts/verify.mjs
// sets, and only after it has provisioned (or the caller has explicitly marked)
// a throwaway database. Applying the full plan to a fresh throwaway DB is the
// genuine "do the migrations actually apply?" check.
//
// For a safe, read-only check against any database, use `migrate:dry-run`.
//
// Exit codes: 0 = applied cleanly, 1 = guard tripped / no DB / apply failed.
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
  return Boolean(
    (process.env.DATABASE_URL && process.env.DATABASE_URL.length > 0) ||
      (process.env.DATABASE_HOST && process.env.DATABASE_HOST.length > 0),
  )
}

async function main() {
  if (process.env.YISHAN_EPHEMERAL_DB !== '1') {
    console.error(
      '[migrate:verify-apply] REFUSING to run: this command applies DDL and must only run against ' +
        'an ephemeral database. Set YISHAN_EPHEMERAL_DB=1 (scripts/verify.mjs does this after ' +
        'provisioning a throwaway MySQL). For a safe read-only check use `pnpm migrate:dry-run`.',
    )
    return 1
  }
  if (!hasDbEnv()) {
    console.error('[migrate:verify-apply] FAIL: DATABASE_URL (or DATABASE_HOST) is required')
    return 1
  }
  if (!existsSync(COMPILED)) {
    console.log('[migrate:verify-apply] compiled migrate helper missing; building API (build:ts)…')
    const build = spawnSync('pnpm', ['--filter', 'yishan-api', 'build:ts'], { cwd: ROOT, stdio: 'inherit' })
    if (build.status !== 0 || !existsSync(COMPILED)) {
      console.error('[migrate:verify-apply] FAIL: could not build the migrate helper')
      return 1
    }
  }
  let migrate
  try {
    const require = createRequire(join(API_ROOT, 'package.json'))
    migrate = require(COMPILED)
  } catch (err) {
    console.error(`[migrate:verify-apply] FAIL: could not load migrate helper: ${err instanceof Error ? err.message : err}`)
    return 1
  }
  // collectMigrationPlan (inside runMigrations) reads <cwd>/drizzle.
  process.chdir(API_ROOT)
  try {
    console.log('[migrate:verify-apply] applying migrations against the ephemeral database…')
    const results = await migrate.runMigrations()
    console.log(`[migrate:verify-apply] OK — ${results.length} migration(s) applied/validated:`)
    console.log(JSON.stringify(results, null, 2))
    return 0
  } catch (err) {
    console.error(`[migrate:verify-apply] FAIL: migration did not apply cleanly: ${err instanceof Error ? err.message : err}`)
    return 1
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
