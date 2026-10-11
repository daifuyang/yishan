const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTs } = require('./helpers/load-ts.cjs')

test('demo client uses raw authenticated transport and the actual PATCH contract', async () => {
  const calls = []
  const api = loadTs('src/api/demo.ts', { './client': { requestRaw: async (options) => { calls.push(options); return options.method === 'GET' ? { total: 0, items: [] } : undefined } } })
  await api.listTodos()
  await api.createTodo({ title: '测试', status: 0 })
  await api.updateTodo(12, { dueAt: null, status: 2 })
  await api.deleteTodo(12)
  await api.getServerInfo()
  assert.deepEqual(calls.map(({ method, path }) => [method, path]), [
    ['GET', '/api/demo/v1/todos'], ['POST', '/api/demo/v1/todos'], ['PATCH', '/api/demo/v1/todos/12'], ['DELETE', '/api/demo/v1/todos/12'], ['GET', '/api/demo/v1/info'],
  ])
  assert.equal(calls[2].data.dueAt, null)
})

test('todo validation trims titles, rejects invalid calendar dates and clears removed deadlines', () => {
  const { todoPayload } = loadTs('src/pages/demo/todos/model.ts')
  assert.deepEqual(todoPayload({ title: '  待办  ', description: '备注', status: '1', date: '', time: '' }, true), { title: '待办', description: '备注', status: 1, dueAt: null })
  assert.deepEqual(todoPayload({ title: '新增', description: '', status: '0', date: '', time: '' }, false), { title: '新增', description: '', status: 0 })
  assert.throws(() => todoPayload({ title: ' ', description: '', status: '0', date: '', time: '' }, false), /标题/)
  assert.throws(() => todoPayload({ title: 'a', description: '', status: '3', date: '', time: '' }, false), /状态/)
  assert.throws(() => todoPayload({ title: 'a', description: '', status: '0', date: '2026-02-30', time: '12:00' }, false), /时间/)
  assert.equal(todoPayload({ title: 'a', description: '', status: '2', date: '2026-10-10', time: '12:30' }, false).dueAt, '2026-10-10T04:30:00.000Z')
})

test('demo workbench entries require installed enabled module, real permissions and authorized page', () => {
  const registry = loadTs('src/modules/registry.ts')
  const menus = [{ id: 10, type: 0, status: '1', name: '示例插件', moduleId: 'demo', sortOrder: 10, children: [{ id: 11, parentId: 10, type: 1, status: '1', name: 'Todo 示例', moduleId: 'demo', sortOrder: 1, page: 'pages/demo/todos/index' }] }]
  assert.deepEqual(registry.getAuthorizedMobileModules(menus, ['demo:todos:list'], ['demo']).map((item) => item.id), ['demo-todos'])
  assert.deepEqual(registry.getAuthorizedMobileModules(menus, ['demo:todos:list'], []), [])
  assert.deepEqual(registry.getAuthorizedMobileModules(menus, [], ['demo']), [])
})

test('system region and site entries use current backend permission codes', () => {
  const registry = loadTs('src/modules/registry.ts')
  assert.deepEqual(registry.getMobileModuleById('system-region').permissions, ['region:tree'])
  assert.deepEqual(registry.getMobileModuleById('system-site').permissions, ['system:option:list'])
})
