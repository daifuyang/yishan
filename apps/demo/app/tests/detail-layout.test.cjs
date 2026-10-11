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
    '@/components/atoms': { Avatar: 'Avatar', Tag: 'Tag' },
    './LineIcon': { LineIcon: 'LineIcon' },
    './DetailLayout.module.scss': scssMock(),
  })
}

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