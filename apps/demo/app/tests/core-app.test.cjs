const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTs } = require('./helpers/load-ts.cjs')

test('separate product clients keep their URLs, session versions and token stores independent', async () => {
  const seen = []
  const core = loadTs(require.resolve('@yishan/core-app/request'), {
    '@tarojs/taro': {
      request: async (options) => {
        seen.push(options)
        return { statusCode: 200, data: { success: true, code: 200, message: 'OK', data: options.url } }
      },
    },
  })
  assert.equal(typeof core.createApiClient, 'function', 'Core must expose an instance factory')
  const storageKeys = { ACCESS_TOKEN: 'access', REFRESH_TOKEN: 'refresh', USER: 'user' }
  function product(baseUrl, token) {
    const values = new Map([['access', token]])
    const storage = { get: (key) => values.get(key) ?? null, set: (key, value) => values.set(key, value), remove: (key) => values.delete(key), clear: () => values.clear() }
    return core.createApiClient({ baseUrl, storage, storageKeys, refreshPath: '/session/refresh' })
  }
  const first = product('https://first.example.test', 'first-token')
  const second = product('https://second.example.test', 'second-token')
  assert.equal(await first.request({ path: '/items' }), 'https://first.example.test/items')
  assert.equal(await second.request({ path: '/items' }), 'https://second.example.test/items')
  assert.equal(seen[0].header.Authorization, 'Bearer first-token')
  assert.equal(seen[1].header.Authorization, 'Bearer second-token')
  first.invalidateSessionRequests()
  assert.equal(first.getSessionVersion(), 1)
  assert.equal(second.getSessionVersion(), 0)
})

test('product storage reads the live Taro API after platform initialization', () => {
  let platform = {}
  const taro = { __esModule: true, get default() { return platform } }
  const { storage } = loadTs('src/utils/storage.ts', { '@tarojs/taro': taro })
  const values = new Map()
  platform = { getStorageSync: key => values.get(key) ?? '', setStorageSync: (key,value) => values.set(key,value), removeStorageSync: key => values.delete(key), clearStorageSync: () => values.clear() }
  storage.set('session', 'token')
  assert.equal(storage.get('session'), 'token')
  storage.remove('session')
  assert.equal(storage.get('session'), null)
})
