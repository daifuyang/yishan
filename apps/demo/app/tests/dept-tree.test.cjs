const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTs } = require('./helpers/load-ts.cjs')

const scssMock = () => new Proxy({}, { get: (_, key) => (key === '__esModule' ? false : key) })

const tree = [
  {
    id: 1,
    name: '上海总公司',
    children: [
      { id: 11, name: '研发部门', children: [{ id: 111, name: '前端组', children: null }] },
      { id: 12, name: '市场部门', children: null },
    ],
  },
  { id: 2, name: '北京分公司', children: null },
]

const {
  childOf,
  findDeptPath,
  flattenDepts,
  searchDepts,
  hasChildren,
} = loadTs('src/components/management/deptTree.ts')

test('hasChildren 把 children: null 视为叶子', () => {
  assert.equal(hasChildren(tree[1]), false)
  assert.equal(hasChildren(tree[0]), true)
})

test('childOf 根层返回原数组，null 输入返回空数组', () => {
  assert.equal(childOf(tree, null).length, 2)
  assert.deepEqual(childOf(null, null), [])
  assert.deepEqual(childOf(undefined, 1), [])
})

test('childOf 按 id 返回子节点，children: null 时返回空数组', () => {
  assert.deepEqual(
    childOf(tree, 1).map((n) => n.id),
    [11, 12],
  )
  assert.deepEqual(childOf(tree, 2), [])
})

test('findDeptPath 返回从根到目标节点的路径名', () => {
  assert.deepEqual(findDeptPath(tree, 111), [
    { id: 1, name: '上海总公司' },
    { id: 11, name: '研发部门' },
    { id: 111, name: '前端组' },
  ])
})

test('findDeptPath 找不到时返回空数组', () => {
  assert.deepEqual(findDeptPath(tree, 999), [])
  assert.deepEqual(findDeptPath(null, 1), [])
})

test('flattenDepts 深度优先展平且带完整路径', () => {
  const flat = flattenDepts(tree)
  assert.deepEqual(
    flat.map((f) => f.node.id),
    [1, 11, 111, 12, 2],
  )
  assert.deepEqual(
    flat[2].path.map((p) => p.name),
    ['上海总公司', '研发部门', '前端组'],
  )
})

test('flattenDepts 对空树返回空数组', () => {
  assert.deepEqual(flattenDepts(null), [])
})

test('searchDepts 按名称子串匹配并保留路径', () => {
  const hits = searchDepts(tree, '研发')
  assert.deepEqual(
    hits.map((h) => h.node.id),
    [11],
  )
  assert.deepEqual(
    hits[0].path.map((p) => p.name),
    ['上海总公司', '研发部门'],
  )
})

test('searchDepts 关键词为空或无匹配时返回空数组', () => {
  assert.deepEqual(searchDepts(tree, ''), [])
  assert.deepEqual(searchDepts(tree, '   '), [])
  assert.deepEqual(searchDepts(tree, '不存在'), [])
})

// ---- 导航器渲染 ----

const { DepartmentTreeNavigator } = loadTs('src/components/management/DepartmentTreeNavigator.tsx', {
  '@tarojs/components': { View: 'View', Text: 'Text' },
  './LineIcon': { LineIcon: 'LineIcon' },
  './DepartmentTreeNavigator.module.scss': scssMock(),
  './deptTree': loadTs('src/components/management/deptTree.ts'),
})

function find(node, pred, out = []) {
  if (Array.isArray(node)) {
    node.forEach((n) => find(n, pred, out))
    return out
  }
  if (!node || typeof node === 'string' || typeof node === 'number') return out
  if (pred(node)) out.push(node)
  find(node.props?.children, pred, out)
  return out
}

function text(node) {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (!node) return ''
  if (Array.isArray(node)) return node.map(text).join('')
  if (typeof node.type === 'function') return text(node.type(node.props))
  return text(node.props?.children)
}

test('面包屑渲染路径各级并可回跳', () => {
  let crumbIndex = null
  const t = DepartmentTreeNavigator({
    nodes: tree[0].children,
    path: [
      { id: 1, name: '上海总公司' },
      { id: 11, name: '研发部门' },
    ],
    selectedIds: new Set(),
    onEnter: () => {},
    onToggle: () => {},
    onCrumb: (i) => (crumbIndex = i),
  })
  assert.match(text(t), /上海总公司/)
  assert.match(text(t), /研发部门/)
  const crumbs = find(
    t,
    (n) => typeof n.props?.['aria-label'] === 'string' && n.props['aria-label'].startsWith('面包屑'),
  )
  assert.equal(crumbs.length, 2)
  crumbs[0].props.onClick()
  assert.equal(crumbIndex, 0)
})

test('有子节点的行触发 onEnter 而非 onToggle', () => {
  let entered = null
  let toggled = null
  const t = DepartmentTreeNavigator({
    nodes: tree[0].children,
    path: [{ id: 1, name: '上海总公司' }],
    selectedIds: new Set(),
    onEnter: (n) => (entered = n.id),
    onToggle: (id) => (toggled = id),
    onCrumb: () => {},
  })
  const row = find(t, (n) => n.props?.['aria-label'] === '部门-研发部门')[0]
  row.props.onClick()
  assert.equal(entered, 11)
  assert.equal(toggled, null)
})

test('叶子节点的行触发 onToggle', () => {
  let entered = null
  let toggled = null
  const t = DepartmentTreeNavigator({
    nodes: tree[0].children,
    path: [{ id: 1, name: '上海总公司' }],
    selectedIds: new Set(),
    onEnter: (n) => (entered = n.id),
    onToggle: (id) => (toggled = id),
    onCrumb: () => {},
  })
  find(t, (n) => n.props?.['aria-label'] === '部门-市场部门')[0].props.onClick()
  assert.equal(toggled, 12)
  assert.equal(entered, null)
})

test('已选中的节点渲染 checked 状态', () => {
  const t = DepartmentTreeNavigator({
    nodes: tree[0].children,
    path: [{ id: 1, name: '上海总公司' }],
    selectedIds: new Set([12]),
    onEnter: () => {},
    onToggle: () => {},
    onCrumb: () => {},
  })
  assert.equal(find(t, (n) => n.props?.['aria-checked'] === true).length, 1)
  assert.equal(
    find(t, (n) => n.props?.['aria-label'] === '勾选-市场部门')[0].props['aria-checked'],
    true,
  )
})

test('任意层级均可选中：勾选分支节点只触发 onToggle 且阻止冒泡', () => {
  let entered = null
  let toggled = null
  const t = DepartmentTreeNavigator({
    nodes: tree[0].children,
    path: [{ id: 1, name: '上海总公司' }],
    selectedIds: new Set(),
    onEnter: (n) => (entered = n.id),
    onToggle: (id) => (toggled = id),
    onCrumb: () => {},
  })
  const stopped = []
  find(t, (n) => n.props?.['aria-label'] === '勾选-研发部门')[0].props.onClick({
    stopPropagation: () => stopped.push(true),
  })
  assert.equal(toggled, 11)
  assert.equal(entered, null)
  assert.equal(stopped.length, 1, 'checkbox 点击必须阻止冒泡，否则会连带进入层级')
})

test('父部门自身也可被勾选（能力保持，非仅叶子可选）', () => {
  let toggled = null
  const t = DepartmentTreeNavigator({
    nodes: tree,
    path: [],
    selectedIds: new Set(),
    onEnter: () => {},
    onToggle: (id) => (toggled = id),
    onCrumb: () => {},
  })
  find(t, (n) => n.props?.['aria-label'] === '勾选-上海总公司')[0].props.onClick({
    stopPropagation: () => {},
  })
  assert.equal(toggled, 1)
})

test('readonly 模式下 checkbox 不可点击且不渲染 checked', () => {
  let toggled = null
  const t = DepartmentTreeNavigator({
    nodes: tree[0].children,
    path: [{ id: 1, name: '上海总公司' }],
    selectedIds: new Set(),
    readonly: true,
    onEnter: () => {},
    onToggle: (id) => (toggled = id),
    onCrumb: () => {},
  })
  assert.equal(find(t, (n) => n.props?.['aria-checked'] !== undefined).length, 0)
  assert.equal(find(t, (n) => n.props?.['aria-label'] === '勾选-市场部门')[0].props.onClick, undefined)
  assert.equal(toggled, null)
})

test('highlightId 对应行带高亮类名', () => {
  const t = DepartmentTreeNavigator({
    nodes: tree[0].children,
    path: [{ id: 1, name: '上海总公司' }],
    selectedIds: new Set(),
    highlightId: 12,
    onEnter: () => {},
    onToggle: () => {},
    onCrumb: () => {},
  })
  assert.equal(find(t, (n) => String(n.props?.className ?? '').includes('treeRow--highlight')).length, 1)
})

test('当前层为空时渲染空态文案', () => {
  const t = DepartmentTreeNavigator({
    nodes: [],
    path: [{ id: 2, name: '北京分公司' }],
    selectedIds: new Set(),
    onEnter: () => {},
    onToggle: () => {},
    onCrumb: () => {},
  })
  assert.match(text(t), /没有下级部门/)
})