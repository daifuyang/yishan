const assert = require('node:assert/strict')
const test = require('node:test')
const { loadSource } = require('./load-source.cjs')

function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const turn = () => new Promise(setImmediate)
function response(data, status = 200, code = 200) {
  return { statusCode: status, data: { success: status >= 200 && status < 300 && code === 200, code, message: 'fixture', data, timestamp: '2026-10-10' } }
}
function harness(handler) {
  const core = loadSource('src/index.ts', { '@tarojs/taro': { request: handler } })
  const values = new Map()
  const storage = core.createStorage({
    getStorageSync: key => values.get(key),
    setStorageSync: (key, value) => values.set(key, value),
    removeStorageSync: key => values.delete(key),
    clearStorageSync: () => values.clear(),
  })
  function product(id, options = {}) {
    const keys = { ACCESS_TOKEN: id + ':access', REFRESH_TOKEN: id + ':refresh', USER: id + ':user' }
    storage.set(keys.ACCESS_TOKEN, id + '-old')
    storage.set(keys.REFRESH_TOKEN, id + '-refresh')
    const client = core.createApiClient({ baseUrl: 'https://' + id + '.test', storage, storageKeys: keys, refreshPath: '/refresh', ...options })
    return { client, keys, storage, core, values }
  }
  return { core, storage, values, product }
}

test('product error policy replaces business codes while HTTP 401 always expires', async () => {
  let refreshes = 0
  const h = harness(async opts => {
    if (opts.url.endsWith('/refresh')) { refreshes++; return response({ token: 'renewed', refreshToken: 'rotated' }) }
    if (opts.header.Authorization === 'Bearer renewed') return response('ok')
    return response(null, opts.url.endsWith('/http') ? 401 : 200, opts.url.endsWith('/legacy') ? 22004 : 90001)
  })
  const a = h.product('a', { isUnauthorized: (status, body) => body?.code === 90001 })
  assert.equal(await a.client.request({ path: '/custom' }), 'ok')
  const b = h.product('b', { isUnauthorized: () => false })
  await assert.rejects(b.client.request({ path: '/custom' }), { code: 90001 })
  assert.equal(h.values.get(b.keys.ACCESS_TOKEN), 'b-old')
  await assert.rejects(b.client.request({ path: '/legacy' }), { code: 22004 })
  assert.equal(h.values.get(b.keys.ACCESS_TOKEN), 'b-old')
  assert.equal(await b.client.request({ path: '/http' }), 'ok')
  assert.equal(refreshes, 2)
})

test('default auth codes are unchanged and normal business errors preserve identity', async () => {
  let code = 0
  const h = harness(async () => response(null, 200, code))
  for (code of [401, 401000, 401001, 401003, 22001, 22003, 22004, 22005, 22006, 22009]) {
    const a = h.product('a')
    await assert.rejects(a.client.request({ path: '/private', skipRefresh: true }), { name: 'UnauthorizedError' })
    assert.equal(h.values.has(a.keys.ACCESS_TOKEN), false)
  }
  code = 22002
  const a = h.product('a')
  await assert.rejects(a.client.request({ path: '/private' }), { code: 22002 })
  assert.equal(h.values.get(a.keys.ACCESS_TOKEN), 'a-old')
})

test('session key namespaces are immutable, reject unsafe identifiers and preserve the legacy app namespace', () => {
  const { core } = harness(async () => response(null))
  assert.deepEqual(core.createSessionStorageKeys('app'), { ACCESS_TOKEN: 'yishan:app:accessToken', REFRESH_TOKEN: 'yishan:app:refreshToken', USER: 'yishan:app:user' })
  assert.ok(Object.isFrozen(core.createSessionStorageKeys('crm')))
  for (const id of ['', ' ', 'CRM', 'crm:axis', '../axis', 'crm axis', '-crm', 'crm-', 'crm--axis', null, undefined]) assert.throws(() => core.createSessionStorageKeys(id))
  assert.equal(core.createSessionStorageKeys('axis-v2').ACCESS_TOKEN, 'yishan:axis-v2:accessToken')
})

test('same-origin Demo, CRM and Axis sessions clear and refresh only their own keys', async () => {
  const h = harness(async opts => opts.url.endsWith('/refresh') ? response({ token: 'demo-new', refreshToken: 'demo-rotated' }) : opts.header.Authorization === 'Bearer demo-token' ? response(null, 401) : response('demo-ok'))
  const keys = { demo: h.core.createSessionStorageKeys('app'), crm: h.core.createSessionStorageKeys('crm'), axis: h.core.createSessionStorageKeys('axis') }
  for (const [id, session] of Object.entries(keys)) {
    h.storage.set(session.ACCESS_TOKEN, id + '-token')
    h.storage.set(session.REFRESH_TOKEN, id + '-refresh')
    h.storage.set(session.USER, { id })
  }
  const crm = h.core.createApiClient({ baseUrl: '', storage: h.storage, storageKeys: keys.crm, refreshPath: '/refresh' })
  const crmAuth = h.core.createAuthStore({ client: crm, storage: h.storage, storageKeys: keys.crm, api: { login: async () => null, logout: async () => null, getCurrentUser: async () => null, getCapabilities: async () => null }, onUnauthorized() {} })
  crmAuth.useAuthStore.getState().clear()
  assert.equal(h.storage.get(keys.crm.USER), null)
  assert.equal(h.storage.get(keys.demo.ACCESS_TOKEN), 'demo-token')
  assert.equal(h.storage.get(keys.axis.ACCESS_TOKEN), 'axis-token')
  assert.deepEqual(h.storage.get(keys.axis.USER), { id: 'axis' })
  const demo = h.core.createApiClient({ baseUrl: '', storage: h.storage, storageKeys: keys.demo, refreshPath: '/refresh' })
  assert.equal(await demo.request({ path: '/private' }), 'demo-ok')
  assert.equal(h.storage.get(keys.demo.ACCESS_TOKEN), 'demo-new')
  assert.equal(h.storage.get(keys.axis.REFRESH_TOKEN), 'axis-refresh')
  assert.equal(h.storage.get(keys.crm.ACCESS_TOKEN), null)
})

test('two client refresh flights coalesce within each product and keep callbacks independent', async () => {
  const flights = { a: deferred(), b: deferred() }
  const counts = { a: 0, b: 0 }, callbacks = []
  const h = harness(async opts => {
    const id = new URL(opts.url).hostname[0]
    if (opts.url.endsWith('/refresh')) { counts[id]++; assert.deepEqual(opts.data, { refreshToken: id + '-refresh' }); assert.equal(opts.header.Authorization, undefined); return flights[id].promise }
    return opts.header.Authorization.endsWith('-old') ? response(null, 401) : response(id)
  })
  const a = h.product('a'), b = h.product('b')
  a.client.setTokenRefreshedHandler(data => callbacks.push(['a', data.token]))
  b.client.setTokenRefreshedHandler(data => callbacks.push(['b', data.token]))
  const aRequests = Promise.all([a.client.request({ path: '/one' }), a.client.request({ path: '/two' })])
  const bRequests = Promise.all([b.client.request({ path: '/one' }), b.client.request({ path: '/two' })])
  await turn()
  assert.deepEqual(counts, { a: 1, b: 1 })
  flights.a.resolve(response({ token: 'a-new', refreshToken: 'a-rotated' }))
  assert.deepEqual(await aRequests, ['a', 'a'])
  assert.equal(h.values.get(b.keys.ACCESS_TOKEN), 'b-old')
  assert.deepEqual(callbacks, [['a', 'a-new']])
  flights.b.resolve(response({ token: 'b-new', refreshToken: 'b-rotated' }))
  assert.deepEqual(await bRequests, ['b', 'b'])
  assert.deepEqual(callbacks, [['a', 'a-new'], ['b', 'b-new']])
})

test('refresh transport errors preserve credentials and allow a later retry', async () => {
  let online = false, clears = 0
  const h = harness(async opts => {
    if (opts.url.endsWith('/refresh')) { if (!online) throw Error('offline'); return response({ token: 'a-new', refreshToken: 'a-rotated' }) }
    return opts.header.Authorization === 'Bearer a-old' ? response(null, 401) : response('ok')
  })
  const a = h.product('a')
  a.client.setUnauthorizedHandler(() => clears++)
  await assert.rejects(a.client.request({ path: '/private' }), { code: -1, httpStatus: 0 })
  assert.equal(h.values.get(a.keys.REFRESH_TOKEN), 'a-refresh')
  assert.equal(clears, 0)
  online = true
  assert.equal(await a.client.request({ path: '/private' }), 'ok')
})

test('cancelled old refresh cannot restore an identity after logout and a new account login', async () => {
  const refresh = deferred()
  const h = harness(async opts => opts.url.endsWith('/refresh') ? refresh.promise : response(null, 401))
  const a = h.product('a'), controller = new AbortController()
  let callbacks = 0
  a.client.setTokenRefreshedHandler(() => callbacks++)
  const result = Promise.allSettled([a.client.request({ path: '/private', signal: controller.signal })])
  await turn()
  controller.abort()
  a.client.invalidateSessionRequests()
  h.storage.remove(a.keys.ACCESS_TOKEN)
  h.storage.remove(a.keys.REFRESH_TOKEN)
  h.storage.set(a.keys.ACCESS_TOKEN, 'new-account')
  h.storage.set(a.keys.REFRESH_TOKEN, 'new-account-refresh')
  refresh.resolve(response({ token: 'stale', refreshToken: 'stale-refresh' }))
  assert.equal((await result)[0].reason.name, 'RequestCancelledError')
  assert.equal(h.storage.get(a.keys.ACCESS_TOKEN), 'new-account')
  assert.equal(callbacks, 0)
})

test('real clients and Auth Stores isolate login, bootstrap, capabilities, expiry and logout', async () => {
  const identity = { a: deferred(), b: deferred() }, meCalls = { a: 0, b: 0 }, redirects = []
  let expireA = false, rotateA = false
  const h = harness(async opts => {
    const id = new URL(opts.url).hostname[0]
    if (opts.url.endsWith('/login')) return response({ token: id + '-login', refreshToken: id + '-login-refresh' })
    if (opts.url.endsWith('/me')) { meCalls[id]++; return identity[id].promise }
    if (opts.url.endsWith('/capabilities')) return response({ permissions: [id + ':read'], enabledModuleIds: [id] })
    if (opts.url.endsWith('/logout')) return response(null)
    if (opts.url.endsWith('/refresh')) return response({ token: id + '-renewed', refreshToken: id + '-rotated' })
    if (id === 'a' && rotateA && opts.header.Authorization === 'Bearer a-old') return response(null, 401)
    if (id === 'a' && expireA) return response(null, 401)
    return response(id)
  })
  function product(id) {
    const a = h.product(id)
    const auth = h.core.createAuthStore({ client: a.client, storage: h.storage, storageKeys: a.keys, onUnauthorized: () => redirects.push(id), api: {
      login: () => a.client.request({ path: '/login', skipAuth: true }),
      logout: () => a.client.request({ path: '/logout', skipAuth: true }),
      getCurrentUser: () => a.client.request({ path: '/me' }),
      getCapabilities: () => a.client.request({ path: '/capabilities' }),
    } })
    auth.setupAuthInterceptor(); auth.setupAuthInterceptor()
    return { ...a, auth, store: auth.useAuthStore }
  }
  const a = product('a'), b = product('b')
  const aBootstrap = a.store.getState().bootstrap()
  assert.equal(a.store.getState().bootstrap(), aBootstrap)
  const bBootstrap = b.store.getState().bootstrap()
  await turn()
  identity.a.resolve(response({ id: 'a' }))
  await aBootstrap
  assert.equal(b.store.getState().user, null)
  identity.b.resolve(response({ id: 'b' }))
  await bBootstrap
  assert.deepEqual(meCalls, { a: 1, b: 1 })
  assert.deepEqual(a.store.getState().user.permissions, ['a:read'])
  assert.deepEqual(b.store.getState().enabledModuleIds, ['b'])
  rotateA = true
  assert.equal(await a.client.request({ path: '/private' }), 'a')
  assert.equal(a.store.getState().token, 'a-renewed')
  assert.equal(b.store.getState().token, 'b-old')
  await b.store.getState().logout()
  assert.equal(a.store.getState().token, 'a-renewed')
  const aLogin = a.store.getState().login({ username: 'a' })
  await a.store.getState().login({ username: 'a' })
  await aLogin
  assert.equal(a.store.getState().token, 'a-login')
  assert.equal(b.store.getState().token, null)
  await b.store.getState().login({ username: 'b' })
  expireA = true
  await assert.rejects(a.client.request({ path: '/private', skipRefresh: true }), { name: 'UnauthorizedError' })
  assert.equal(a.store.getState().token, null)
  assert.equal(b.store.getState().token, 'b-login')
  assert.deepEqual(redirects, ['a'])
})

test('late identity and HTTP 401 from an old account cannot overwrite a newer login', async () => {
  const oldIdentity = deferred(), oldRequest = deferred()
  let current = 'old'
  const h = harness(async opts => {
    if (opts.url.endsWith('/login')) { current = 'new'; return response({ token: 'new-token', refreshToken: 'new-refresh' }) }
    if (opts.url.endsWith('/me')) return current === 'old' ? oldIdentity.promise : response({ id: 'new' })
    if (opts.url.endsWith('/capabilities')) return response({ permissions: [current + ':read'], enabledModuleIds: [current] })
    return oldRequest.promise
  })
  const a = h.product('a')
  const auth = h.core.createAuthStore({ client: a.client, storage: h.storage, storageKeys: a.keys, onUnauthorized() { throw Error('stale requests must not redirect') }, api: {
    login: () => a.client.request({ path: '/login', skipAuth: true }), logout: async () => null,
    getCurrentUser: () => a.client.request({ path: '/me' }), getCapabilities: () => a.client.request({ path: '/capabilities' }),
  } })
  auth.setupAuthInterceptor()
  const bootstrap = auth.useAuthStore.getState().bootstrap()
  const settled = Promise.allSettled([a.client.request({ path: '/late' })])
  await turn()
  await auth.useAuthStore.getState().login({ username: 'new' })
  oldIdentity.resolve(response({ id: 'old' }))
  oldRequest.resolve(response(null, 401))
  await bootstrap
  assert.equal((await settled)[0].reason.name, 'RequestCancelledError')
  assert.equal(auth.useAuthStore.getState().user.id, 'new')
  assert.deepEqual(auth.useAuthStore.getState().user.permissions, ['new:read'])
  assert.equal(h.storage.get(a.keys.ACCESS_TOKEN), 'new-token')
})

test('one product refresh rejection clears its own session once without interrupting another refresh', async () => {
  const flights = { a: deferred(), b: deferred() }, redirects = []
  const h = harness(async opts => {
    const id = new URL(opts.url).hostname[0]
    if (opts.url.endsWith('/refresh')) return flights[id].promise
    return opts.header.Authorization.endsWith('-old') ? response(null, 401) : response(id)
  })
  const a = h.product('a'), b = h.product('b')
  a.client.setUnauthorizedHandler(() => redirects.push('a'))
  b.client.setUnauthorizedHandler(() => redirects.push('b'))
  const failed = Promise.allSettled([a.client.request({ path: '/one' }), a.client.request({ path: '/two' })])
  const successful = b.client.request({ path: '/one' })
  await turn()
  flights.a.resolve(response(null, 401))
  assert.ok((await failed).every(item => item.reason.name === 'UnauthorizedError'))
  assert.equal(h.storage.get(a.keys.ACCESS_TOKEN), null)
  assert.equal(h.storage.get(b.keys.ACCESS_TOKEN), 'b-old')
  assert.deepEqual(redirects, ['a'])
  flights.b.resolve(response({ token: 'b-new', refreshToken: 'b-rotated' }))
  assert.equal(await successful, 'b')
  assert.equal(h.storage.get(b.keys.ACCESS_TOKEN), 'b-new')
})
