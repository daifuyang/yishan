const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTs, deferred } = require('./helpers/load-ts.cjs')

function response(data, statusCode = 200, code = 0) {
  return {
    statusCode,
    data: { success: statusCode < 400, code, message: statusCode < 400 ? 'ok' : 'denied', data },
  }
}
function harness(handler) {
  const values = new Map([
    ['yishan:app:accessToken', 'old'],
    ['yishan:app:refreshToken', 'refresh-old'],
  ])
  const taro = {
    getStorageSync: (key) => values.get(key),
    setStorageSync: (key, value) => values.set(key, value),
    removeStorageSync: (key) => values.delete(key),
    request: handler,
  }
  const client = loadTs('src/api/client.ts', {
    '@tarojs/taro': taro,
    '../config': { API_BASE_URL: '' },
  })
  let clears = 0
  client.setUnauthorizedHandler(() => {
    clears++
    values.clear()
  })
  return { client, values, clears: () => clears }
}

test('concurrent ordinary and paginated requests refresh once and replay with rotated credentials', async () => {
  const refresh = deferred()
  let refreshes = 0
  const h = harness(async (opts) => {
    if (opts.url.endsWith('/refresh')) {
      refreshes++
      return refresh.promise
    }
    if (opts.header.Authorization === 'Bearer old') return response(null, 401, 22004)
    return {
      ...response([1]),
      data: {
        ...response([1]).data,
        pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
      },
    }
  })
  const one = h.client.request({ path: '/one' })
  const two = h.client.requestPaginated({ path: '/two' })
  await new Promise(setImmediate)
  assert.equal(refreshes, 1)
  refresh.resolve(response({ token: 'new', refreshToken: 'refresh-new', expiresIn: 3600 }))
  assert.deepEqual(await one, [1])
  assert.equal((await two).pagination.total, 1)
  assert.equal(h.values.get('yishan:app:refreshToken'), 'refresh-new')
  assert.equal(h.clears(), 0)
})

test('a late 401 from the old access token reuses the new token without a second refresh', async () => {
  const late = deferred()
  let refreshes = 0
  const h = harness(async (opts) => {
    if (opts.url.endsWith('/refresh')) {
      refreshes++
      return response({ token: `new-${refreshes}`, refreshToken: `refresh-${refreshes}` })
    }
    if (opts.header.Authorization === 'Bearer old')
      return opts.url === '/late' ? late.promise : response(null, 401)
    return response('done')
  })
  const pending = h.client.request({ path: '/late' })
  assert.equal(await h.client.request({ path: '/early' }), 'done')
  late.resolve(response(null, 401))
  assert.equal(await pending, 'done')
  assert.equal(refreshes, 1)
})

test('refresh rejection expires the session once for all waiting requests', async () => {
  const refresh = deferred()
  const h = harness(async (opts) =>
    opts.url.endsWith('/refresh') ? refresh.promise : response(null, 401),
  )
  const result = Promise.allSettled([
    h.client.request({ path: '/one' }),
    h.client.request({ path: '/two' }),
  ])
  await new Promise(setImmediate)
  refresh.resolve(response(null, 401, 22006))
  assert.ok((await result).every((item) => item.status === 'rejected'))
  assert.equal(h.clears(), 1)
  assert.equal(h.values.size, 0)
})

test('public login errors do not expire an existing session or trigger refresh', async () => {
  let calls = 0
  const h = harness(async () => {
    calls++
    return response(null, 401, 22007)
  })
  await assert.rejects(h.client.request({ path: '/login', method: 'POST', skipAuth: true }), {
    httpStatus: 401,
  })
  assert.equal(calls, 1)
  assert.equal(h.clears(), 0)
})

test('a forbidden retry after successful refresh preserves the session and original HTTP status', async () => {
  const h = harness(async (opts) =>
    opts.url.endsWith('/refresh')
      ? response({ token: 'new', refreshToken: 'refresh-new' })
      : opts.header.Authorization === 'Bearer old'
        ? response(null, 401)
        : response(null, 403, 22002),
  )
  await assert.rejects(h.client.request({ path: '/private' }), { httpStatus: 403, code: 22002 })
  assert.equal(h.clears(), 0)
})

test('an in-flight refresh cannot restore tokens after the session is cleared', async () => {
  const refresh = deferred()
  const h = harness(async (opts) =>
    opts.url.endsWith('/refresh') ? refresh.promise : response(null, 401),
  )
  const pending = h.client.request({ path: '/private' })
  const settled = Promise.allSettled([pending])
  await new Promise(setImmediate)
  h.client.invalidateSessionRequests()
  h.values.clear()
  refresh.resolve(response({ token: 'stale', refreshToken: 'stale-refresh' }))
  assert.equal((await settled)[0].status, 'rejected')
  assert.equal(h.values.size, 0)
})

test('an expired business code on HTTP 200 refreshes, while a network failure preserves the session', async () => {
  const h = harness(async (opts) => {
    if (opts.url.endsWith('/refresh'))
      return response({ token: 'new', refreshToken: 'new-refresh' })
    if (opts.url === '/network') throw { errMsg: 'request:fail timeout' }
    if (opts.header.Authorization === 'Bearer old')
      return { statusCode: 200, data: { success: false, code: 22004, message: 'expired' } }
    return response(42)
  })
  assert.equal(await h.client.request({ path: '/private' }), 42)
  await assert.rejects(h.client.request({ path: '/network' }), { httpStatus: 0 })
  assert.equal(h.clears(), 0)
})

test('logout uses refresh bearer so expired access cannot block server revocation', async () => {
  let options
  const auth = loadTs('src/api/auth.ts', {
    './client': {
      request: async (value) => {
        options = value
      },
    },
  })
  await auth.logout('expired-access', 'valid-refresh')
  assert.equal(options.headers.Authorization, 'Bearer valid-refresh')
  assert.equal(options.skipAuth, true)
})

test('abort signal cancels the platform task and preserves the session', async () => {
  const pending = deferred()
  let aborts = 0
  const task = pending.promise
  task.abort = () => {
    aborts++
    pending.reject(new Error('aborted'))
  }
  const h = harness(() => task)
  const controller = new AbortController()
  const result = h.client.request({ path: '/cancel', signal: controller.signal })
  controller.abort()
  await assert.rejects(result, { code: -3 })
  assert.equal(aborts, 1)
  assert.equal(h.clears(), 0)
})
