const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTs } = require('./helpers/load-ts.cjs')

function client(file, result = null) {
  const calls = []
  const request = async (options) => { calls.push(options); return result }
  return { api: loadTs(`src/api/admin/${file}.ts`, { '../client': { request, requestPaginated: request } }), calls }
}

test('region tree uses its read-only admin endpoint', async () => {
  const { api, calls } = client('region')
  await api.getRegionTree()
  assert.deepEqual(calls[0], { path: '/api/v1/admin/system/regions/tree', query: { level: 3 } })
})

test('site save sends only basicConfig and propagates partial batch failure', async () => {
  const { api, calls } = client('site', { updatedCount: 0, results: [{ key: 'basicConfig', success: false, message: '没有权限' }] })
  await assert.rejects(api.saveSiteConfig({ siteName: 'Demo' }), /没有权限/)
  assert.equal(calls[0].path, '/api/v1/admin/system/options/batch')
  assert.equal(calls[0].data[0].key, 'basicConfig')
})

test('storage discards secrets returned by the server and omits blank replacement secrets', async () => {
  const { api } = client('storage')
  const config = { provider: 'aliyunOss', qiniu: { secretKey: 'hidden' }, aliyunOss: { accessKeySecret: 'hidden', bucket: 'b' } }
  const safe = api.sanitizeStorageConfig(config)
  assert.equal(safe.qiniu.secretKey, undefined)
  assert.equal(safe.aliyunOss.accessKeySecret, undefined)
  const payload = api.storageSavePayload({ ...safe, aliyunOss: { ...safe.aliyunOss, accessKeySecret: '' } })
  assert.equal(payload.aliyunOss.accessKeySecret, undefined)
  assert.equal(payload.qiniu, undefined)
})

test('module toggles encode module ids and use the supported toggle contract', async () => {
  const { api, calls } = client('moduleManagement')
  await api.toggleModule('demo/a', false)
  assert.deepEqual(calls[0], { method: 'POST', path: '/api/v1/admin/system/module-management/toggle/demo%2Fa/toggle', data: { enabled: false } })
})

test('storage import rejects invalid providers and keeps only contract fields', () => {
  const { api } = client('storage')
  assert.throws(() => api.parseStorageImport('{"provider":"unknown"}'), /服务商/)
  const parsed = api.parseStorageImport('{"provider":"qiniu","qiniu":{"accessKey":"ak","bucket":"b","region":"z0","secretKey":"new","unrelated":"bad"}}')
  assert.equal(parsed.qiniu.secretKey, 'new')
  assert.equal(parsed.qiniu.unrelated, undefined)
})
