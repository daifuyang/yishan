const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createYishanApi } = require('../dist/index.js')
const { errorHandlerPlugin } = require('../dist/plugins.js')
const { BusinessError } = require('../dist/exceptions/business-error.js')

test('preserves business codes and maps framework, database and unexpected errors', async () => {
  const app = await createYishanApi({ modules: [], context: {}, async setup(router) {
    await router.register(errorHandlerPlugin, { production: true })
    router.get('/business', async () => { throw new BusinessError(22002, 'forbidden', 'detail') })
    router.get('/auth', async () => { throw Object.assign(new Error('unauthorized'), { statusCode: 401 }) })
    router.get('/database', async () => { throw Object.assign(new Error('sensitive sql'), { code: 'ER_PARSE_ERROR' }) })
    router.get('/unexpected', async () => { throw new Error('sensitive internal message') })
  } })
  try {
    for (const [url, status, code, message] of [
      ['/business', 403, 22002, 'forbidden'],
      ['/auth', 401, 22001, 'unauthorized'],
      ['/database', 500, 20002, '数据库操作失败'],
      ['/unexpected', 500, 20001, '服务器内部错误'],
    ]) {
      const response = await app.inject(url)
      assert.equal(response.statusCode, status)
      assert.equal(response.json().code, code)
      assert.equal(response.json().message, message)
      assert.equal(response.json().success, false)
    }
    assert.equal((await app.inject('/business')).json().error, 'detail')
  } finally { await app.close() }
})
