const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTs } = require('./helpers/load-ts.cjs')

// model.ts 依赖运行时模块（删除接口、会话、确认框），纯函数测试用桩隔离 Taro
const loadTodoModel = () => loadTs('src/pages/demo/todos/model.ts', {
  '@/api/client': { getSessionVersion: () => 1 },
  '@/utils/auth-guard': { canWriteModuleNow: () => true },
  '@/hooks': { confirmAction: async () => true },
  '@/api/demo': { deleteTodo: async () => {} },
})

test('demo client uses raw authenticated transport and the actual PATCH contract', async () => {
  const calls = []
  const api = loadTs('src/api/demo.ts', { './client': { requestRaw: async (options) => { calls.push(options); return options.method === 'GET' ? { total: 0, items: [] } : undefined } } })
  await api.listTodos({ page: 2, pageSize: 20, keyword: '会议', status: 1 })
  await api.createTodo({ title: '测试', status: 0 })
  await api.updateTodo(12, { dueAt: null, status: 2 })
  await api.deleteTodo(12)
  await api.getServerInfo()
  assert.deepEqual(calls.map(({ method, path }) => [method, path]), [
    ['GET', '/api/demo/v1/todos'], ['POST', '/api/demo/v1/todos'], ['PATCH', '/api/demo/v1/todos/12'], ['DELETE', '/api/demo/v1/todos/12'], ['GET', '/api/demo/v1/info'],
  ])
  assert.deepEqual(calls[0].query, { page: 2, pageSize: 20, keyword: '会议', status: 1 })
  assert.equal(calls[2].data.dueAt, null)
})

test('todo validation trims titles, rejects invalid calendar dates and clears removed deadlines', () => {
  const { todoPayload } = loadTodoModel()
  assert.deepEqual(todoPayload({ title: '  待办  ', description: '备注', status: '1', hasDue: false, date: '', time: '' }, true), { title: '待办', description: '备注', status: 1, dueAt: null })
  assert.deepEqual(todoPayload({ title: '新增', description: '', status: '0', hasDue: false, date: '', time: '' }, false), { title: '新增', description: '', status: 0 })
  assert.throws(() => todoPayload({ title: ' ', description: '', status: '0', hasDue: false, date: '', time: '' }, false), /标题/)
  assert.throws(() => todoPayload({ title: 'a', description: '', status: '3', hasDue: false, date: '', time: '' }, false), /状态/)
  assert.throws(() => todoPayload({ title: 'a', description: '', status: '0', hasDue: true, date: '2026-02-30', time: '12:00' }, false), /时间/)
  assert.equal(todoPayload({ title: 'a', description: '', status: '2', hasDue: true, date: '2026-10-10', time: '12:30' }, false).dueAt, '2026-10-10T04:30:00.000Z')
  // 开关关闭即清除：即使残留日期也不提交；开关打开但没选日期要报错
  assert.deepEqual(todoPayload({ title: 'a', description: '', status: '0', hasDue: false, date: '2026-10-10', time: '12:30' }, true).dueAt, null)
  assert.throws(() => todoPayload({ title: 'a', description: '', status: '0', hasDue: true, date: '', time: '09:00' }, false), /截止日期/)
})

test('todo form values derive the deadline switch from dueAt', () => {
  const { todoFormValues } = loadTodoModel()
  assert.deepEqual(todoFormValues(), { title: '', description: '', status: '0', hasDue: false, date: '', time: '09:00' })
  assert.deepEqual(todoFormValues({ title: 't', description: 'd', status: 2, dueAt: '2026-10-10T04:30:00.000Z' }), { title: 't', description: 'd', status: '2', hasDue: true, date: '2026-10-10', time: '12:30' })
})

test('todo list query forwards keyword and status codes, omitting empty filters', () => {
  const filters = loadTs('src/pages/demo/todos/filters.ts')
  assert.deepEqual(filters.TODO_STATUS_OPTIONS.map((option) => option.label), ['全部', '待办', '进行中', '已完成'])
  assert.deepEqual(filters.buildTodoQuery(1, 20, '', filters.readTodoFilters({})), { page: 1, pageSize: 20, keyword: undefined, status: undefined })
  assert.deepEqual(filters.buildTodoQuery(3, 20, '周报', filters.readTodoFilters({ status: '0' })), { page: 3, pageSize: 20, keyword: '周报', status: 0 })
  assert.equal(filters.buildTodoQuery(1, 20, '', { status: '9' }).status, undefined)
})

function todoModel(onConfirm) {
  let session = 1
  let writes = 0
  const model = loadTs('src/pages/demo/todos/model.ts', {
    '@/api/client': { getSessionVersion: () => session },
    '@/utils/auth-guard': { canWriteModuleNow: () => true },
    '@/hooks': { confirmAction: async () => onConfirm(() => session++) },
    '@/api/demo': { deleteTodo: async () => { writes++ } },
  })
  return { model, writes: () => writes }
}

test('todo delete requires confirmation and stops when the account changes meanwhile', async () => {
  const declined = todoModel(() => false)
  assert.equal(await declined.model.removeTodo({ id: 1, title: '周报' }), false)
  assert.equal(declined.writes(), 0)
  const switched = todoModel((bump) => { bump(); return true })
  assert.equal(await switched.model.removeTodo({ id: 1, title: '周报' }), false)
  assert.equal(switched.writes(), 0)
  const confirmed = todoModel(() => true)
  assert.equal(await confirmed.model.removeTodo({ id: 1, title: '周报' }), true)
  assert.equal(confirmed.writes(), 1)
})

test('todo status labels and tag variants follow the backend code order', () => {
  const { todoStatusLabel, todoStatusVariant } = loadTodoModel()
  assert.deepEqual([0, 1, 2].map(todoStatusLabel), ['待办', '进行中', '已完成'])
  assert.deepEqual([0, 1, 2].map(todoStatusVariant), ['default', 'primary', 'success'])
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
