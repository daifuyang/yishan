const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const { loadTs } = require('./helpers/load-ts.cjs')

const tree = loadTs('src/components/management/menuTreeLogic.ts')

// 目录 → 页面 → 按钮，与 sys_menu 的三层结构一致
const TREE = [
  {
    id: 1,
    name: '系统管理',
    type: 0,
    children: [
      { id: 11, name: '用户管理', type: 1, children: [{ id: 111, name: '新增用户', type: 2 }] },
      { id: 12, name: '角色管理', type: 1 },
    ],
  },
  { id: 2, name: 'CRM', type: 0 },
]

const byName = () => (node, needle) => node.name.toLowerCase().includes(needle)

const ALL_EXPANDED = new Set([1, 11])

test('展平：全部展开时按深度输出每一行', () => {
  const rows = tree.flattenTree(TREE, ALL_EXPANDED)
  assert.deepEqual(
    rows.map((r) => [r.node.name, r.depth]),
    [
      ['系统管理', 0],
      ['用户管理', 1],
      ['新增用户', 2],
      ['角色管理', 1],
      ['CRM', 0],
    ],
  )
})

// 展开父节点不等于展开它的子节点：层级折叠必须逐级生效。
test('展平：只展开父节点时，孙节点仍然收起', () => {
  const rows = tree.flattenTree(TREE, new Set([1]))
  assert.deepEqual(rows.map((r) => r.node.name), ['系统管理', '用户管理', '角色管理', 'CRM'])
})

test('展平：折叠的父节点只输出自己，不输出后代', () => {
  const rows = tree.flattenTree(TREE, new Set())
  assert.deepEqual(rows.map((r) => r.node.name), ['系统管理', 'CRM'])
})

test('展平：标记哪些节点还有子节点，供展开箭头使用', () => {
  const rows = tree.flattenTree(TREE, ALL_EXPANDED)
  assert.deepEqual(rows.map((r) => [r.node.name, r.hasChildren]), [
    ['系统管理', true],
    ['用户管理', true],
    ['新增用户', false],
    ['角色管理', false],
    ['CRM', false],
  ])
})

test('展开态只记录真实存在的分支，折叠一个空节点没有意义', () => {
  const rows = tree.flattenTree(TREE, new Set([1, 12, 999]))
  assert.deepEqual(rows.map((r) => [r.node.name, r.expanded]), [
    ['系统管理', true],
    ['用户管理', false],
    ['角色管理', false],
    ['CRM', false],
  ])
})

test('搜索：命中深层节点时保留整条祖先链', () => {
  const found = tree.searchTree(TREE, byName(), '新增')
  assert.deepEqual(found.map((n) => n.name), ['系统管理'])
  assert.deepEqual(found[0].children.map((n) => n.name), ['用户管理'])
  assert.deepEqual(found[0].children[0].children.map((n) => n.name), ['新增用户'])
})

test('搜索：无命中时返回空数组', () => {
  assert.deepEqual(tree.searchTree(TREE, byName(), '不存在的东西'), [])
})

test('搜索：空关键词原样返回，不做任何过滤', () => {
  const found = tree.searchTree(TREE, byName(), '  ')
  assert.deepEqual(found.map((n) => n.name), ['系统管理', 'CRM'])
})

test('搜索：父节点自身命中时保留整棵子树', () => {
  const found = tree.searchTree(TREE, byName(), '角色')
  assert.deepEqual(found.map((n) => n.name), ['系统管理'])
  // 用户管理不匹配，不该被带进来
  assert.deepEqual(found[0].children.map((n) => n.name), ['角色管理'])
})

test('搜索时不改动原树', () => {
  const snapshot = JSON.stringify(TREE)
  tree.searchTree(TREE, byName(), '新增')
  assert.equal(JSON.stringify(TREE), snapshot)
})

test('搜索时列出全部分支 id，供自动展开使用', () => {
  const ids = tree.collectExpandable(TREE)
  assert.deepEqual([...ids].sort((a, b) => a - b), [1, 11])
})

test('toggleExpanded 在展开/折叠之间切换', () => {
  let set = tree.toggleExpanded(new Set(), 1)
  assert.equal(set.has(1), true)
  set = tree.toggleExpanded(set, 1)
  assert.equal(set.has(1), false)
})

test('空树与 null 输入不抛错', () => {
  assert.deepEqual(tree.flattenTree(null, new Set()), [])
  assert.deepEqual(tree.flattenTree(undefined, new Set()), [])
  assert.deepEqual(tree.searchTree(null, byName(), 'x'), [])
  assert.equal(tree.collectExpandable(null).size, 0)
})

// ---- 树形 Cell 的结构约束 ----
const listMod = loadTs('src/components/management/ManagementList.tsx', {
  react: { useMemo: (fn) => fn() },
  '@tarojs/components': { View: 'View', Text: 'Text' },
  '@/components/atoms': { AppText: 'AppText', Avatar: 'Avatar' },
  '@/components/feedback': { StateView: 'StateView' },
  './LineIcon': { LineIcon: 'LineIcon' },
  './ManagementList.module.scss': new Proxy({}, { get: (_, k) => (k === '__esModule' ? false : k) }),
})

function walk(node, pred, out = []) {
  if (!node || typeof node !== 'object') return out
  if (Array.isArray(node)) {
    for (const n of node) walk(n, pred, out)
    return out
  }
  if (pred(node)) out.push(node)
  walk(node.props?.children, pred, out)
  return out
}

test('树形 Cell 按深度缩进，且封顶 4 层', () => {
  const { ManagementTreeCell } = listMod
  assert.equal(ManagementTreeCell({ title: 'A', depth: 0 }).props.style, undefined)
  assert.equal(ManagementTreeCell({ title: 'A', depth: 1 }).props.style.paddingLeft, '14px')
  assert.equal(ManagementTreeCell({ title: 'A', depth: 4 }).props.style.paddingLeft, '56px')
  // 再深也不加缩进，否则深树会把标题挤没
  assert.equal(ManagementTreeCell({ title: 'A', depth: 9 }).props.style.paddingLeft, '56px')
})

// 树天然比平铺列表长，沿用 76px 行高的话一屏只能看三四行。
test('树形行比普通列表行紧凑：行高 48px、图标 16px', () => {
  const css = fs.readFileSync(
    path.resolve(__dirname, '../src/components/management/ManagementList.module.scss'),
    'utf8',
  )
  const row = css.match(/^\.row \{([^}]*)\}/m)[1]
  const tree = css.match(/^\.treeRow \{([^}]*)\}/m)[1]
  assert.match(row, /min-height:\s*76px/, '普通列表行保持 76px')
  assert.match(tree, /min-height:\s*var\(--list-item-height-sm\)/, '树形行应使用 48px 的紧凑行高')
  // 树形行的图标不应再带 44px 圆形底
  assert.doesNotMatch(css, /\.treeRow__glyph \{[^}]*44px/, '树形图标不应沿用 44px 尺寸')
})

test('树形行的标题与次要信息在同一行，不另起一行', () => {
  const { ManagementTreeCell } = listMod
  const tree = ManagementTreeCell({ title: '用户管理', description: '/system/user' })
  const classes = walk(tree, () => true).map((n) => n.props?.className).filter(Boolean)
  assert.ok(classes.includes('treeRow__title'))
  assert.ok(classes.includes('treeRow__description'))
  // 紧凑行里不应出现普通 cell 的两行结构
  assert.ok(!classes.includes('row__description'))
})

test('有子节点才画展开箭头，箭头朝向跟随展开态', () => {
  const { ManagementTreeCell } = listMod
  const collapsed = ManagementTreeCell({ title: 'A', hasChildren: true, expanded: false })
  const expanded = ManagementTreeCell({ title: 'A', hasChildren: true, expanded: true })
  const leaf = ManagementTreeCell({ title: 'A', hasChildren: false })

  const arrowOf = (t) => walk(t, (n) => n.props?.name === 'chevronRight' || n.props?.name === 'chevronDown')
  assert.deepEqual(arrowOf(collapsed).map((n) => n.props.name), ['chevronRight'])
  assert.deepEqual(arrowOf(expanded).map((n) => n.props.name), ['chevronDown'])
  // 叶子不画箭头
  assert.deepEqual(arrowOf(leaf), [])
})

// 箭头与整行点击是两个意图，共用一个点击区会让用户永远点不准。
test('点展开箭头只折叠，不触发进详情', () => {
  const { ManagementTreeCell } = listMod
  let toggled = 0
  let entered = 0
  const tree = ManagementTreeCell({
    title: 'A',
    hasChildren: true,
    onToggle: () => toggled++,
    onClick: () => entered++,
  })
  const toggle = walk(tree, (n) => n.props?.['aria-label'] === '展开')[0]
  assert.ok(toggle, '应有展开箭头')
  let stopped = false
  toggle.props.onClick({ stopPropagation: () => { stopped = true } })
  assert.equal(stopped, true, '箭头点击应阻止冒泡，否则整行也会收到')
  assert.equal(toggled, 1)
  assert.equal(entered, 0, '点箭头不应同时进详情')
})
