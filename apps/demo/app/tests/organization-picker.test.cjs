const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTs } = require('./helpers/load-ts.cjs')

// SCSS 样式 mock 必须在 __esModule 上返回假值，否则互操作层把样式模块当成 ES module
const scssMock = () => new Proxy({}, { get: (_, key) => (key === '__esModule' ? false : key) })

function load() {
  return loadTs('src/components/management/OrganizationPicker.tsx', {
    '@tarojs/components': { View: 'View', Text: 'Text' },
    './LineIcon': { LineIcon: 'LineIcon' },
    './OrganizationPicker.module.scss': scssMock(),
    '@/pages/system/user/profileSections': loadTs('src/pages/system/user/profileSections.ts'),
  })
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

test('渲染 label 与组织摘要，并带箭头', () => {
  const { OrganizationPicker } = load()
  const tree = OrganizationPicker({
    label: '所属部门',
    ids: [48, 52],
    names: new Map([[48, '研发部门'], [52, '市场部门']]),
    onPress: () => {},
  })
  assert.match(text(tree), /所属部门/)
  assert.match(text(tree), /研发部门、市场部门/)
  assert.equal(find(tree, (n) => n.props?.name === 'chevronRight').length, 1)
})

test('超过 2 个时摘要带「等 N 个」', () => {
  const { OrganizationPicker } = load()
  const names = new Map([[1, '甲'], [2, '乙'], [3, '丙']])
  const tree = OrganizationPicker({ label: '所属部门', ids: [1, 2, 3], names, onPress: () => {} })
  assert.match(text(tree), /甲、乙 等 3 个/)
})

test('空选中时展示 未设置 且走 muted 类名', () => {
  const { OrganizationPicker } = load()
  const tree = OrganizationPicker({ label: '角色', ids: [], names: new Map(), onPress: () => {} })
  assert.match(text(tree), /未设置/)
  assert.equal(
    find(tree, (n) => String(n.props?.className ?? '').includes('orgValue--muted')).length,
    1,
  )
})

test('点击整行触发 onPress', () => {
  const { OrganizationPicker } = load()
  let pressed = 0
  const tree = OrganizationPicker({
    label: '角色',
    ids: [37],
    names: new Map([[37, '管理员']]),
    onPress: () => pressed++,
  })
  find(tree, (n) => typeof n.props?.onClick === 'function')[0].props.onClick()
  assert.equal(pressed, 1)
})

test('名称全部解析不出时回退为占位文案而非空顿号串', () => {
  const { OrganizationPicker } = load()
  const tree = OrganizationPicker({ label: '所属部门', ids: [9, 10], names: new Map(), onPress: () => {} })
  const flat = text(tree)
  assert.match(flat, /名称暂不可用/)
  assert.ok(!flat.includes('、'), `不应出现空顿号串，实际：${flat}`)
})