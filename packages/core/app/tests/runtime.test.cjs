const assert = require('node:assert/strict')
const test = require('node:test')
const { loadSource } = require('./load-source.cjs')

test('storage adapters remain independent and tolerate unavailable platform storage', () => {
  const { createStorage } = loadSource('src/storage/index.ts')
  const firstValues = new Map()
  const secondValues = new Map()
  const adapter = values => ({ getStorageSync: key => values.get(key), setStorageSync: (key, value) => values.set(key, value), removeStorageSync: key => values.delete(key), clearStorageSync: () => values.clear() })
  const first = createStorage(adapter(firstValues))
  const second = createStorage(adapter(secondValues))
  first.set('token', 'one')
  second.set('token', 'two')
  first.clear()
  assert.equal(first.get('token'), null)
  assert.equal(second.get('token'), 'two')
  const unavailable = createStorage({ ...adapter(firstValues), getStorageSync() { throw new Error('unavailable') } })
  assert.equal(unavailable.get('token', 'fallback'), 'fallback')
})

test('auth stores keep identity flights, capabilities and logout local to each product', async () => {
  const { createAuthStore } = loadSource('src/auth/index.ts')
  const keys = { ACCESS_TOKEN: 'token', REFRESH_TOKEN: 'refresh', USER: 'user' }
  function product(id) {
    const values = new Map([['token', `token-${id}`]])
    let version = 0
    const store = createAuthStore({
      storage: { get: key => values.get(key) ?? null, set: (key, value) => values.set(key, value), remove: key => values.delete(key), clear: () => values.clear() },
      storageKeys: keys,
      client: { getSessionVersion: () => version, invalidateSessionRequests: () => { version++ }, setTokenRefreshedHandler() {}, setUnauthorizedHandler() {} },
      api: { login: async () => ({ token: `token-${id}`, expiresIn: 3600 }), logout: async () => null, getCurrentUser: async () => ({ id }), getCapabilities: async () => ({ permissions: [`product:${id}`], enabledModuleIds: [id] }) },
      onUnauthorized() {},
    }).useAuthStore
    return store
  }
  const first = product('first')
  const second = product('second')
  await Promise.all([first.getState().bootstrap(), second.getState().bootstrap()])
  assert.deepEqual(first.getState().user.permissions, ['product:first'])
  assert.deepEqual(second.getState().user.permissions, ['product:second'])
  await first.getState().logout()
  assert.equal(first.getState().user, null)
  assert.equal(second.getState().token, 'token-second')
  assert.equal(second.getState().user.id, 'second')
})

test('environment and route permissions have no shared mutable product configuration', () => {
  const { createMobileEnvironment } = loadSource('src/env/index.ts')
  const { hasRequiredPermissions } = loadSource('src/permissions/index.ts')
  const { normalizePage } = loadSource('src/router/index.ts')
  const first = createMobileEnvironment({ apiBaseUrl: 'https://first.test', mode: 'test' })
  const second = createMobileEnvironment({ apiBaseUrl: '', mode: 'development' })
  assert.equal(first.apiBaseUrl, 'https://first.test')
  assert.equal(second.apiBaseUrl, '')
  assert.ok(Object.isFrozen(first))
  assert.equal(hasRequiredPermissions(['view']), false)
  assert.equal(hasRequiredPermissions(['view', 'edit'], ['view']), false)
  assert.equal(hasRequiredPermissions(['view'], ['view']), true)
  assert.equal(normalizePage('/pages/user/index/?id=1'), 'pages/user/index')
})
