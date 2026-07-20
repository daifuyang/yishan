#!/usr/bin/env node
// scripts/openapi/run.mjs — profile-threaded OpenAPI + admin-route generation.
//
// Usage:
//   node scripts/openapi/run.mjs --profile <name>          # generate
//   node scripts/openapi/run.mjs --profile <name> --check  # generate + diff gate
//
// The profile is the single source of truth for the plugin set. It feeds
// scripts/profiles/parse.mjs (which writes the catalog); the admin `openapi`
// step then rebuilds the API and regenerates the admin service types from the
// resulting apps/yishan-api/openapi.json. This replaces the old compound npm
// scripts that hardcoded `--profile core`, so `pnpm openapi:generate --
// --profile official` actually honors the requested profile.
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const SCRIPT_DIR = dirname(__filename)
const ROOT = join(SCRIPT_DIR, '..', '..')

const argv = process.argv.slice(2)
const args = Object.fromEntries(
  argv
    .map((arg, i, arr) => {
      const m = arg.match(/^--(.+)$/)
      if (!m) return null
      const next = arr[i + 1]
      return [m[1], next && !next.startsWith('--') ? next : true]
    })
    .filter(Boolean),
)

if (!args.profile || args.profile === true) {
  console.error('usage: node scripts/openapi/run.mjs --profile <name> [--check]')
  process.exit(1)
}
const profile = args.profile
const check = Boolean(args.check)

function run(label, cmd, cmdArgs) {
  console.log(`[openapi:run] ${label}: ${cmd} ${cmdArgs.join(' ')}`)
  const res = spawnSync(cmd, cmdArgs, { cwd: ROOT, stdio: 'inherit' })
  if (res.status !== 0) {
    console.error(`[openapi:run] FAIL at step '${label}' (exit ${res.status})`)
    process.exit(res.status ?? 1)
  }
}

// 1. Regenerate the catalog for the requested profile.
run('catalog', process.execPath, [join(ROOT, 'scripts', 'profiles', 'parse.mjs'), '--profile', profile])
// 2. Rebuild the API + regenerate admin service types from openapi.json.
run('admin-openapi', 'pnpm', ['--filter', 'yishan-admin', 'openapi'])
// 3. Optional diff gate — generated output must be committed.
if (check) {
  run('diff', 'git', [
    'diff',
    '--exit-code',
    '--',
    'apps/yishan-api/openapi.json',
    'apps/yishan-admin/src/services/generated',
  ])
}

console.log(`[openapi:run] PASS profile=${profile}${check ? ' (checked)' : ''}`)
