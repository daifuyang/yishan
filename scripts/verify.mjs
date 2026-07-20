#!/usr/bin/env node
// scripts/verify.mjs — profile-threaded verify orchestrator.
//
// Usage:
//   node scripts/verify.mjs --profile <name> [--version <semver>] [--scope <core|admin|app|integration|full>]
//
// Replaces the old monolithic `verify` shell-chain that silently ran
// everything against `--profile core`. This orchestrator reads ONE profile,
// threads it explicitly into every sub-step, and fails fast (non-zero) on the
// first failing step. The app build is skipped unless the profile's targets
// include app-weapp / app-h5.
//
// The migration dry-run runs against a real database: if DATABASE_URL is not
// set, an ephemeral mysql:8 container is provisioned via Docker (matching the
// profile's verify.db.strategy: ephemeral-mysql), the connection string is
// injected, the dry-run runs, and the container is torn down. If Docker is
// unavailable AND no DATABASE_URL is present, verify FAILS — it never skips.
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const SCRIPT_DIR = dirname(__filename)
const ROOT = join(SCRIPT_DIR, '..')

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
  console.error('usage: node scripts/verify.mjs --profile <name> [--version <semver>] [--scope <name>]')
  process.exit(1)
}
const PROFILE = args.profile
const VERSION = typeof args.version === 'string' ? args.version : '2.0.0-local'
const SCOPE = typeof args.scope === 'string' ? args.scope : 'full'

function fail(msg) {
  console.error(`[verify] FAIL: ${msg}`)
  process.exit(1)
}

function run(label, cmd, cmdArgs, opts = {}) {
  console.log(`\n[verify] ▶ ${label}`)
  const res = spawnSync(cmd, cmdArgs, { cwd: ROOT, stdio: 'inherit', ...opts })
  if (res.status !== 0) {
    fail(`step '${label}' failed (exit ${res.status})`)
  }
}

function tryRun(cmd, cmdArgs, opts = {}) {
  return spawnSync(cmd, cmdArgs, { cwd: ROOT, encoding: 'utf8', ...opts })
}

// ---- Step 1: catalog (also gives us targets) ----
run('catalog', process.execPath, [join(ROOT, 'scripts', 'profiles', 'parse.mjs'), '--profile', PROFILE])
const catalog = JSON.parse(readFileSync(join(ROOT, 'artifacts', 'plugin-catalog.json'), 'utf8'))
const targets = Array.isArray(catalog.targets) ? catalog.targets : []
const hasWeapp = targets.includes('app-weapp')
const hasH5 = targets.includes('app-h5')

// Ephemeral containers are torn down in withEphemeralDb's finally, but a
// failing step calls process.exit() (skipping finally), so also register a
// synchronous exit hook as a safety net against leaked containers.
const activeContainers = new Set()
process.on('exit', () => {
  for (const c of activeContainers) {
    try {
      spawnSync('docker', ['rm', '-f', c])
    } catch {
      /* best effort */
    }
  }
})
process.on('SIGINT', () => process.exit(130))
process.on('SIGTERM', () => process.exit(143))

// ---- Ephemeral database helper (used by migration dry-run + integration) ----
function dockerAvailable() {
  return tryRun('docker', ['info']).status === 0
}

function mysqlImage() {
  const services = catalog?.verify?.db?.services
  if (Array.isArray(services) && services.length > 0 && typeof services[0] === 'string') {
    return services[0]
  }
  return 'mysql:8'
}

function waitForMysql(container, timeoutMs = 120_000) {
  const start = Date.now()
  // Date.now() is fine here — this is a plain Node script, not a resumable workflow.
  while (Date.now() - start < timeoutMs) {
    if (tryRun('docker', ['exec', container, 'mysqladmin', 'ping', '-h', '127.0.0.1', '--silent']).status === 0) {
      return true
    }
    spawnSync(process.execPath, ['-e', 'setTimeout(()=>{}, 2000)'])
  }
  return false
}

// Provision a throwaway MySQL, invoke fn(env) with DATABASE_URL injected, then
// tear it down. Uses a RANDOM container name and an AUTO-ASSIGNED host port
// (-p 0:3306 + docker inspect) so parallel and multi-profile verify runs never
// collide on container name, port, or credentials. The image comes from the
// profile (verify.db.services); the profile only declares strategy + image.
function withEphemeralDb(label, fn) {
  const image = mysqlImage()
  const suffix = Math.random().toString(36).slice(2, 10)
  const container = `yishan-verify-mysql-${suffix}`
  const rootPw = `verify_${suffix}`
  const db = 'yishan_verify'
  console.log(`\n[verify] ▶ provisioning ephemeral ${image} (Docker) for ${label}`)
  const up = tryRun('docker', [
    'run', '-d', '--name', container,
    '-e', `MYSQL_ROOT_PASSWORD=${rootPw}`,
    '-e', `MYSQL_DATABASE=${db}`,
    '-p', '0:3306',
    image,
  ])
  if (up.status !== 0) {
    fail(`failed to start ephemeral ${image}: ${(up.stderr || up.stdout || '').trim()}`)
  }
  activeContainers.add(container)
  try {
    const inspect = tryRun('docker', [
      'inspect',
      '--format',
      '{{(index (index .NetworkSettings.Ports "3306/tcp") 0).HostPort}}',
      container,
    ])
    const hostPort = (inspect.stdout || '').trim()
    if (inspect.status !== 0 || !/^\d+$/.test(hostPort)) {
      fail(`could not resolve mapped host port for ${container}: ${(inspect.stderr || inspect.stdout || '').trim()}`)
    }
    if (!waitForMysql(container)) {
      fail(`ephemeral ${image} did not become ready within timeout`)
    }
    const env = {
      ...process.env,
      DATABASE_URL: `mysql://root:${rootPw}@127.0.0.1:${hostPort}/${db}`,
    }
    return fn(env)
  } finally {
    console.log('[verify] tearing down ephemeral database')
    tryRun('docker', ['rm', '-f', container])
    activeContainers.delete(container)
  }
}

// Run fn with a database: prefer an already-configured DATABASE_URL, otherwise
// provision an ephemeral one via Docker. Never silently skips.
function requireDbThen(label, fn) {
  if (process.env.DATABASE_URL || process.env.DATABASE_HOST) {
    return fn({ ...process.env })
  }
  if (!dockerAvailable()) {
    fail(
      `${label} requires a database: set DATABASE_URL, or make Docker available so an ephemeral ` +
        'database can be provisioned. Refusing to skip.',
    )
  }
  return withEphemeralDb(label, fn)
}

function migrationDryRun() {
  requireDbThen('migration dry-run', (env) => {
    run('migrate:dry-run', process.execPath, [join(ROOT, 'scripts', 'migrate', 'dry-run.mjs')], { env })
  })
}

function integrationTests() {
  requireDbThen('integration tests', (env) => {
    // The integration suite gates on YISHAN_RUN_INTEGRATION=1 and reads the
    // connection string from YISHAN_TEST_MYSQL_URL (see test/integration/_setup.ts).
    const url = env.DATABASE_URL
    if (!url) {
      fail('integration tests need a DATABASE_URL; provide one or let Docker provision it')
    }
    run('api:test:integration', 'pnpm', ['--filter', 'yishan-api', 'test:integration'], {
      env: { ...env, YISHAN_RUN_INTEGRATION: '1', YISHAN_TEST_MYSQL_URL: url },
    })
  })
}

// ---- Step list, ordered; fail-fast ----
// arch + docs gates
if (SCOPE === 'full' || SCOPE === 'integration') {
  run('arch:check', 'pnpm', ['arch:check'])
  run('docs:check', 'pnpm', ['docs:check'])
}
if (SCOPE === 'full') {
  run('db:generate:test', 'pnpm', ['--filter', 'yishan-api', 'db:generate:test'])
  run('openapi:check', process.execPath, [join(ROOT, 'scripts', 'openapi', 'run.mjs'), '--profile', PROFILE, '--check'])
  run('profile:validate', process.execPath, [join(ROOT, 'scripts', 'profiles', 'validate.mjs'), '--profile', PROFILE])
}

// API build precedes the migration dry-run and integration tests, which both
// load compiled output / boot the built app under the selected profile.
if (SCOPE === 'full' || SCOPE === 'core' || SCOPE === 'integration') {
  run('api:build', 'pnpm', ['--filter', 'yishan-api', 'build:ts'])
}
if (SCOPE === 'full') {
  migrationDryRun()
}
// Integration = plugin integration tests under the selected profile (AGENTS §5:
// `pnpm verify:integration -- --profile official`).
if (SCOPE === 'full' || SCOPE === 'integration') {
  integrationTests()
}
if (SCOPE === 'full' || SCOPE === 'core') {
  run('api:test', 'pnpm', ['--filter', 'yishan-api', 'test'])
}

// Admin
if (SCOPE === 'full' || SCOPE === 'admin') {
  run('admin:lint', 'pnpm', ['--filter', 'yishan-admin', 'lint'])
  run('admin:test', 'pnpm', ['--filter', 'yishan-admin', 'test'])
  run('admin:build', 'pnpm', ['--filter', 'yishan-admin', 'build'])
}

// App (only when the profile targets it)
if (SCOPE === 'full' || SCOPE === 'app') {
  if (hasWeapp || hasH5) {
    run('app:lint', 'pnpm', ['--filter', 'yishan-app', 'lint'])
    if (hasWeapp) run('app:build:weapp', 'pnpm', ['--filter', 'yishan-app', 'build:weapp'])
    if (hasH5) run('app:build:h5', 'pnpm', ['--filter', 'yishan-app', 'build:h5'])
  } else {
    console.log(`[verify] app targets not in profile '${PROFILE}'; skipping app build`)
  }
}

// Docs
if (SCOPE === 'full') {
  run('docs:build', 'pnpm', ['--filter', 'yishan-docs', 'build'])
}

// Release build + validate
if (SCOPE === 'full') {
  run('release:build', process.execPath, [join(ROOT, 'scripts', 'release', 'build.mjs'), '--profile', PROFILE, '--version', VERSION])
  run('release:validate', process.execPath, [join(ROOT, 'scripts', 'release', 'validate.mjs'), '--artifact', join('artifacts', 'release', PROFILE, VERSION)])
}

console.log(`\n[verify] PASS profile=${PROFILE} scope=${SCOPE} version=${VERSION}`)
