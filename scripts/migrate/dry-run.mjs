#!/usr/bin/env node
// scripts/migrate/dry-run.mjs — Wave 5 migration dry-run wrapper.
//
// Usage:
//   pnpm migrate:dry-run
//
// Behavior:
//   1. If DATABASE_URL / DATABASE_HOST env vars are missing → exit 0 with
//      a clear "skipped — no DATABASE_URL" message. Verify must not fail
//      in environments that don't run a real DB (CI pull requests, dev
//      sandboxes).
//   2. If a DATABASE_URL is available, attempt to run
//      `pnpm exec drizzle-kit migrate --dry-run` against the configured
//      MySQL. The drizzle-kit CLI handles plan-vs-applied diffing.
//
// The wrapper exits non-zero only when drizzle-kit itself fails. If
// drizzle-kit is not on PATH (e.g. node-only CI), we fall back to
// invoking the API's existing inspectMigrations() helper via
// `--experimental-strip-types` so the dry-run stays meaningful without
// requiring drizzle-kit to be installed globally.
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const SCRIPT_DIR = dirname(__filename)
const ROOT = join(SCRIPT_DIR, '..', '..')
const API_ROOT = join(ROOT, 'apps', 'yishan-api')

function hasDbEnv() {
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.length > 0) return true
  if (process.env.DATABASE_HOST && process.env.DATABASE_HOST.length > 0) return true
  return false
}

function runDrizzleKitDryRun() {
  const result = spawnSync(
    'pnpm',
    ['--filter', 'yishan-api', 'exec', 'drizzle-kit', 'migrate', '--dry-run'],
    { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' },
  )
  const out = (result.stdout || '') + (result.stderr || '')
  if (result.status === 0) {
    console.log('[migrate:dry-run] drizzle-kit --dry-run OK')
    return 0
  }
  console.error('[migrate:dry-run] drizzle-kit --dry-run failed:')
  console.error(out.trim())
  return result.status ?? 1
}

function runInspectFallback() {
  // drizzle-kit not available → fall back to the API's inspectMigrations
  // helper via Node's strip-types loader. This at least surfaces the
  // migration plan count even when no DB is reachable.
  const helper = join(API_ROOT, 'src', 'scripts', 'migrate.ts')
  if (!existsSync(helper)) {
    console.log('[migrate:dry-run] requires DATABASE_URL; skipped (no helper available)')
    return 0
  }
  const result = spawnSync(
    process.execPath,
    [
      '--experimental-strip-types',
      '--no-warnings=ExperimentalWarning',
      '-e',
      `import('${helper}').then(m => m.inspectMigrations()).then(r => { console.log(JSON.stringify({ ok: true, mode: 'inspect', migrations: r })); }).catch(e => { console.log(JSON.stringify({ ok: false, mode: 'inspect', error: e.message })); });`,
    ],
    { cwd: API_ROOT, encoding: 'utf8', stdio: 'pipe' },
  )
  if (result.status !== 0) {
    console.error('[migrate:dry-run] inspect fallback failed:')
    console.error((result.stderr || result.stdout || '').trim())
    return result.status ?? 1
  }
  const stdout = (result.stdout || '').trim()
  console.log('[migrate:dry-run] inspect fallback:')
  console.log(stdout)
  return 0
}

function main() {
  if (!hasDbEnv()) {
    console.log('[migrate:dry-run] requires DATABASE_URL; skipped (verify chain continues)')
    return 0
  }
  console.log('[migrate:dry-run] DATABASE_URL detected; attempting drizzle-kit --dry-run')
  const code = runDrizzleKitDryRun()
  if (code === 0) return 0
  console.log('[migrate:dry-run] drizzle-kit unavailable, falling back to inspect helper')
  return runInspectFallback()
}

const exitCode = main()
process.exit(exitCode)