const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTs } = require('./helpers/load-ts.cjs')

const scssMock = () => new Proxy({}, { get: (_, key) => (key === '__esModule' ? false : key) })

const { Checkbox } = loadTs('src/components/management/Checkbox.tsx', {
  '@tarojs/components': { View: 'View' },
  './Checkbox.module.scss': scssMock(),
})

test('不带 onClick 时不拦截冒泡，点击应由宿主整行处理', () => {
  // 回归：曾经无条件 stopPropagation，导致点在框上「既不自己响应、又不冒泡」
  const box = Checkbox({ checked: false })
  assert.equal(box.props.onClick, undefined, '没有自己的处理函数时必须放行冒泡')
})

test('带 onClick 时拦截冒泡并交给自己的处理函数', () => {
  let called = 0
  const stopped = []
  const box = Checkbox({
    checked: false,
    onClick: () => called++,
  })
  assert.ok(box.props.onClick, '有自己的处理函数时才绑定')
  box.props.onClick({ stopPropagation: () => stopped.push(true) })
  assert.equal(called, 1)
  assert.equal(stopped.length, 1, '必须阻止冒泡，避免同时触发行点击')
})

test('disabled 时既不绑定也不暴露 checked 语义', () => {
  const box = Checkbox({ checked: true, disabled: true })
  assert.equal(box.props.onClick, undefined)
  assert.equal(box.props['aria-checked'], undefined)
})

test('已选渲染 CSS 勾，半选渲染横杠，未选两者都不渲染', () => {
  const checked = Checkbox({ checked: true })
  const indeterminate = Checkbox({ checked: false, indeterminate: true })
  const empty = Checkbox({ checked: false })
  const root = (node) => node.props?.className ?? ''
  const child = (node) => node.props?.children?.props?.className ?? ''
  assert.match(root(checked), /check--active/)
  assert.match(child(checked), /tick/)
  assert.match(root(indeterminate), /check--active/)
  assert.match(child(indeterminate), /dash/)
  assert.equal(root(empty), 'check')
  assert.equal(child(empty), '')
})

test('半选时 aria-checked 为 mixed', () => {
  const box = Checkbox({ checked: false, indeterminate: true })
  assert.equal(box.props['aria-checked'], 'mixed')
})