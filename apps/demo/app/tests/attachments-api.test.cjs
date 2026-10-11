const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTs } = require('./helpers/load-ts.cjs')

function fixture({ upload, version = () => 0 } = {}) {
  const calls = []
  const client = { request: async (o) => { calls.push(o); return null }, requestPaginated: async (o) => { calls.push(o); return { data: [], pagination: { total: 0 } } }, getSessionVersion: version }
  const api = loadTs('src/api/admin/attachments.ts', {
    '../client': client,
    '@tarojs/taro': { uploadFile: upload || (async () => ({ statusCode: 200, data: JSON.stringify({ success: true, data: [{ id: 5 }] }) })) },
    '@/config': { API_BASE_URL: 'https://api.example.test' },
    '@/utils/storage': { storage: { get: () => 'token' }, STORAGE_KEYS: { ACCESS_TOKEN: 'access' } },
  })
  return { api, calls }
}

test('media list filters and folder move retain server field names and null semantics', async () => {
  const { api, calls } = fixture()
  await api.listAttachments({ page: 2, pageSize: 10, kind: 'audio', folderId: 4, status: '0' })
  assert.equal(calls[0].path, '/api/v1/admin/attachments/')
  assert.equal(calls[0].query.folderId, 4)
  await api.updateAttachment(8, { folderId: null, status: '1' })
  assert.deepEqual(calls[1].data, { folderId: null, status: '1' })
})

test('multipart upload authenticates and puts folder/type in query, not form fields', async () => {
  let received
  const { api } = fixture({ upload: async (options) => { received = options; return { statusCode: 200, data: '{"success":true,"data":[{"id":5}]}' } } })
  assert.deepEqual(await api.uploadAttachment({ path: 'temp.png', name: 'image.png', size: 20, mimeType: 'image/png' }, { folderId: 3, kind: 'image' }), [{ id: 5 }])
  assert.equal(received.header.Authorization, 'Bearer token')
  assert.equal(received.name, 'file')
  assert.equal(received.header['Content-Type'], undefined)
  assert.match(received.url, /folderId=3&kind=image/)
})

test('upload rejects stale session result and failed server envelope', async () => {
  let generation = 0
  const stale = fixture({ version: () => generation, upload: async () => { generation++; return { statusCode: 200, data: '{"success":true,"data":[]}' } } })
  await assert.rejects(stale.api.uploadAttachment({ path: 'temp', name: 'file', size: 1, mimeType: 'application/octet-stream' }, {}), /会话/)
  const failed = fixture({ upload: async () => ({ statusCode: 400, data: '{"success":false,"message":"文件过大"}' }) })
  await assert.rejects(failed.api.uploadAttachment({ path: 'temp', name: 'file', size: 1, mimeType: 'application/octet-stream' }, {}), /文件过大/)
})

test('public attachment URLs resolve local paths and qiniu object keys without accepting script schemes', () => {
  const { api } = fixture()
  assert.equal(api.attachmentUrl({ path: '/uploads/a.png', storage: 'local' }), 'https://api.example.test/uploads/a.png')
  assert.equal(api.attachmentUrl({ objectKey: 'files/a.png', storage: 'qiniu' }, 'cdn.example.test'), 'https://cdn.example.test/files/a.png')
  assert.equal(api.attachmentUrl({ url: 'javascript:bad', storage: 'local' }), '')
})

test('folder parent options exclude own subtree to prevent cycles', () => {
  const { api } = fixture()
  const folders = [{ id: 1, name: 'A', children: [{ id: 2, name: 'B' }] }, { id: 3, name: 'C' }]
  assert.deepEqual(api.folderOptions(folders, 1).map((item) => item.value), ['0', '3'])
})

test('HTTP 401 multipart response refreshes through authenticated client even without JSON', async () => {
  let attempts = 0
  const { api, calls } = fixture({ upload: async () => ++attempts === 1 ? { statusCode: 401, data: 'Unauthorized' } : { statusCode: 200, data: '{"success":true,"data":[]}' } })
  await api.uploadAttachment({ path: 'file', name: 'file.pdf', size: 1, mimeType: 'application/pdf' }, {})
  assert.equal(attempts, 2)
  assert.equal(calls.filter((call) => call.path === '/api/v1/app/auth/me').length, 2)
})
