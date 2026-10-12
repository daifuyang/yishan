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

test('childOf 能取到非根节点的直接子节点', () => {
  assert.deepEqual(
    childOf(tree, 11).map((n) => n.id),
    [111],
  )
  assert.deepEqual(childOf(tree, 999), [])
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
  './Checkbox.module.scss': scssMock(),
  './deptTree': loadTs('src/components/management/deptTree.ts'),
})

function find(node, pred, out = []) {
  if (Array.isArray(node)) {
    node.forEach((n) => {
      find(n, pred, out)
    })
    return out
  }
  if (!node || typeof node === 'string' || typeof node === 'number') return out
  if (pred(node)) out.push(node)
  find(node.props?.children, pred, out)
  return out
}

function render(node) {
  return typeof node.type === 'function' ? node.type(node.props) : node
}

function text(node) {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (!node) return ''
  if (Array.isArray(node)) return node.map(text).join('')
  if (typeof node.type === 'function') return text(node.type(node.props))
  return text(node.props?.children)
}

function treeProps(overrides = {}) {
  return {
    nodes: tree,
    expandedIds: new Set([1, 11]),
    selectedIds: new Set(),
    onToggleExpand: () => {},
    onToggle: () => {},
    ...overrides,
  }
}

test('展开祖先后渲染最子级，并按层级缩进', () => {
  const t = DepartmentTreeNavigator(treeProps())
  assert.match(text(t), /前端组/)
  const leaf = find(t, (n) => n.props?.['aria-label'] === '部门-前端组')[0]
  // 16px 行内边距 + 2 层 * 14px
  assert.equal(leaf.props.style.paddingLeft, '44px')
  const mid = find(t, (n) => n.props?.['aria-label'] === '部门-研发部门')[0]
  assert.equal(mid.props.style.paddingLeft, '30px')
})

test('折叠父节点时不渲染其子孙', () => {
  const t = DepartmentTreeNavigator(treeProps({ expandedIds: new Set([1]) }))
  assert.match(text(t), /研发部门/)
  assert.doesNotMatch(text(t), /前端组/)
})

test('展开箭头只切换展开态并阻止冒泡', () => {
  let expanded = null
  let toggled = null
  const t = DepartmentTreeNavigator(
    treeProps({
      expandedIds: new Set([1]),
      onToggleExpand: (id) => (expanded = id),
      onToggle: (id) => (toggled = id),
    }),
  )
  const stopped = []
  find(t, (n) => n.props?.['aria-label'] === '展开-研发部门')[0].props.onClick({
    stopPropagation: () => stopped.push(true),
  })
  assert.equal(expanded, 11)
  assert.equal(toggled, null)
  assert.equal(stopped.length, 1)
})

test('行点击选中该部门，叶子和分支都一样', () => {
  let toggled = null
  const t = DepartmentTreeNavigator(treeProps({ onToggle: (id) => (toggled = id) }))
  find(t, (n) => n.props?.['aria-label'] === '部门-前端组')[0].props.onClick()
  assert.equal(toggled, 111)
  find(t, (n) => n.props?.['aria-label'] === '部门-研发部门')[0].props.onClick()
  assert.equal(toggled, 11)
})

test('已选中的节点渲染 checked 状态', () => {
  const t = DepartmentTreeNavigator(treeProps({ selectedIds: new Set([111]) }))
  const box = render(find(t, (n) => n.props?.['aria-label'] === '勾选-前端组')[0])
  assert.equal(box.props['aria-checked'], true)
})

test('勾选分支节点只触发 onToggle 且阻止冒泡', () => {
  let toggled = null
  const t = DepartmentTreeNavigator(treeProps({ onToggle: (id) => (toggled = id) }))
  const stopped = []
  const box = render(find(t, (n) => n.props?.['aria-label'] === '勾选-研发部门')[0])
  box.props.onClick({ stopPropagation: () => stopped.push(true) })
  assert.equal(toggled, 11)
  assert.equal(stopped.length, 1)
})

test('父部门自身也可被勾选', () => {
  let toggled = null
  const t = DepartmentTreeNavigator(treeProps({ onToggle: (id) => (toggled = id) }))
  find(t, (n) => n.props?.['aria-label'] === '勾选-上海总公司')[0].props.onClick({
    stopPropagation: () => {},
  })
  assert.equal(toggled, 1)
})

test('readonly 模式下 checkbox 不可点击且不渲染 checked', () => {
  let toggled = null
  const t = DepartmentTreeNavigator(
    treeProps({
      nodes: tree[0].children,
      readonly: true,
      onToggle: (id) => (toggled = id),
    }),
  )
  const box = render(find(t, (n) => n.props?.['aria-label'] === '勾选-市场部门')[0])
  assert.equal(box.props['aria-checked'], undefined, '只读态不应暴露 checked 语义')
  assert.equal(box.props.onClick, undefined, '只读态 checkbox 不可点')
  assert.equal(toggled, null)
})

test('highlightId 对应行带高亮类名', () => {
  const t = DepartmentTreeNavigator(treeProps({ nodes: tree[0].children, highlightId: 12 }))
  assert.equal(find(t, (n) => String(n.props?.className ?? '').includes('treeRow--highlight')).length, 1)
})

test('树为空时渲染空态文案', () => {
  const t = DepartmentTreeNavigator(treeProps({ nodes: [], expandedIds: new Set() }))
  assert.match(text(t), /暂无部门/)
})

test('readonly 模式下点击行不会改变选中', () => {
  let toggled = null
  const t = DepartmentTreeNavigator(
    treeProps({
      readonly: true,
      selectedIds: new Set([111]),
      onToggle: (id) => (toggled = id),
    }),
  )
  const row = find(t, (n) => n.props?.['aria-label'] === '部门-前端组')[0]
  assert.equal(row.props.onClick, undefined, '只读模式行不应绑定 onClick')
  assert.equal(toggled, null)
})

test('readonly 模式下仍可展开收起（只读≠不可浏览）', () => {
  let expanded = null
  const t = DepartmentTreeNavigator(
    treeProps({
      expandedIds: new Set([1]),
      readonly: true,
      onToggleExpand: (id) => (expanded = id),
    }),
  )
  find(t, (n) => n.props?.['aria-label'] === '展开-研发部门')[0].props.onClick({
    stopPropagation: () => {},
  })
  assert.equal(expanded, 11)
  assert.match(text(t), /研发部门/)
  assert.doesNotMatch(text(t), /前端组/)
})
