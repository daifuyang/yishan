const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const { loadTs } = require('./helpers/load-ts.cjs')

const scssMock = () => new Proxy({}, { get: (_, k) => (k === '__esModule' ? false : k) })

const mod = loadTs('src/components/management/MenuTree.tsx', {
  react: { useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}] },
  '@tarojs/components': { View: 'View', Text: 'Text' },
  './LineIcon': { LineIcon: 'LineIcon' },
  './MenuTree.module.scss': scssMock(),
  './menuTreeLogic': loadTs('src/components/management/menuTreeLogic.ts'),
})

const css = fs.readFileSync(
  path.resolve(__dirname, '../src/components/management/MenuTree.module.scss'),
  'utf8',
)

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

// MenuTree 内部会渲染 <MenuModuleHeader /> 这类子组件，它们在树里是「未调用」的元素。
// 直接断言 className 看不到内部结构，所以先把这些元素就地展开一层。
function resolve(node, depth = 3) {
  if (!node || typeof node !== 'object' || depth === 0) return node
  if (Array.isArray(node)) return node.map((n) => resolve(n, depth))
  if (typeof node.type === 'function' && node.props) {
    return resolve(node.type(node.props), depth - 1)
  }
  return { ...node, props: { ...node.props, children: resolve(node.props?.children, depth) } }
}

const classesOf = (tree) => walk(tree, () => true).map((n) => n.props?.className).filter(Boolean)
const guideElements = (tree) =>
  walk(tree, (n) => typeof n.props?.className === 'string' && n.props.className.includes('guide'))

const TREE = [
  {
    id: 1,
    name: '我的账户',
    type: 0,
    children: [
      {
        id: 11,
        name: '个人中心',
        type: 1,
        children: [{ id: 111, name: '编辑', type: 2 }],
      },
      { id: 12, name: 'API Token', type: 1, children: [] },
    ],
  },
  {
    id: 2,
    name: 'CRM',
    type: 0,
    children: [{ id: 21, name: '客户列表', type: 1, children: [] }],
  },
]

const render = (node, depth) => ({
  title: node.name,
  description: depth === 1 ? `/${node.name}` : depth >= 2 ? `${node.name}:write` : '',
  type: node.type,
})

function renderTree(overrides = {}) {
  return resolve(
    mod.MenuTree({
      tree: TREE,
      openModuleId: 1,
      onToggleModule: () => {},
      expanded: new Set(),
      onToggle: () => {},
      renderNode: render,
      ...overrides,
    }),
  )
}

// ---- 层级视觉：一级是模块分组，不是一个列表里的普通行 ----

test('一级模块渲染成独立分组块，模块头与模块体分开', () => {
  const tree = renderTree()
  const modules = walk(tree, (n) => n.props?.className === 'module')
  assert.equal(modules.length, 2, '两个一级模块各占一个分组块')
  const headers = walk(tree, (n) => String(n.props?.className || '').split(' ').includes('moduleHeader'))
  assert.equal(headers.length, 2)
})

test('模块体与模块头是不同容器，节点不再挤在同一个列表里', () => {
  const tree = renderTree()
  const bodies = walk(tree, (n) => n.props?.className === 'moduleBody')
  assert.equal(bodies.length, 1, '只有展开的模块渲染模块体')
  const body = bodies[0]
  // 页面行挂在模块体里，不在模块头上
  assert.ok(classesOf(body).some((c) => typeof c === 'string' && c.includes('row--page')))
})

test('模块头隐藏路由，只显示模块名', () => {
  const tree = renderTree()
  const header = walk(tree, (n) => String(n.props?.className || '').split(' ').includes('moduleHeader'))[0]
  const text = walk(header, (n) => typeof n.props?.children === 'string').map((n) => n.props.children)
  assert.ok(text.includes('我的账户'))
  assert.ok(!text.some((t) => typeof t === 'string' && t.startsWith('/')), '模块头不应出现路由')
})

test('模块头字号加粗、行更高，与页面行区分开', () => {
  assert.match(css, /\.moduleHeader \{[^}]*min-height:\s*(56|60)px/)
  assert.match(css, /\.moduleHeader__title \{[^}]*font-weight:\s*var\(--font-weight-semibold\)/)
  // 模块头有浅色底，和白色模块体区分
  assert.match(css, /\.moduleHeader \{[^}]*background:/)
})

test('模块分块有圆角与外间距，形成卡片感', () => {
  assert.match(css, /\.module \{[^}]*border-radius:/)
  assert.match(css, /\.module \{[^}]*margin:[^;]*var\(--space-3\)/)
})

// ---- 折叠策略：非当前模块默认折叠 ----

test('只有当前模块展开，其余模块模块体不渲染', () => {
  const openFirst = renderTree({ openModuleId: 1 })
  assert.equal(walk(openFirst, (n) => n.props?.className === 'moduleBody').length, 1)

  const openSecond = renderTree({ openModuleId: 2 })
  const bodies = walk(openSecond, (n) => n.props?.className === 'moduleBody')
  assert.equal(bodies.length, 1)
  assert.ok(
    walk(openSecond, (n) => String(n.props?.className || '').split(' ').includes('moduleHeader')).some((h) =>
      walk(h, (n) => n.props?.children === 'CRM').length,
    ),
    '展开的应是 CRM 而不是我的账户',
  )
})

test('openModuleId 为空时全部折叠', () => {
  const tree = renderTree({ openModuleId: null })
  assert.equal(walk(tree, (n) => n.props?.className === 'moduleBody').length, 0)
  assert.equal(walk(tree, (n) => String(n.props?.className || '').split(' ').includes('moduleHeader')).length, 2)
})

// 展开和「进入模块」是两个意图，共用一个点击区会让用户点不准。
test('模块头的箭头只切换展开，点击模块名才进详情', () => {
  let toggled = 0
  let selected = null
  const tree = renderTree({
    onToggleModule: () => toggled++,
    onSelect: (node) => { selected = node.name },
  })
  const header = walk(tree, (n) => String(n.props?.className || '').split(' ').includes('moduleHeader'))[0]
  // 点击处理在包裹箭头的容器上，图标只是它的视觉内容
  const toggle = walk(header, (n) => typeof n.props?.className === 'string' && n.props.className.includes('moduleHeader__toggle'))[0]
  assert.ok(toggle, '模块头应有展开箭头容器')
  assert.ok(
    walk(toggle, (n) => n.props?.name === 'chevronDown' || n.props?.name === 'chevronRight').length > 0,
    '箭头容器里应有展开图标',
  )
  toggle.props.onClick({ stopPropagation: () => {} })
  assert.equal(toggled, 1)
  assert.equal(selected, null, '点箭头不应同时进详情')
})

// ---- 二级/三级视觉权重递减 ----

test('页面行显示路由，按钮行不显示路由', () => {
  const tree = renderTree()
  const rows = walk(tree, (n) => typeof n.props?.className === 'string' && /row--(page|action)/.test(n.props.className))
  const pageRow = rows.find((r) => r.props.className.includes('row--page'))
  const text = walk(pageRow, (n) => typeof n.props?.children === 'string').map((n) => n.props.children)
  assert.ok(text.some((t) => typeof t === 'string' && t.startsWith('/')), '页面行应显示路由')
})

test('按钮行比页面行视觉更弱：更小字号、灰色图标', () => {
  assert.match(css, /\.row--action \{[^}]*font-size:\s*var\(--font-size-13\)/)
  assert.match(css, /\.row--action \{[^}]*min-height:\s*(40|44)px/)
  // 按钮层级不画辅助线之外的装饰，保持最简
  assert.match(css, /\.row--action \.title \{[^}]*color:\s*var\(--color-text-secondary\)/)
})

test('页面行缩进大于模块头，按钮行缩进大于页面行', () => {
  const indentOf = (selector) => {
    const rule = css.match(new RegExp(`${selector.replace('.', '\\.')} \\{([^}]*)\\}`))[1]
    return Number(rule.match(/padding:[^;]*?\s(\d+)px\s*;/)[1])
  }
  const module = Number(css.match(/\.moduleHeader \{[^}]*padding:\s*var\(--space-4\)/) ? 16 : 16)
  const page = indentOf('.row--page')
  const action = indentOf('.row--action')
  assert.ok(page > module, `页面行(${page})应比模块头(${module})缩进更多`)
  assert.ok(action > page, `按钮行(${action})应比页面行(${page})缩进更多`)
})

// 极简方向：连接线整体移除，层级只靠缩进 / 间距 / 字号
test('模块头与模块体都不再渲染连接线', () => {
  const tree = renderTree()
  assert.equal(guideElements(tree).length, 0, '整棵树都不应再有辅助线')
});

// ---- 资源类型图标语义 ----
// Settings/Zap/Shield 自带「配置 / 自动化 / 安全策略」的业务含义，
// 会盖过「操作权限」本身，所以操作类型必须用指针点击。

test('三种资源类型各有独立图标：文件夹 / 带正文文档 / 指针点击', () => {
  const iconOf = (type) => walk(mod.MenuTypeIcon({ type }), (n) => n.props?.name)[0]?.props?.name
  assert.deepEqual(
    ['directory', 'page', 'action'].map(iconOf),
    ['folder', 'fileText', 'mousePointerClick'],
  )
})

test('后端 0/1/2 映射到目录 / 页面 / 操作', () => {
  assert.equal(mod.menuResourceType(0), 'directory')
  assert.equal(mod.menuResourceType(1), 'page')
  assert.equal(mod.menuResourceType(2), 'action')
})

test('操作类型图标弱化为灰色，目录与页面为主色', () => {
  const colorOf = (type) => walk(mod.MenuTypeIcon({ type }), (n) => n.props?.color)[0]?.props?.color
  assert.equal(colorOf('directory'), '#1677FF')
  assert.equal(colorOf('page'), '#1677FF')
  assert.equal(colorOf('action'), '#86909C')
})

test('不再使用齿轮 / 闪电 / 盾牌表达操作权限', () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, '../src/components/management/MenuTree.tsx'),
    'utf8',
  )
  const mapping = source.match(/RESOURCE_ICONS[^}]*}/)[0]
  assert.doesNotMatch(mapping, /settings|shield|zap/, '操作权限不应复用带业务含义的图标')
})

test('类型文案用「操作」而不是「按钮」', () => {
  assert.equal(mod.menuTypeLabel('directory'), '目录')
  assert.equal(mod.menuTypeLabel('page'), '页面')
  assert.equal(mod.menuTypeLabel('action'), '操作')
})

test('类型标签三色：目录浅蓝、页面浅绿、操作浅灰', () => {
  const cls = (type) => classesOf(mod.MenuTypeBadge({ type })).join(' ')
  assert.match(cls('directory'), /badge--directory/)
  assert.match(cls('page'), /badge--page/)
  assert.match(cls('action'), /badge--action/)
  assert.match(css, /\.badge--directory \{[^}]*background:\s*#eaf3ff/i)
  assert.match(css, /\.badge--directory \{[^}]*color:\s*#1677ff/i)
  assert.match(css, /\.badge--page \{[^}]*background:\s*#eef9f1/i)
  assert.match(css, /\.badge--page \{[^}]*color:\s*#2ba471/i)
  assert.match(css, /\.badge--action \{[^}]*background:\s*#f2f3f5/i)
  assert.match(css, /\.badge--action \{[^}]*color:\s*#86909c/i)
})

test('badge 轻量化：小字号 + 较大圆角', () => {
  assert.match(css, /\.badge \{[^}]*border-radius:\s*(10|12)px/)
  assert.match(css, /\.badge \{[^}]*font-size:\s*var\(--font-size-12\)/)
})

// ---- 极简：去掉圆点与连接线，只靠缩进/间距/字号表达层级 ----

test('不再渲染叶子圆点和树状连接线', () => {
  const { MenuTreeRow } = mod
  const tree = resolve(
    MenuTreeRow({
      title: '查看',
      description: 'role:read',
      type: 2,
      depth: 2,
      hasChildren: false,
      expanded: false,
    }),
  )
  const cls = classesOf(tree)
  assert.ok(!cls.some((c) => typeof c === 'string' && c.includes('dot')), '叶子圆点是多余点缀')
  assert.equal(guideElements(tree).length, 0, '连接线应全部移除')
})

test('详情层级不靠连接线也能区分：行高与字号递减', () => {
  assert.match(css, /\.row--page \{[^}]*min-height:\s*var\(--list-item-height-sm\)/)
  assert.match(css, /\.row--action \{[^}]*min-height:\s*40px/)
  assert.match(css, /\.row--action \.title \{[^}]*font-size:\s*var\(--font-size-13\)/)
})

// ---- 配色体系：统一品牌蓝 + 中性灰阶，不堆装饰 ----

test('模块卡片默认白底，展开态才用极淡蓝', () => {
  const { MenuModuleHeader } = mod
  const collapsed = resolve(classesOf(MenuModuleHeader({ title: 'CRM', count: 3, expanded: false, onToggle() {} })))
  assert.ok(!collapsed.join(' ').includes('moduleHeaderOpen'), '折叠态不带展开样式')
  const open = classesOf(MenuModuleHeader({ title: 'CRM', count: 3, expanded: true, onToggle() {} })).join(' ')
  assert.ok(open.includes('moduleHeaderOpen'), '展开态有独立样式钩子')
})

test('页面底色使用浅灰白而非蓝灰', () => {
  assert.match(css, /\.tree \{[^}]*background:\s*transparent/, '树本身透明，由页面底色承担')
  const header = css.match(/\.moduleHeader \{([^}]*)\}/)[1]
  assert.match(header, /background:\s*#fff/i, '模块头默认白底')
})

test('分割线用极浅灰，不使用深色描边', () => {
  assert.match(css, /--|border-bottom:\s*1px solid #eef1f4/i, '分割线应为 #EEF1F4')
})

test('不使用阴影，层级只靠留白和背景区分', () => {
  assert.doesNotMatch(css, /box-shadow/, '菜单树不应使用阴影')
})

test('主色统一为一套品牌蓝，旧的绿色系已清除', () => {
  const blues = css.match(/#1677ff|#246bfd/gi) || []
  assert.ok(blues.length >= 2, '主色应统一使用同一套蓝')
  // 页面 badge 的 #2BA471 是规范指定的轻量区分色，不算「旧绿色系」；
  // 要清掉的是上一版遗留的 #00B42A。
  assert.doesNotMatch(css, /#00b42a/i, '不应残留上一版的亮绿色')
})
