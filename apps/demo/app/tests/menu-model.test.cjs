const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTs } = require('./helpers/load-ts.cjs')

// 权限态放在可变对象里：确认弹窗是异步的，测试需要在确认「过程中」撤销权限，
// 用闭包捕获的常量做不到这一点。
function loadModel({ onConfirm, session = { value: 1 }, deletes = [], allowed = { value: true } } = {}) {
  return loadTs('src/pages/system/menu/model.ts', {
    '@/api/client': { getSessionVersion: () => session.value },
    '@/utils/auth-guard': { canWriteModuleNow: () => allowed.value },
    '@/hooks': { confirmAction: onConfirm ?? (async () => true) },
    '@/api/admin/menu': {
      deleteAdminMenu: async (id) => {
        deletes.push(id)
      },
    },
  })
}

const base = {
  name: '用户管理',
  type: 1,
  path: '/system/user',
  icon: '',
  component: './system/user',
  status: '1',
  sort: '10',
  hideInMenu: false,
  isDefaultAction: false,
  isExternalLink: false,
  keepAlive: false,
  permissionCodes: ['system:user:list'],
}

test('保存载荷去空格并把排序转成数字', () => {
  const { menuPayload } = loadModel()
  const payload = menuPayload({ ...base, name: '  用户管理  ', sort: '10' })
  assert.equal(payload.name, '用户管理')
  assert.equal(payload.sort_order, 10)
})

test('名称为空时拒绝保存', () => {
  const { menuPayload } = loadModel()
  assert.throws(() => menuPayload({ ...base, name: '   ' }), /请输入菜单名称/)
})

test('排序必须是非负数字', () => {
  const { menuPayload } = loadModel()
  for (const sort of ['', '  ', '-1', 'abc', 'Infinity'])
    assert.throws(() => menuPayload({ ...base, sort }), /排序/)
})

// 目录不需要组件，外链由 path 承担；这两种情况不该逼用户填一个假的组件路径。
test('目录与外链不校验组件路径', () => {
  const { menuPayload } = loadModel()
  assert.doesNotThrow(() => menuPayload({ ...base, type: 0, component: '' }))
  assert.doesNotThrow(() => menuPayload({ ...base, isExternalLink: true, component: '' }))
})

test('页面且非外链时必须给出合法组件路径', () => {
  const { menuPayload } = loadModel()
  assert.throws(() => menuPayload({ ...base, component: '' }), /组件路径/)
  assert.throws(() => menuPayload({ ...base, component: 'system/user' }), /组件路径/)
  assert.equal(menuPayload({ ...base, component: './system/user' }).component, './system/user')
  assert.equal(menuPayload({ ...base, component: '../shared/page' }).component, '../shared/page')
})

// 目录没有「页面默认访问操作」，留着旧值会写进库里变成脏数据。
test('目录强制清空页面默认访问操作', () => {
  const { menuPayload } = loadModel()
  const payload = menuPayload({
    ...base,
    type: 0,
    component: '',
    isDefaultAction: true,
    permissionCodes: ['system:user:list'],
  })
  assert.equal(payload.isDefaultAction, false)
})

// 关联功能由独立页负责；编辑页带着旧值提交会覆盖刚保存的结果。
test('菜单载荷不带 permissionCodes，留给关联功能页单独提交', () => {
  const { menuPayload } = loadModel()
  const payload = menuPayload({ ...base, permissionCodes: ['system:user:list'] })
  assert.equal('permissionCodes' in payload, false)
})

// 页面/按钮的这个字段不在表单里暴露，必须原样带回，否则一次改名就抹掉了。
test('页面原样保留未暴露的页面默认访问操作', () => {
  const { menuPayload } = loadModel()
  const payload = menuPayload({ ...base, type: 1, isDefaultAction: true })
  assert.equal(payload.isDefaultAction, true)
})

test('按钮保留页面默认访问操作', () => {
  const { menuPayload } = loadModel()
  const payload = menuPayload({ ...base, type: 2, isDefaultAction: true })
  assert.equal(payload.isDefaultAction, true)
})

test('删除前确认，确认后权限被回收则不写库', async () => {
  const deletes = []
  const allowed = { value: true }
  const { removeMenu } = loadModel({
    deletes,
    allowed,
    onConfirm: async () => {
      allowed.value = false
      return true
    },
  })
  assert.equal(await removeMenu({ id: 5, name: '用户管理' }), false)
  assert.deepEqual(deletes, [], '权限在确认期间被收回时不应发删除请求')
})

test('删除成功后返回 true', async () => {
  const deletes = []
  const { removeMenu } = loadModel({ deletes })
  assert.equal(await removeMenu({ id: 5, name: '用户管理' }), true)
  assert.deepEqual(deletes, [5])
})

test('取消确认时不写库', async () => {
  const deletes = []
  const { removeMenu } = loadModel({ deletes, onConfirm: async () => false })
  assert.equal(await removeMenu({ id: 5, name: '用户管理' }), false)
  assert.deepEqual(deletes, [])
})
