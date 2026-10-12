const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTs } = require('./helpers/load-ts.cjs')

const scssMock = () => new Proxy({}, { get: (_, key) => (key === '__esModule' ? false : key) })

function load() {
  return loadTs('src/components/management/SelectionFooter.tsx', {
    // 组件脱离渲染器调用；本文件只断言初始（未展开）态，故 setter 为空实现
    react: {
      useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
    },
    '@tarojs/components': { View: 'View', Text: 'Text' },
    './LineIcon': { LineIcon: 'LineIcon' },
    './SelectionFooter.module.scss': scssMock(),
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

const base = {
  count: 3,
  unit: '个部门',
  items: [
    { id: 48, label: '研发部门', path: ['上海总公司', '研发部门'] },
    { id: 52, label: '市场部门', path: ['上海总公司', '市场部门'] },
  ],
  onCancel: () => {},
  onConfirm: () => {},
}

test('渲染已选计数与取消/确定按钮', () => {
  const { SelectionFooter } = load()
  const t = SelectionFooter(base)
  assert.match(text(t), /已选择 3 个部门/)
  assert.ok(find(t, (n) => n.props?.['aria-label'] === '取消').length)
  assert.ok(find(t, (n) => n.props?.['aria-label'] === '确定').length)
})

test('确定与取消分别触发各自回调', () => {
  const { SelectionFooter } = load()
  let canceled = 0
  let confirmed = 0
  const t = SelectionFooter({ ...base, onCancel: () => canceled++, onConfirm: () => confirmed++ })
  find(t, (n) => n.props?.['aria-label'] === '取消')[0].props.onClick()
  find(t, (n) => n.props?.['aria-label'] === '确定')[0].props.onClick()
  assert.equal(canceled, 1)
  assert.equal(confirmed, 1)
})

test('count 为 0 时显示未选择任何项', () => {
  const { SelectionFooter } = load()
  const t = SelectionFooter({ ...base, count: 0, items: [] })
  assert.match(text(t), /未选择任何部门/)
})

test('readonly 模式只渲染完成按钮，不渲染取消与确定', () => {
  const { SelectionFooter } = load()
  const t = SelectionFooter({ ...base, readonly: true })
  assert.ok(find(t, (n) => n.props?.['aria-label'] === '完成').length)
  assert.equal(find(t, (n) => n.props?.['aria-label'] === '取消').length, 0)
  assert.equal(find(t, (n) => n.props?.['aria-label'] === '确定').length, 0)
})

test('readonly 模式仍展示已选数量供确认', () => {
  const { SelectionFooter } = load()
  const t = SelectionFooter({ ...base, readonly: true })
  assert.match(text(t), /已选择 3 个部门/)
})

test('已选清单默认收起，不渲染每一项', () => {
  const { SelectionFooter } = load()
  const t = SelectionFooter(base)
  assert.equal(find(t, (n) => String(n.props?.className ?? '').includes('sheetRow')).length, 0)
})

test('onRemoveItem 缺省时不渲染每项的移除按钮', () => {
  const { SelectionFooter } = load()
  const t = SelectionFooter(base)
  assert.equal(find(t, (n) => String(n.props?.['aria-label'] ?? '').startsWith('移除-')).length, 0)
})

test('已选清单可点开用于查看跨分支的已选项', () => {
  const { SelectionFooter } = load()
  const t = SelectionFooter(base)
  const toggle = find(t, (n) => n.props?.['aria-label'] === '已选清单')
  assert.equal(toggle.length, 1)
  assert.equal(typeof toggle[0].props.onClick, 'function')
})

test('单位为角色时文案随之变化', () => {
  const { SelectionFooter } = load()
  const t = SelectionFooter({ ...base, unit: '个角色' })
  assert.match(text(t), /已选择 3 个角色/)
  assert.match(SelectionFooter({ ...base, unit: '个角色', count: 0 }) && text(SelectionFooter({ ...base, unit: '个角色', count: 0 })), /未选择任何角色/)
})