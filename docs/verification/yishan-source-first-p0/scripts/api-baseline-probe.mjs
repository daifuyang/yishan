// P0 API behaviour probe against the built API (dist/app.js) + a TEMPORARY MySQL/Redis.
// Records observed HTTP status / envelope code for each probe (baseline capture, no asserts);
// compare runs with `node p0-compare.mjs smoke <expected.json> <actual.json>`.
//
// Usage: P0_PHASES=dev,pat,prod node api-baseline-probe.mjs <apiRoot> <dbUrl> <redisUrl> <outDir> <label>
// Preconditions: `pnpm --filter yishan-api build:ts`; DB provisioned with core + module tables and
// seed data (see database-migration-audit.md "smoke DB"); dev seed admin password admin123.
// The `dev` phase toggles sys_module.enabled for demo and restores it; `pat` creates and revokes PATs.
// Never point dbUrl at a shared or production database.
import { spawn } from 'node:child_process'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const [apiRoot, dbUrl, redisUrl, outDir, label] = process.argv.slice(2)
mkdirSync(outDir, { recursive: true })
const PORT = 3196
const BASE = `http://127.0.0.1:${PORT}`
const results = []
let server

function start(nodeEnv) {
  const env = {
    ...process.env,
    NODE_ENV: nodeEnv,
    PORT: String(PORT),
    DATABASE_URL: dbUrl,
    REDIS_URL: redisUrl,
    JWT_SECRET: 'p0-Temp-Isolated-Baseline-Secret-9f3c2a7e5b1d4c8a6e0f',
    ADMIN_REDIRECT_ROOT: 'false',
  }
  for (const k of ['DATABASE_HOST', 'DATABASE_USER', 'DATABASE_PASSWORD', 'DATABASE_NAME', 'DATABASE_PORT', 'REDIS_HOST', 'REDIS_PASSWORD']) delete env[k]
  const bin = join(apiRoot, 'node_modules', '.bin', process.platform === 'win32' ? 'fastify.CMD' : 'fastify')
  server = spawn(bin, ['start', '-l', 'warn', '-a', '127.0.0.1', '-p', String(PORT), 'dist/app.js'], { cwd: apiRoot, env, shell: process.platform === 'win32' })
  let log = ''
  server.stdout.on('data', (c) => { log += c })
  server.stderr.on('data', (c) => { log += c })
  server.getLog = () => log
}

async function stop() {
  if (!server) return
  const pid = server.pid
  if (process.platform === 'win32') spawn('taskkill', ['/pid', String(pid), '/T', '/F'])
  else server.kill('SIGTERM')
  await new Promise((r) => setTimeout(r, 1500))
  server = undefined
}

async function waitReady() {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`${BASE}/api/health`); if (r.status < 500) return true } catch {}
    await new Promise((r) => setTimeout(r, 1000))
  }
  console.error(server?.getLog?.())
  return false
}

async function probe(id, method, path, { token, body, note } = {}) {
  const headers = {}
  if (token) headers.authorization = `Bearer ${token}`
  if (body !== undefined) headers['content-type'] = 'application/json'
  let status, json, text
  try {
    const r = await fetch(`${BASE}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
    status = r.status
    text = await r.text()
    try { json = JSON.parse(text) } catch { json = undefined }
  } catch (e) { status = 'NETWORK_ERROR'; text = e.message }
  const envelopeKeys = json && typeof json === 'object' ? Object.keys(json).sort().join(',') : null
  const rec = { phase: label, id, method, path, note, status, code: json?.code, success: json?.success, message: json?.message, envelopeKeys }
  results.push(rec)
  console.log(`${id.padEnd(34)} ${method.padEnd(6)} ${path.padEnd(58)} -> ${status} code=${json?.code} ${json?.message ? String(json.message).slice(0, 60) : ''}`)
  return { status, json, text }
}

async function dumpOpenapi(name) {
  const r = await fetch(`${BASE}/api/docs/json`)
  const spec = await r.json()
  writeFileSync(join(outDir, name), JSON.stringify(spec, null, 1))
  return spec
}

const phases = {
  async dev() {
    start('development'); if (!(await waitReady())) throw new Error('server not ready')
    await probe('health', 'GET', '/api/health')
    await dumpOpenapi(`openapi-runtime-${label}-development.json`)
    await probe('unknown-route', 'GET', '/api/v1/__p0_nope__')
    await probe('unknown-module-route', 'GET', '/api/demo/v1/__p0_nope__')
    await probe('me-no-token', 'GET', '/api/v1/auth/me')
    await probe('admin-users-no-token', 'GET', '/api/v1/admin/users')
    await probe('me-bad-token', 'GET', '/api/v1/auth/me', { token: 'not.a.jwt' })
    await probe('demo-todos-no-token', 'GET', '/api/demo/v1/todos')
    await probe('demo-info-no-token', 'GET', '/api/demo/v1/info')
    await probe('login-bad-password', 'POST', '/api/v1/auth/login', { body: { username: 'admin', password: 'wrong-password-p0' } })
    const login = await probe('login-admin', 'POST', '/api/v1/auth/login', { body: { username: 'admin', password: 'admin123' }, note: 'seed default dev password' })
    const at = login.json?.data?.token
    const rt = login.json?.data?.refreshToken
    await probe('me-admin', 'GET', '/api/v1/auth/me', { token: at })
    await probe('admin-users-admin', 'GET', '/api/v1/admin/users?page=1&pageSize=1', { token: at })
    await probe('demo-todos-admin', 'GET', '/api/demo/v1/todos', { token: at })
    await probe('portal-categories-admin', 'GET', '/api/portal/v1/categories', { token: at })
    await probe('dev-module-list', 'GET', '/api/v1/admin/system/module-management/list', { token: at })
    await probe('pat-available-scopes', 'GET', '/api/v1/me/api-tokens/available-scopes', { token: at })
    const pat = await probe('pat-create-demo-list-scope', 'POST', '/api/v1/me/api-tokens', { token: at, body: { name: 'p0-probe', scopes: ['demo:todos:list'], duration: '7d' } })
    const patToken = pat.json?.data?.token ?? pat.json?.data?.rawToken ?? pat.json?.data?.plainToken
    await probe('pat-demo-todos (in scope)', 'GET', '/api/demo/v1/todos', { token: patToken })
    await probe('pat-admin-users (out of scope)', 'GET', '/api/v1/admin/users', { token: patToken })
    await probe('pat-revoke', 'DELETE', `/api/v1/me/api-tokens/${pat.json?.data?.id}`, { token: at })
    await probe('pat-after-revoke', 'GET', '/api/demo/v1/todos', { token: patToken })
    await probe('module-toggle-demo-off', 'POST', '/api/v1/admin/system/module-management/toggle/demo/toggle', { token: at, body: { enabled: false } })
    await probe('demo-todos-when-disabled', 'GET', '/api/demo/v1/todos', { token: at })
    await probe('demo-info-when-disabled', 'GET', '/api/demo/v1/info')
    await probe('core-health-when-demo-disabled', 'GET', '/api/health')
    const refreshed = await probe('refresh', 'POST', '/api/v1/auth/refresh', { body: { refreshToken: rt } })
    const at2 = refreshed.json?.data?.token
    await probe('me-after-refresh', 'GET', '/api/v1/auth/me', { token: at2 })
    await probe('logout', 'POST', '/api/v1/auth/logout', { token: at2, body: {} })
    await probe('me-after-logout', 'GET', '/api/v1/auth/me', { token: at2 })
    writeFileSync(join(outDir, `server-log-${label}-dev1.txt`), server.getLog())
    await stop()

    // Restart: demo must stay disabled (sys_module.enabled not overwritten by sync)
    start('development'); if (!(await waitReady())) throw new Error('server not ready (restart)')
    const l2 = await probe('login-admin-after-restart', 'POST', '/api/v1/auth/login', { body: { username: 'admin', password: 'admin123' } })
    const at3 = l2.json?.data?.token
    await probe('demo-todos-after-restart (still disabled?)', 'GET', '/api/demo/v1/todos', { token: at3 })
    await probe('module-toggle-demo-on', 'POST', '/api/v1/admin/system/module-management/toggle/demo/toggle', { token: at3, body: { enabled: true } })
    await probe('demo-todos-reenabled', 'GET', '/api/demo/v1/todos', { token: at3 })
    await probe('app-login', 'POST', '/api/v1/app/auth/login', { body: { username: 'admin', password: 'admin123' } })
    writeFileSync(join(outDir, `server-log-${label}-dev2.txt`), server.getLog())
    await stop()
  },
  async pat() {
    start('development'); if (!(await waitReady())) throw new Error('server not ready (pat)')
    const login = await probe('login-admin', 'POST', '/api/v1/auth/login', { body: { username: 'admin', password: 'admin123' } })
    const at = login.json?.data?.token
    for (const [name, scopes] of [['empty', []], ['star', ['*']], ['super-bypass', ['__super_admin__']], ['core-user-list', ['system:user:list']]]) {
      const r = await probe(`pat-create-${name}`, 'POST', '/api/v1/me/api-tokens', { token: at, body: { name: `p0-${name}`, scopes, duration: '7d' } })
      const tok = r.json?.data?.token
      const keys = r.json?.data ? Object.keys(r.json.data).sort().join(',') : ''
      results[results.length - 1].dataKeys = keys
      if (tok) {
        await probe(`pat-${name}-admin-users`, 'GET', '/api/v1/admin/users?page=1&pageSize=1', { token: tok })
        await probe(`pat-${name}-demo-todos`, 'GET', '/api/demo/v1/todos', { token: tok })
        await probe(`pat-${name}-me`, 'GET', '/api/v1/auth/me', { token: tok })
        if (r.json?.data?.id) await probe(`pat-${name}-revoke`, 'DELETE', `/api/v1/me/api-tokens/${r.json.data.id}`, { token: at })
        await probe(`pat-${name}-after-revoke`, 'GET', '/api/v1/auth/me', { token: tok })
      }
    }
    writeFileSync(join(outDir, `server-log-${label}-pat.txt`), server.getLog())
    await stop()
  },
  async prod() {
    start('production'); if (!(await waitReady())) throw new Error('server not ready (prod)')
    await probe('health', 'GET', '/api/health')
    const spec = await dumpOpenapi(`openapi-runtime-${label}-production.json`)
    console.log('prod paths', Object.keys(spec.paths).length, 'dev paths present:', Object.keys(spec.paths).filter((p) => p.includes('module-management')))
    const login = await probe('login-admin', 'POST', '/api/v1/auth/login', { body: { username: 'admin', password: 'admin123' } })
    await probe('dev-module-list (prod)', 'GET', '/api/v1/admin/system/module-management/list', { token: login.json?.data?.token })
    await probe('dev-module-toggle (prod)', 'POST', '/api/v1/admin/system/module-management/toggle/demo/toggle', { token: login.json?.data?.token, body: { enabled: false } })
    await probe('demo-todos (prod)', 'GET', '/api/demo/v1/todos', { token: login.json?.data?.token })
    await probe('pat-available-scopes (prod)', 'GET', '/api/v1/me/api-tokens/available-scopes', { token: login.json?.data?.token })
    writeFileSync(join(outDir, `server-log-${label}-prod.txt`), server.getLog())
    await stop()
  },
}

try {
  for (const p of (process.env.P0_PHASES ?? 'dev,prod').split(',')) await phases[p]()
} catch (e) {
  console.error('SMOKE ERROR', e.message)
  if (server) { console.error(server.getLog()); await stop() }
  process.exitCode = 1
}
writeFileSync(join(outDir, `smoke-${label}.json`), JSON.stringify(results, null, 1))
