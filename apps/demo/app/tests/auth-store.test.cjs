const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTs, deferred } = require('./helpers/load-ts.cjs')

function harness(overrides = {}) {
  const values = new Map([
    ['yishan:app:accessToken', 'saved'],
    ['yishan:app:refreshToken', 'saved-refresh'],
    ['yishan:app:user', { id: 99, permissions: ['dangerous:cached'] }],
  ])
  let revision = 0
  let meCalls = 0
  const api = {
    login: async () => ({ token: 'login-token', refreshToken: 'login-refresh', expiresIn: 3600 }),
    logout: async () => null,
    getCurrentUser: async () => {
      meCalls++
      return { id: 2, realName: 'user', accessPath: ['/system/user'] }
    },
    getCapabilities: async () => ({ permissions: ['system:user:list'], enabledModuleIds: ['crm'] }),
    ...overrides,
  }
  const client = {
    getSessionVersion: () => revision,
    invalidateSessionRequests: () => {
      revision++
    },
    setUnauthorizedHandler: () => {},
    setTokenRefreshedHandler: () => {},
    request: async () => null,
  }
  const taro = {
    getStorageSync: (key) => values.get(key),
    setStorageSync: (key, value) => values.set(key, value),
    removeStorageSync: (key) => values.delete(key),
  }
  const { useAuthStore } = loadTs('src/stores/auth.ts', {
    '../api': { authApi: api, ...client },
    '../api/auth': api,
    '../api/client': client,
    '@tarojs/taro': taro,
    '../utils/router': { redirectToLogin() {} },
  })
  return { store: useAuthStore, values, meCalls: () => meCalls }
}

test('restore never trusts stored user permissions and coalesces bootstrap calls', async () => {
  const h = harness()
  assert.equal(h.store.getState().user, null)
  await Promise.all([h.store.getState().bootstrap(), h.store.getState().bootstrap()])
  assert.equal(h.meCalls(), 1)
  assert.equal(h.store.getState().user.id, 2)
  assert.deepEqual(h.store.getState().user.permissions, ['system:user:list'])
  assert.deepEqual(h.store.getState().enabledModuleIds, ['crm'])
})

test('a temporary bootstrap network failure preserves credentials and offers retry', async () => {
  let fail = true
  const h = harness({
    getCurrentUser: async () => {
      if (fail) throw new Error('network')
      return { id: 2 }
    },
  })
  await h.store.getState().bootstrap()
  assert.equal(h.store.getState().token, 'saved')
  assert.equal(h.store.getState().user, null)
  assert.ok(h.store.getState().bootstrapError)
  fail = false
  await h.store.getState().bootstrap(true)
  assert.equal(h.store.getState().bootstrapError, null)
  assert.equal(h.store.getState().user.id, 2)
})

test('failed identity or permissions after login rolls back all session state', async () => {
  const h = harness({
    getCapabilities: async () => {
      throw new Error('capabilities unavailable')
    },
  })
  await assert.rejects(h.store.getState().login({ username: 'a', password: 'b' }))
  assert.equal(h.store.getState().user, null)
  assert.equal(h.store.getState().token, null)
  assert.equal(h.values.has('yishan:app:refreshToken'), false)
})

test('logout clears immediately and a late bootstrap response cannot restore the prior account', async () => {
  const me = deferred()
  const revoke = deferred()
  const h = harness({ getCurrentUser: () => me.promise, logout: () => revoke.promise })
  const restore = h.store.getState().bootstrap()
  const logout = h.store.getState().logout()
  assert.equal(h.store.getState().token, null)
  me.resolve({ id: 7 })
  await restore
  assert.equal(h.store.getState().user, null)
  revoke.resolve(null)
  await logout
  assert.equal(h.store.getState().user, null)
})
