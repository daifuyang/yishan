const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTs } = require('./helpers/load-ts.cjs')

function loadModel({ allowed = { value: true }, onConfirm, deletes = [] } = {}) {
  return loadTs('src/pages/system/app-menu/model.ts', {
    '@/api/client': { getSessionVersion: () => 0 },
    '@/utils/auth-guard': { canWriteModuleNow: () => allowed.value },
    '@/hooks': { confirmAction: onConfirm ?? (async () => true) },
    '@/api/admin/appMenu': {
      deleteAdminAppMenu: async (id) => {
        deletes.push(id)
      },
    },
  })
}

const GROUPS = [
  { id: 1, name: '系统', type: 0 },
  { id: 2, name: '业务', type: 0 },
]

const entry = {
  name: '用户管理',
  type: 1,
  parentId: 1,
  icon: 'user',
  page: 'pages/system/user/index',
  moduleId: 'core',
  status: '1',
  sort: '10',
}

const group = {
  name: '系统',
  type: 0,
  icon: 'apps',
  page: '',
  moduleId: 'core',
  status: '1',
  sort: '',
}

// 表单里没有「所属模块」这一项，但它必须原样带回。
test('分组编辑即使隐藏所属模块也要原样保留 moduleId', () => {
  const { appMenuPayload } = loadModel()
  const payload = appMenuPayload(
    { ...group, name: '演示业务', moduleId: 'demo' },
    GROUPS,
  )
  assert.equal(payload.name, '演示业务')
  assert.equal(payload.moduleId, 'demo')
})

test('分组不带 parentId 与 page', () => {
  const { appMenuPayload } = loadModel()
  const payload = appMenuPayload({ ...group, parentId: 1, page: 'pages/x' }, GROUPS)
  assert.equal(payload.parentId, undefined)
  assert.equal(payload.page, undefined)
})

test('入口必须挂在分组下', () => {
  const { appMenuPayload } = loadModel()
  assert.throws(() => appMenuPayload({ ...entry, parentId: undefined }, GROUPS), /所属分组/)
  // 指向一个不存在的分组同样不行
  assert.throws(() => appMenuPayload({ ...entry, parentId: 99 }, GROUPS), /所属分组/)
  assert.doesNotThrow(() => appMenuPayload(entry, GROUPS))
})

// 入口的 parentId 必须真的指向分组，不能指向另一个入口。
test('入口不能挂在入口下面', () => {
  const { appMenuPayload } = loadModel()
  const tree = [...GROUPS, { id: 9, name: '子入口', type: 1 }]
  assert.throws(() => appMenuPayload({ ...entry, parentId: 9 }, tree), /所属分组/)
})

test('入口页面路径必须是 pages/ 形式', () => {
  const { appMenuPayload } = loadModel()
  assert.throws(() => appMenuPayload({ ...entry, page: 'system/user' }, GROUPS), /页面路径/)
  assert.throws(() => appMenuPayload({ ...entry, page: '' }, GROUPS), /页面路径/)
  assert.equal(appMenuPayload(entry, GROUPS).page, 'pages/system/user/index')
})

// 排序留空表示排在末尾；填 0 会把它顶到最前面，两者不能混同。
test('排序留空表示排在末尾而不是 0', () => {
  const { appMenuPayload } = loadModel()
  assert.equal(appMenuPayload({ ...entry, sort: '' }, GROUPS).sortOrder, undefined)
  assert.equal(appMenuPayload({ ...entry, sort: '0' }, GROUPS).sortOrder, 0)
})

test('排序必须是非负整数', () => {
  const { appMenuPayload } = loadModel()
  assert.throws(() => appMenuPayload({ ...entry, sort: '-1' }, GROUPS), /排序/)
  assert.throws(() => appMenuPayload({ ...entry, sort: '1.5' }, GROUPS), /排序/)
  assert.throws(() => appMenuPayload({ ...entry, sort: 'abc' }, GROUPS), /排序/)
})

test('名称为空时拒绝保存', () => {
  const { appMenuPayload } = loadModel()
  assert.throws(() => appMenuPayload({ ...group, name: '  ' }), /请输入名称/)
})

test('分组候选项排除自己，且只列分组', () => {
  const { appMenuGroupOptions } = loadModel()
  const tree = [...GROUPS, { id: 9, name: '子入口', type: 1 }]
  assert.deepEqual(appMenuGroupOptions(tree), [
    { value: '1', label: '系统' },
    { value: '2', label: '业务' },
  ])
  assert.deepEqual(appMenuGroupOptions(tree, 1), [{ value: '2', label: '业务' }])
})

test('删除前确认，确认后权限被回收则不写库', async () => {
  const deletes = []
  const allowed = { value: true }
  const { removeAppMenu } = loadModel({
    deletes,
    allowed,
    onConfirm: async () => {
      allowed.value = false
      return true
    },
  })
  assert.equal(await removeAppMenu({ id: 3, name: '业务' }), false)
  assert.deepEqual(deletes, [])
})

test('取消确认时不写库', async () => {
  const deletes = []
  const { removeAppMenu } = loadModel({ deletes, onConfirm: async () => false })
  assert.equal(await removeAppMenu({ id: 3, name: '业务' }), false)
  assert.deepEqual(deletes, [])
})
