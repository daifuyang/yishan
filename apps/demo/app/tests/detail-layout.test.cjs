const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTs } = require('./helpers/load-ts.cjs')

// SCSS modules 经 __importDefault 互操作时会探测 `__esModule`。
// Proxy 的 get 陷阱必须对该键返回假值，否则互操作层把样式模块当成 ES module，
// styles.hero 会解析成 undefined。
const scssMock = () => new Proxy({}, { get: (_, key) => (key === '__esModule' ? false : key) })

// 组件脱离 React 渲染器直接调用，useState 只取初值（本文件只断言初始展开态）
const reactMock = {
  useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
}

function load() {
  return loadTs('src/components/management/DetailLayout.tsx', {
    react: reactMock,
    '@tarojs/components': { View: 'View', Text: 'Text', Input: 'Input', Textarea: 'Textarea' },
    '@/components/atoms': { Avatar: 'Avatar', Tag },
    './LineIcon': { LineIcon: 'LineIcon' },
    './DetailLayout.module.scss': scssMock(),
  })
}

// 真实 Tag：断言「包了几层」必须有可辨识的节点，而不是靠字符串名。
function Tag({ variant = 'default', children } = {}) {
  return { type: 'Tag', props: { variant, children } }
}

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

function text(node) {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (!node) return ''
  if (Array.isArray(node)) return node.map(text).join('')
  if (typeof node.type === 'function') return text(node.type(node.props))
  return text(node.props?.children)
}

test('DetailSection 把分组标题渲染在白底容器之外', () => {
  const { DetailSection, DetailRow } = load()
  const tree = DetailSection({ title: '基础信息', children: DetailRow({ label: '用户名', value: 'demo' }) })
  const sheets = find(tree, (n) => n.props?.className === 'section')
  assert.equal(sheets.length, 1)
  assert.match(text(tree), /基础信息/)
  // 标题不是白底容器的后代
  assert.equal(find(sheets[0], (n) => text(n) === '基础信息').length, 0)
})

test('DetailSection 默认展开，defaultCollapsed 时标题带 aria-expanded=false', () => {
  const { DetailSection } = load()
  const open = DetailSection({ title: '账号记录', children: 'x' })
  const collapsed = DetailSection({ title: '账号记录', children: 'x', collapsible: true, defaultCollapsed: true })
  assert.equal(find(open, (n) => n.props?.['aria-expanded'] !== undefined).length, 0)
  assert.equal(find(collapsed, (n) => n.props?.['aria-expanded'] === false).length, 1)
})

test('DetailRow 空值统一显示「未设置」并走 muted', () => {
  const { DetailRow } = load()
  const tree = DetailRow({ label: '邮箱', value: '' })
  assert.match(text(tree), /未设置/)
  assert.equal(
    find(tree, (n) => String(n.props?.className ?? '').includes('row__value--muted')).length,
    1,
  )
})

test('DetailRow 传 onClick 时整行可点并渲染箭头', () => {
  const { DetailRow } = load()
  let clicked = 0
  const tree = DetailRow({ label: '所属部门', value: '研发部门', onClick: () => clicked++ })
  const row = find(tree, (n) => typeof n.props?.onClick === 'function')[0]
  assert.ok(row, 'DetailRow 应渲染带 onClick 的 View')
  row.props.onClick()
  assert.equal(clicked, 1)
  assert.equal(find(tree, (n) => n.props?.name === 'chevronRight').length, 1)
})

test('DetailRow 无 onClick 时不渲染箭头', () => {
  const { DetailRow } = load()
  const tree = DetailRow({ label: '用户名', value: 'demo' })
  assert.equal(find(tree, (n) => n.props?.name === 'chevronRight').length, 0)
})

test('DetailHero 渲染标题与副标题', () => {
  const { DetailHero } = load()
  const tree = DetailHero({ title: '张三', subtitle: '@zhangsan' })
  assert.equal(find(tree, (n) => n.props?.className === 'hero').length, 1)
  assert.match(text(tree), /张三/)
  assert.match(text(tree), /@zhangsan/)
})

// 调用方传的已经是渲染好的 Tag，组件不能再包一层，否则渲染成 Tag 套 Tag
// （双层圆角/边框/内边距，且 variant 被外层默认值吃掉）。
test('DetailHero 不给调用方的 Tag 再包一层', () => {
  const { DetailHero } = load()
  const callerTag = Tag({ variant: 'success', children: '启用' })
  const tree = DetailHero({ title: '董事长', tag: callerTag })
  // 组件内新写 <Tag> 会产生 type 指向 Tag 函数本身的未调用元素。
  assert.equal(find(tree, (n) => n.type === Tag).length, 0)
  // 调用方那颗 Tag 原样出现在标题行里。
  assert.equal(find(tree, (n) => n === callerTag).length, 1)
})
// 描述/备注是长文本：挤在右列会被压成窄条且右对齐，断行后每行长度不齐。
test('DetailRow multiline 时标签在上、正文占满整行', () => {
  const { DetailRow } = load()
  const tree = DetailRow({ label: '岗位描述', value: '公司最高负责人', multiline: true })
  assert.equal(find(tree, (n) => n.props?.className === 'row row--multiline').length, 1)
  assert.equal(find(tree, (n) => n.props?.className === 'row__block').length, 1)
  // 多行行不渲染行尾箭头容器
  assert.equal(find(tree, (n) => n.props?.className === 'row__tail').length, 0)
})

test('DetailRow multiline 保留未设置占位', () => {
  const { DetailRow } = load()
  const tree = DetailRow({ label: '岗位描述', value: '', multiline: true })
  assert.match(text(tree), /未设置/)
})

test('DetailRow 默认仍走右列单行样式', () => {
  const { DetailRow } = load()
  const tree = DetailRow({ label: '岗位名称', value: '董事长' })
  assert.equal(find(tree, (n) => n.props?.className === 'row__block').length, 0)
  assert.equal(find(tree, (n) => n.props?.className === 'row__tail').length, 1)
})

// ---- hero 布局：左侧图标，右侧内容上下两行 ----
// 第一行是标题 + 状态，第二行才是描述。之前 note 和状态挤在同一行，
// 导致「标题 + 状态 + 类型」横向排开，看起来还是一行而不是两行。
test('DetailHero 右侧内容分两行：标题+状态一行，描述另起一行', () => {
  const { DetailHero } = load()
  const tree = DetailHero({
    title: '董事长',
    tag: Tag({ variant: 'success', children: '启用' }),
    note: '页面',
    subtitle: '/system/position',
  })
  const firstRow = find(tree, (n) => n.props?.className === 'hero__titleLine')[0]
  const secondRow = find(tree, (n) => n.props?.className === 'hero__subtitle')[0]
  assert.ok(firstRow, '应有标题行')
  assert.ok(secondRow, '描述应另起一行')
  // note（类型）属于描述信息，不应再挤在标题行里和状态抢位置
  const titleLine = find(firstRow, () => true).map((n) => n.props?.className)
  assert.ok(!titleLine.includes('hero__note'), '类型 note 应移到描述行')
})

test('DetailHero 图标与内容是左右两栏', () => {
  const { DetailHero } = load()
  const tree = DetailHero({ title: 'CRM', glyph: 'folder' })
  const cls = find(tree, () => true).map((n) => n.props?.className).filter(Boolean)
  assert.ok(cls.includes('hero'), 'hero 是横向容器')
  assert.ok(cls.includes('hero__glyph'), '左侧图标')
  assert.ok(cls.includes('hero__info'), '右侧内容')
})

test('DetailHero 图标尺寸克制，不做 52px 圆形色块', () => {
  const fs = require('node:fs')
  const path = require('node:path')
  const css = fs.readFileSync(
    path.resolve(__dirname, '../src/components/management/DetailLayout.module.scss'),
    'utf8',
  )
  const glyph = css.match(/\.hero__glyph \{([^}]*)\}/)[1]
  assert.doesNotMatch(glyph, /52px/, '图标不再用 52px 大圆底')
  assert.doesNotMatch(glyph, /border-radius:\s*var\(--radius-full\)/, '不再用圆形底色块')
})
