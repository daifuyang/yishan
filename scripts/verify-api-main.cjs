const assert = require('node:assert/strict')
const { randomBytes } = require('node:crypto')
const { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } = require('node:fs')
const { createRequire } = require('node:module')
const net = require('node:net')
const { tmpdir } = require('node:os')
const { basename, dirname, isAbsolute, join, relative, resolve, sep } = require('node:path')
const { spawn } = require('node:child_process')

const repositoryRoot = resolve(__dirname, '..')
const secrets = []
const redact = value => secrets.filter(Boolean).reduce((text, secret) => text.replaceAll(secret, '[redacted]'), String(value))
const delay = milliseconds => new Promise(resolveDelay => setTimeout(resolveDelay, milliseconds))

function assertDisposable(name) {
  if (!/^yishan_main_test_[a-f0-9]{20}$/.test(name)) throw new Error('Refusing to mutate a non-test database or cache namespace')
}

async function freePort() {
  const server = net.createServer()
  await new Promise((resolveListen, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolveListen) })
  const port = server.address().port
  await new Promise(resolveClose => server.close(resolveClose))
  return port
}

async function withTimeout(promise, milliseconds, message) {
  let timer
  try {
    return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), milliseconds) })])
  } finally { clearTimeout(timer) }
}

async function removeOwnedCache(Redis, namespace) {
  assertDisposable(namespace)
  const redis = new Redis({ host: '127.0.0.1', port: 6379, db: 15, lazyConnect: true, enableOfflineQueue: false,
    connectTimeout: 5000, maxRetriesPerRequest: 1, retryStrategy: () => null })
  try {
    await redis.connect()
    let cursor = '0'
    do {
      const result = await redis.scan(cursor, 'MATCH', `${namespace}:*`, 'COUNT', 100)
      cursor = result[0]
      for (const key of result[1]) {
        if (!key.startsWith(`${namespace}:`)) throw new Error('Refusing to remove an unrelated cache key')
      }
      if (result[1].length) await redis.del(...result[1])
    } while (cursor !== '0')
  } finally { redis.disconnect() }
}

async function verifyMain() {
  if (process.argv.length !== 4 || process.argv[2] !== '--artifact') {
    throw new Error('Usage: node scripts/verify-api-main.cjs --artifact <standalone-package-directory>')
  }
  const artifact = realpathSync(resolve(process.argv[3]))
  const location = relative(repositoryRoot, artifact)
  if (location !== '..' && !location.startsWith(`..${sep}`) && !isAbsolute(location)) {
    throw new Error('Use a packaged artifact outside the repository')
  }
  const requireArtifact = createRequire(join(artifact, 'dist/app.js'))
  const { createConnection } = requireArtifact('mysql2/promise')
  const { createDatabase, migrateDatabase } = requireArtifact('@yishan/core-database')
  const { systemModule, seedSystem, finalizeSystemSeed } = requireArtifact('@yishan/core-system-api')
  const { schema } = requireArtifact('@yishan/core-system-api/schema')
  const systemRequire = createRequire(requireArtifact.resolve('@yishan/core-system-api'))
  const Redis = createRequire(systemRequire.resolve('@fastify/redis'))('ioredis')
  const { demoModules } = requireArtifact('./manifest.js')
  const { buildApp } = requireArtifact('./app.js')
  const { loadConfig } = requireArtifact('./config/index.js')
  const migrationMetadata = [systemModule, ...demoModules].filter(module => module.migrations).map(module => {
    for (const resource of ['_journal.json', '_published-hashes.json']) {
      assert(existsSync(join(module.migrations.folder, 'meta', resource)), `Missing packaged migration metadata: ${module.id}/${resource}`)
    }
    return module.id
  })
  const stack = readFileSync(join(repositoryRoot, 'infra/local-dev-stack.yml'), 'utf8')
  const password = process.env.YISHAN_TEST_MYSQL_PASSWORD
    ?? /^\s*MYSQL_ROOT_PASSWORD:\s*([^\r\n]+)$/m.exec(stack)?.[1]?.trim().replace(/^['"]|['"]$/g, '')
  if (!password) throw new Error('Local development MySQL password is missing')
  const adminPassword = `MainSmoke${randomBytes(12).toString('hex')}`
  const jwtSecret = randomBytes(32).toString('hex')
  secrets.push(password, adminPassword, jwtSecret)
  const name = `yishan_main_test_${randomBytes(10).toString('hex')}`
  assertDisposable(name)
  const connection = { host: '127.0.0.1', port: 3306, user: 'root', password }
  const helperRoot = realpathSync(tmpdir())
  const helperDirectory = mkdtempSync(join(helperRoot, 'yishan-main-smoke-'))
  // Only operating-system variables are inherited. Product credentials and dotenv paths are explicit.
  const environment = Object.fromEntries(['PATH', 'SystemRoot', 'SystemDrive', 'TEMP', 'TMP'].flatMap(key => process.env[key] ? [[key, process.env[key]]] : []))
  Object.assign(environment, { NODE_ENV: 'production', DOTENV_CONFIG_PATH: join(helperDirectory, 'absent.env'), JWT_SECRET: jwtSecret,
    DATABASE_URL: `mysql://root:${encodeURIComponent(password)}@127.0.0.1:3306/${name}`, DATABASE_HOST: '127.0.0.1', DATABASE_PORT: '3306',
    DATABASE_USER: 'root', DATABASE_PASSWORD: password, DATABASE_NAME: name, REDIS_URL: 'redis://127.0.0.1:6379/15',
    CACHE_NAMESPACE: name, LOG_LEVEL: 'silent', ADMIN_REDIRECT_ROOT: 'false', GIT_COMMIT_SHA: 'main-smoke', SEED_ADMIN_PASSWORD: adminPassword })
  secrets.push(environment.DATABASE_URL)
  let admin, database, app, child, childExit
  let ownsSchema = false, exited = false, childOutput = ''
  try {
    admin = await createConnection(connection)
    await admin.query('CREATE DATABASE ??', [name])
    ownsSchema = true
    database = createDatabase({ connection: { ...connection, database: name }, schema })
    await migrateDatabase(database.db, [systemModule, ...demoModules].flatMap(module => module.migrations ? [module.migrations] : []))
    app = await buildApp(loadConfig({ ...environment, NODE_ENV: 'test' }), demoModules, { redis: false, staticAssets: false })
    await app.system.run(async () => {
      await seedSystem()
      for (const module of demoModules) await module.seed?.(app.system)
      await finalizeSystemSeed()
    })
    await app.close()
    app = undefined
    const port = await freePort()
    Object.assign(environment, { HOST: '127.0.0.1', PORT: String(port) })
    const helper = join(helperDirectory, 'signal.cjs')
    // Windows kill(SIGINT) terminates a child. IPC exercises the actual main handler and graceful cleanup.
    writeFileSync(helper, "process.on('message', message => { if (message === 'SIGINT') { process.emit('SIGINT'); process.disconnect(); } });\n")
    child = spawn(process.execPath, ['--require', helper, 'dist/main.js'], { cwd: artifact, env: environment, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] })
    const capture = data => { childOutput = (childOutput + redact(data)).slice(-4000) }
    child.stdout.on('data', capture)
    child.stderr.on('data', capture)
    childExit = new Promise(resolveExit => {
      child.once('error', error => { exited = true; resolveExit({ error }) })
      child.once('exit', (code, signal) => { exited = true; resolveExit({ code, signal }) })
    })
    const base = `http://127.0.0.1:${port}`
    let health
    for (let attempt = 0; attempt < 80; attempt++) {
      if (exited) throw new Error(`Main exited before readiness: ${childOutput}`)
      try { health = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(500) }); break } catch {}
      await delay(250)
    }
    assert(health, 'Main did not become ready')
    assert.equal(health.status, 200)
    assert.equal((await health.json()).data.db.ok, true)
    const request = (url, options = {}) => fetch(`${base}${url}`, { ...options, signal: AbortSignal.timeout(5000) })
    const login = await request('/api/v1/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: adminPassword }) })
    assert.equal(login.status, 200)
    const auth = await login.json()
    secrets.push(auth.data.token, auth.data.refreshToken ?? '')
    const headers = { authorization: `Bearer ${auth.data.token}` }
    const me = await request('/api/v1/auth/me', { headers })
    assert.equal(me.status, 200)
    const docs = await request('/api/docs/json')
    assert.equal(docs.status, 200)
    const spec = await docs.json()
    assert(spec.paths['/api/demo/v1/me/profile'])
    const development = await request('/api/v1/admin/system/module-management/list/', { headers })
    assert.equal(development.status, 404)
    const adminIndex = join(artifact, 'public/admin/index.html')
    let adminStatus
    if (existsSync(adminIndex)) {
      const adminResponse = await request('/admin/')
      assert.equal(adminResponse.status, 200)
      assert.match(adminResponse.headers.get('content-type'), /text\/html/)
      assert.equal(await adminResponse.text(), readFileSync(adminIndex, 'utf8'))
      adminStatus = adminResponse.status
    }
    child.send('SIGINT')
    const shutdown = await withTimeout(childExit, 10000, 'Main SIGINT handler did not release resources')
    assert.equal(shutdown.code, 0)
    assert.equal(shutdown.signal, null)
    console.log(JSON.stringify({ node: process.version, artifact, health: health.status, login: login.status, jwtMe: me.status,
      openapi: docs.status, paths: Object.keys(spec.paths).length, productionDevGate: development.status, admin: adminStatus,
      migrationMetadata,
      shutdown: { mechanism: 'main SIGINT handler via IPC', ...shutdown } }))
  } finally {
    try {
      if (child && !exited) { child.kill(); await withTimeout(childExit, 5000, 'Could not stop smoke-test main') }
      await app?.close()
    } finally {
      try { await database?.close() }
      finally {
        try {
          if (ownsSchema) { assertDisposable(name); await admin.query('DROP DATABASE ??', [name]) }
        } finally {
          try { await admin?.end() }
          finally {
            try { if (child) await removeOwnedCache(Redis, name) }
            finally {
              const target = realpathSync(helperDirectory)
              if (dirname(target) !== helperRoot || !basename(target).startsWith('yishan-main-smoke-')) throw new Error('Refusing to remove an unrelated helper directory')
              rmSync(target, { recursive: true, force: true })
            }
          }
        }
      }
    }
  }
}

verifyMain().catch(error => { console.error(redact(error.message)); process.exitCode = 1 })
