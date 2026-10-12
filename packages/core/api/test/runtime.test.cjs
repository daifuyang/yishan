const { test } = require('node:test')
const assert = require('node:assert/strict')
const { AsyncLocalStorage } = require('node:async_hooks')
const { createYishanApi, PermissionCatalog } = require('../dist/index.js')

function moduleDefinition(id, overrides = {}) {
  return {
    id, name: id, version: '2.0.0', tablePrefix: `${id}_`, contractVersion: 2,
    async register(router, context) { router.get('/value', async () => ({ value: context.value })) },
    ...overrides,
  }
}

test('validates module graph before acquiring resources', async () => {
  const mutations = [
    [[null], /invalid module definition/],
    [[moduleDefinition('a', { name: '' })], /invalid module definition/],
    [[moduleDefinition('a', { tablePrefix: '' })], /invalid module definition/],
    [[moduleDefinition('a', { tablePrefix: 'sys-table' })], /invalid module definition/],
    [[moduleDefinition('a', { close: true })], /invalid module lifecycle/],
    [[moduleDefinition('a', { dependencies: {} })], /invalid module dependencies/],
    [[moduleDefinition('a', { migrations: {} })], /invalid module migrations/],
    [[moduleDefinition('a', { migrations: false })], /invalid module migrations/],
    [[moduleDefinition('a', { migrations: { id: 'a', folder: '', historyTable: '__migrations_a' } })], /invalid module migrations/],
    [[moduleDefinition('a', { prefix: 12 })], /invalid module prefix/],
    [[moduleDefinition('bad-id')], /invalid module id/],
    [[moduleDefinition('a'.repeat(25))], /invalid module id/],
    [[moduleDefinition('a'), moduleDefinition('a')], /duplicate module id/],
    [[moduleDefinition('a', { contractVersion: 1 })], /unsupported module contract/],
    [[moduleDefinition('a', { version: 'nope' })], /invalid module version/],
    [[moduleDefinition('a', { dependencies: [{ id: 'missing' }] })], /missing module dependency/],
    [[moduleDefinition('a', { dependencies: [{ id: 'b' }] }), moduleDefinition('b', { dependencies: [{ id: 'a' }] })], /dependency cycle/],
    [[moduleDefinition('a', { dependencies: [{ id: 'b', version: '^3.0.0' }] }), moduleDefinition('b')], /dependency version mismatch/],
    [[moduleDefinition('a', { dependencies: [{ id: 'b', version: 'invalid' }] }), moduleDefinition('b')], /dependency version mismatch/],
    [[moduleDefinition('a', { prefix: '/api/shared' }), moduleDefinition('b', { prefix: '/api/shared' })], /duplicate module prefix/],
    [[moduleDefinition('a', { prefix: '/api/a' }), moduleDefinition('b', { prefix: '/api/a/b' })], /overlapping module prefix/],
    [[moduleDefinition('a', { prefix: '/api/a/b' }), moduleDefinition('b', { prefix: '/api/a' })], /overlapping module prefix/],
  ]
  for (const [modules, expected] of mutations) {
    let connected = false
    await assert.rejects(createYishanApi({ modules, context: {}, resources: [{ async connect() { connected = true }, async close() {} }] }), expected)
    assert.equal(connected, false)
  }
})

test('registers deterministic dependency order and closes initialized modules in reverse', async () => {
  const events = []
  const modules = ['c', 'b', 'a'].map(id => moduleDefinition(id, {
    dependencies: id === 'c' ? [{ id: 'a', version: '>=2.0.0' }] : id === 'b' ? [{ id: 'a', version: '^2.0.0' }] : [],
    async register() { events.push(`register:${id}`) },
    async initialize() { events.push(`initialize:${id}`) },
    async close() { events.push(`close:${id}`) },
  }))
  const app = await createYishanApi({ modules, context: {} })
  assert.deepEqual(events, ['register:a', 'register:b', 'register:c', 'initialize:a', 'initialize:b', 'initialize:c'])
  assert.deepEqual([...app.moduleLoader.listModuleIds()], ['a', 'b', 'c'])
  assert.deepEqual([...app.moduleLoader.listMounted()], ['a', 'b', 'c'])
  assert.equal(app.moduleLoader.isMounted('b'), true)
  await app.close()
  assert.deepEqual(events.slice(-3), ['close:c', 'close:b', 'close:a'])
})

test('isolates permissions, context and enabled-state caches between two injected servers', async () => {
  const storage = new AsyncLocalStorage()
  const definition = moduleDefinition('demo', {
    async register(router) {
      router.permissionCatalog.register({ code: 'demo:read', label: 'Read', group: 'demo' })
      router.get('/value', async () => {
        await new Promise(resolve => setImmediate(resolve))
        return { value: storage.getStore().value }
      })
    },
  })
  let enabledA = new Set(['demo'])
  let reads = 0
  const a = await createYishanApi({
    modules: [definition], context: { value: 'A' },
    runInContext: fn => storage.run({ value: 'A' }, fn),
    moduleState: { async sync() {}, async enabledIds() { reads++; return enabledA } },
  })
  const b = await createYishanApi({ modules: [definition], context: { value: 'B' }, runInContext: fn => storage.run({ value: 'B' }, fn) })
  try {
    const responses = await Promise.all([a.inject('/api/demo/value'), b.inject('/api/demo/value')])
    assert.deepEqual(responses.map(response => response.json()), [{ value: 'A' }, { value: 'B' }])
    assert.notEqual(a.permissionCatalog, b.permissionCatalog)
    assert.equal(a.permissionCatalog.has('demo:read'), true)
    enabledA = new Set()
    assert.equal((await a.inject('/api/demo/value')).statusCode, 200)
    assert.equal(reads, 1)
    await a.moduleLoader.invalidateEnabledCache()
    const disabled = await a.inject('/api/demo/value')
    assert.equal(disabled.statusCode, 404)
    assert.equal(disabled.json().code, 40400)
    assert.equal((await b.inject('/api/demo/value')).statusCode, 200)
    assert.equal((await a.inject('/missing')).json().code, 25005)
  } finally { await Promise.all([a.close(), b.close()]) }
})

test('syncs only business metadata and leaves the system module outside traffic gates', async () => {
  let synced
  const app = await createYishanApi({
    modules: [moduleDefinition('system', { prefix: '' }), moduleDefinition('demo')], context: { value: 1 },
    moduleState: { async sync(modules) { synced = modules }, async enabledIds() { return new Set() } },
  })
  try {
    assert.deepEqual(synced.map(module => module.id), ['demo'])
    assert.equal((await app.inject('/value')).statusCode, 200)
    assert.equal((await app.inject('/api/demo/value')).json().code, 40400)
  } finally { await app.close() }
})

test('disabled modules remain gated when the router accepts different URL casing', async () => {
  const app = await createYishanApi({ modules: [moduleDefinition('demo')], context: { value: 1 },
    serverOptions: { routerOptions: { caseSensitive: false } },
    moduleState: { async sync() {}, async enabledIds() { return new Set() } },
  })
  try {
    const response = await app.inject('/API/DEMO/VALUE')
    assert.equal(response.statusCode, 404)
    assert.equal(response.json().code, 40400)
  } finally { await app.close() }
})

test('recognizes an explicitly empty prefix as root without a reserved module name', async () => {
  const synced = []
  const app = await createYishanApi({ modules: [moduleDefinition('platform', { prefix: '' }), moduleDefinition('system')], context: { value: 1 },
    moduleState: { async sync(modules) { synced.push(...modules.map(module => module.id)) }, async enabledIds() { return new Set() } },
  })
  try {
    assert.deepEqual(synced, ['system'])
    assert.deepEqual([...app.moduleLoader.listModuleIds()], ['system'])
    assert.equal((await app.inject('/value')).statusCode, 200)
    assert.equal((await app.inject('/api/system/value')).json().code, 40400)
  } finally { await app.close() }
})

test('releases partially connected resources and failed module initialization exactly once', async () => {
  const events = []
  await assert.rejects(createYishanApi({
    modules: [moduleDefinition('demo', { async initialize() { events.push('init'); throw new Error('init failed') }, async close() { events.push('module-close') } })],
    context: {}, resources: [{ async connect() { events.push('connect') }, async close() { events.push('resource-close') } }],
  }), /init failed/)
  assert.deepEqual(events, ['connect', 'init', 'module-close', 'resource-close'])
  const resourceEvents = []
  await assert.rejects(createYishanApi({ modules: [], context: {}, resources: [
    { async connect() { resourceEvents.push('a') }, async close() { resourceEvents.push('close-a') } },
    { async connect() { throw new Error('connect failed') }, async close() { resourceEvents.push('close-b') } },
  ] }), /connect failed/)
  assert.deepEqual(resourceEvents, ['a', 'close-b', 'close-a'])
})

test('permission declarations are immutable snapshots and duplicates are scoped to one catalog', () => {
  const a = new PermissionCatalog()
  const b = new PermissionCatalog()
  const definition = { code: 'read', label: 'Read', group: 'demo' }
  a.register(definition)
  b.register(definition)
  definition.code = 'changed'
  assert.equal(a.has('read'), true)
  assert.equal(a.listPermissions()[0].code, 'read')
  assert.throws(() => a.register({ code: 'read', label: 'Read', group: 'demo' }), /duplicate/)
  assert.equal(Object.isFrozen(a.listPermissions()[0]), true)
})

test('preserves explicit OpenAPI security without adding security to public routes', async () => {
  const { swaggerPlugin } = require('../dist/plugins.js')
  const app = await createYishanApi({ modules: [moduleDefinition('demo', {
    async register(router) {
      router.get('/public', { schema: {} }, async () => 'public')
      router.get('/private', { schema: { security: [{ bearerAuth: [] }] }, preHandler: async (_request, reply) => { reply.code(401).send('denied') } }, async () => 'private')
    },
  })], context: {}, async setup(router) { await router.register(swaggerPlugin) } })
  try {
    assert.equal((await app.inject('/api/demo/public')).statusCode, 200)
    assert.equal((await app.inject('/api/demo/private')).statusCode, 401)
    const paths = app.swagger().paths
    assert.deepEqual(paths['/api/demo/private'].get.security, [{ bearerAuth: [] }])
    assert.equal(paths['/api/demo/public'].get.security, undefined)
    assert.equal(app.swagger().tags?.some(tag => ['crm', 'demo', 'shop', 'portal'].includes(tag.name)) ?? false, false)
  } finally { await app.close() }
})

test('registers route permission metadata per instance and rejects inconsistent declarations', async () => {
  const metadata = { 'x-permission-code': 'demo:read', 'x-permission-label': 'Read', 'x-permission-group': 'demo' }
  const app = await createYishanApi({ modules: [moduleDefinition('demo', {
    async register(router) {
      router.get('/first', { schema: metadata }, async () => 'ok')
      router.get('/second', { schema: metadata }, async () => 'ok')
    },
  })], context: {} })
  try { assert.equal(app.permissionCatalog.has('demo:read'), true) } finally { await app.close() }
  await assert.rejects(createYishanApi({ modules: [moduleDefinition('demo', {
    async register(router) {
      router.get('/first', { schema: metadata }, async () => 'ok')
      router.get('/second', { schema: { ...metadata, 'x-permission-label': 'Changed' } }, async () => 'ok')
    },
  })], context: {} }), /inconsistent permission/)
})

test('continues closing other modules and resources after a close hook fails', async () => {
  const events = []
  const app = await createYishanApi({ modules: [moduleDefinition('a', { async close() { events.push('a') } }), moduleDefinition('b', { async close() { events.push('b'); throw new Error('close failed') } })], context: {},
    resources: [{ async close() { events.push('resource') } }],
  })
  await assert.rejects(app.close(), /cleanup failed/)
  assert.deepEqual(events, ['b', 'a', 'resource'])
})

test('scopes the permission facade during registration, async requests and shutdown by default', async () => {
  const { registerPermissions, currentPermissionCatalog } = require('../dist/permissions/catalog.js')
  const closed = []
  const definition = moduleDefinition('demo', {
    async register(router) {
      await Promise.resolve()
      registerPermissions({ code: 'demo:read', label: 'Read', group: 'demo' })
      router.get('/permission', async () => {
        await new Promise(resolve => setImmediate(resolve))
        return { registered: currentPermissionCatalog().has('demo:read') }
      })
    },
    async close() { closed.push(currentPermissionCatalog().has('demo:read')) },
  })
  const a = await createYishanApi({ modules: [definition], context: {} })
  const b = await createYishanApi({ modules: [definition], context: {} })
  try {
    assert.notEqual(a.permissionCatalog, b.permissionCatalog)
    assert.deepEqual((await a.inject('/api/demo/permission')).json(), { registered: true })
    assert.deepEqual((await b.inject('/api/demo/permission')).json(), { registered: true })
  } finally { await Promise.all([a.close(), b.close()]) }
  assert.deepEqual(closed, [true, true])
})

test('keeps plugin close hooks inside the application context when close is called by its host', async () => {
  const storage = new AsyncLocalStorage()
  let closeContext
  const app = await createYishanApi({ modules: [moduleDefinition('demo', {
    async register(router) { router.addHook('onClose', async () => { closeContext = storage.getStore()?.value }) },
  })], context: {}, runInContext: operation => storage.run({ value: 'host' }, operation) })
  await app.close()
  assert.equal(closeContext, 'host')
})

test('keeps plugin listen hooks inside the application context when listen is called by its host', async () => {
  const storage = new AsyncLocalStorage()
  let listenContext
  const app = await createYishanApi({ modules: [], context: {}, runInContext: operation => storage.run({ value: 'host' }, operation),
    async setup(router) { router.addHook('onListen', async () => { listenContext = storage.getStore()?.value }) },
  })
  try {
    await app.listen({ host: '127.0.0.1', port: 0 })
    assert.equal(listenContext, 'host')
  } finally { await app.close() }
})
