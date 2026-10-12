const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTs } = require('./helpers/load-ts.cjs')

const filters = loadTs('src/pages/system/menu/filters.ts')

const TREE = [
  {
    id: 1,
    name: '系统管理',
    type: 0,
    status: '1',
    children: [
      { id: 11, name: '用户管理', type: 1, status: '1', children: [{ id: 111, name: '新增用户', type: 2, status: '0' }] },
      { id: 12, name: '角色管理', type: 1, status: '0', children: [] },
    ],
  },
  { id: 2, name: 'CRM', type: 0, status: '0', children: [] },
]

const ALL = { type: '', status: '' }
const names = (tree) => tree.map((n) => n.name)

test('无筛选时原样返回', () => {
  assert.deepEqual(names(filters.filterMenuTree(TREE, ALL)), ['系统管理', 'CRM'])
})

// 筛掉父级却不保留命中子节点的祖先链，会让子节点变成看不见的孤儿。
test('按类型筛选保留命中节点的祖先链', () => {
  const found = filters.filterMenuTree(TREE, { ...ALL, type: '2' })
  assert.deepEqual(names(found), ['系统管理'])
  assert.deepEqual(names(found[0].children), ['用户管理'])
  assert.deepEqual(names(found[0].children[0].children), ['新增用户'])
})

test('按状态筛选保留命中节点的祖先链', () => {
  const found = filters.filterMenuTree(TREE, { ...ALL, status: '0' })
  assert.deepEqual(names(found), ['系统管理', 'CRM'])
  // 系统管理自身是启用，但它的孙节点「新增用户」是禁用，祖先链必须保留，
  // 否则命中的节点挂不到任何位置下。角色管理本身命中禁用。
  assert.deepEqual(names(found[0].children), ['用户管理', '角色管理'])
  assert.deepEqual(names(found[0].children[0].children), ['新增用户'])
})

test('筛选不改动原树', () => {
  const snapshot = JSON.stringify(TREE)
  filters.filterMenuTree(TREE, { type: '2', status: '' })
  assert.equal(JSON.stringify(TREE), snapshot)
})

test('关键词同时匹配名称、路由路径与组件路径', () => {
  assert.equal(filters.menuMatches({ name: '用户管理', path: '/system/user', component: './system/user' }, '用户'), true)
  assert.equal(filters.menuMatches({ name: '用户管理', path: '/system/user', component: './system/user' }, 'system'), true)
  assert.equal(filters.menuMatches({ name: '用户管理', path: '/system/user', component: './system/user' }, '不存在'), false)
})

test('空字段不影响匹配，也不报错', () => {
  assert.equal(filters.menuMatches({ name: '菜单', path: '', component: '' }, '菜单'), true)
})

test('按钮类型不能挂下级', () => {
  assert.equal(filters.menuCanHaveChildren(2), false)
  assert.equal(filters.menuCanHaveChildren(0), true)
  assert.equal(filters.menuCanHaveChildren(1), true)
})
