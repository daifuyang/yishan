const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('node:fs')
const path = require('node:path')

const { loadTs } = require('./helpers/load-ts.cjs')

// SCSS 模块在平台边界上打桩成「返回 key 本身」的代理，
// 断言直接针对源码里写下的 class key，而不是构建后的哈希。
const scss = new Proxy({}, { get: (_, k) => (k === '__esModule' ? false : k) })

// 把返回的元素树摊平成节点数组，方便按 type / props 定位。
// JSX 里的子组件是惰性元素（只是 { type, props }），函数型节点要展开才是真实结构 ——
// 否则 PickerRow 内部的取值单元、MetricCard 内部的 SurfaceCard 都看不见。
const flat = (v) => {
  if (!v || typeof v !== 'object') return []
  if (Array.isArray(v)) return v.flatMap(flat)
  if (typeof v.type === 'function') return flat(v.type(v.props ?? {}))
  return [v, ...flat(v.props?.children)]
}

const classOf = (node) => String(node?.props?.className ?? '')

const TARO = { View: 'View', Text: 'Text', Image: 'Image', Picker: 'Picker' }

// 组件按函数直接调用（无 React 运行时）：useState 返回初值即可。
const react = {
  useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
  useMemo: (factory) => factory(),
}

const ATOM_MOCKS = {
  '@tarojs/components': TARO,
  './LineIcon': { LineIcon: 'LineIcon' },
  './ManagementAtoms.module.scss': scss,
}

const loadPickerRow = () =>
  loadTs('src/components/management/PickerRow.tsx', ATOM_MOCKS).PickerRow

const loadDateField = () =>
  loadTs('src/components/management/DateField.tsx', ATOM_MOCKS).DateField

const loadSurfaceCard = () =>
  loadTs('src/components/management/SurfaceCard.tsx', ATOM_MOCKS).SurfaceCard

const loadMetricCard = () =>
  loadTs('src/components/management/MetricCard.tsx', ATOM_MOCKS).MetricCard

const loadCell = () =>
  loadTs('src/components/management/ManagementList.tsx', {
    react,
    '@tarojs/components': TARO,
    '@/components/atoms': { AppText: 'AppText', Avatar: 'Avatar' },
    '@/components/feedback': { StateView: 'StateView' },
    './LineIcon': { LineIcon: 'LineIcon' },
    './ManagementList.module.scss': scss,
  }).ManagementCell

const find = (nodes, key) => nodes.find((node) => classOf(node) === key)

// ---------- PickerRow ----------

test('PickerRow 有值时渲染取值，不给占位加弱化类', () => {
  const nodes = flat(loadPickerRow()({ label: '所在地区', value: '浙江省 / 杭州市', placeholder: '请选择' }))
  const value = find(nodes, 'pickerRow__value')
  assert.ok(value, '取值单元用共享的 pickerRow__value 类')
  const texts = flat(value.props.children)
  assert.deepEqual(texts.map((node) => node.props.children), ['浙江省 / 杭州市'])
  assert.equal(nodes.some((node) => classOf(node) === 'pickerRow__placeholder'), false)
  assert.equal(find(nodes, 'pickerRow__label').props.children, '所在地区')
})

test('PickerRow 空值时用占位文案并加弱化类', () => {
  const nodes = flat(loadPickerRow()({ label: '所在地区', value: '', placeholder: '请选择' }))
  const placeholder = find(nodes, 'pickerRow__placeholder')
  assert.ok(placeholder, '空值应走占位弱化')
  assert.equal(placeholder.props.children, '请选择')
})

test('PickerRow 默认不画行尾箭头，arrow 时才画，且箭头是行级元素', () => {
  const withoutArrow = flat(loadPickerRow()({ label: '所在地区', value: '', placeholder: '请选择' }))
  assert.equal(find(withoutArrow, 'pickerRow__arrow'), undefined, '箭头是显式开关，不默认出现')

  const row = loadPickerRow()({ label: '所在地区', value: '浙江', placeholder: '请选择', arrow: true })
  const withArrow = flat(row)
  const arrow = find(withArrow, 'pickerRow__arrow')
  assert.ok(arrow, 'arrow 时应渲染行尾箭头')
  // 箭头必须是行的最后一个子节点：塞进取值里会跟着取值的盒子走偏。
  assert.equal(flat(arrow.props.children)[0].props.name, 'chevronRight')
  // flat 是前序摊平，箭头嵌进取值内部时 indexOf(arrow) > indexOf(value) 依然成立，
  // 用摊平下标断言就永远抓不到这个回归 —— 顺序必须直接看容器的子节点数组，末项就是箭头本身。
  const rowChildren = row.props.children.filter(Boolean)
  assert.equal(
    rowChildren[rowChildren.length - 1],
    arrow,
    '箭头是行的最后一个直接子节点，不能嵌进取值内部',
  )
})

test('PickerRow 禁用时点击不触发，且不渲染箭头以外的交互', () => {
  const PickerRow = loadPickerRow()
  let clicks = 0
  const enabled = flat(
    PickerRow({ label: '所在地区', value: '浙江', placeholder: '请选择', onClick: () => { clicks += 1 } }),
  )
  enabled[0].props.onClick()
  assert.equal(clicks, 1)

  let disabledClicks = 0
  const disabled = flat(
    PickerRow({
      label: '所在地区',
      value: '浙江',
      placeholder: '请选择',
      disabled: true,
      onClick: () => { disabledClicks += 1 },
    }),
  )
  assert.equal(disabled[0].props.onClick, undefined, '禁用行不挂点击')
  assert.match(classOf(disabled[0]), /pickerRow--disabled/, '禁用行整体弱化')
  assert.equal(disabledClicks, 0)
})

// ---------- DateField ----------

test('DateField 用 Taro date Picker 取值，并原样回传选中的日期字符串', () => {
  const DateField = loadDateField()
  const picked = []
  const nodes = flat(
    DateField({ value: '2026-10-13', placeholder: '请选择出生日期', onChange: (next) => picked.push(next) }),
  )
  const picker = nodes.find((node) => node.type === 'Picker')
  assert.ok(picker, 'DateField 必须包住一个 Taro Picker')
  assert.equal(picker.props.mode, 'date')
  assert.equal(picker.props.value, '2026-10-13')
  picker.props.onChange({ detail: { value: '2026-09-01' } })
  assert.deepEqual(picked, ['2026-09-01'])
})

test('DateField 空值时用占位文案，取值单元复用 PickerRow 的视觉契约', () => {
  const nodes = flat(loadDateField()({ value: '', onChange: () => {} }))
  const picker = nodes.find((node) => node.type === 'Picker')
  // H5 下 Picker 渲染成独立 div，自身没有 flex: 1 就撑不满行，取值到不了行尾
  assert.ok(classOf(picker).includes('dateField'), 'Picker 自身带 flex:1 的定位类')
  assert.equal(find(nodes, 'pickerRow__value') !== undefined, true, '取值单元复用 PickerRow 的类')
  assert.equal(find(nodes, 'pickerRow__placeholder').props.children, '请选择')
})

test('DateField 禁用时 Picker 不可交互', () => {
  const nodes = flat(loadDateField()({ value: '2026-10-13', disabled: true, onChange: () => {} }))
  assert.equal(nodes.find((node) => node.type === 'Picker').props.disabled, true)
})

// ---------- SurfaceCard / MetricCard ----------

test('SurfaceCard 默认不带页顶距，lead 时补 16px 无 hero 页顶距', () => {
  const SurfaceCard = loadSurfaceCard()
  assert.doesNotMatch(classOf(flat(SurfaceCard({ children: null }))[0]), /surfaceCard--lead/)
  assert.match(
    classOf(flat(SurfaceCard({ children: null, lead: true }))[0]),
    /surfaceCard--lead/,
    '无 hero 页的第一块内容由 SurfaceCard 自己补页顶距，不再由页面 SCSS 复制',
  )
})

test('MetricCard 复用 SurfaceCard，只保留标题、数值和辅助文案', () => {
  const nodes = flat(loadMetricCard()({ label: '待办', value: '12', auxiliary: '条' }))
  assert.match(classOf(nodes[0]), /surfaceCard/, 'MetricCard 以 SurfaceCard 为外壳')
  assert.equal(find(nodes, 'metric__label').props.children, '待办')
  assert.equal(find(nodes, 'metric__value').props.children, '12')
  assert.equal(find(nodes, 'metric__auxiliary').props.children, '条')
  // 指标卡不再自带图标和裸箭头（由 SurfaceCard/LineIcon 家族承担）
  assert.equal(nodes.some((node) => node.type === 'LineIcon'), false)
  assert.equal(nodes.some((node) => node.props?.children === '›'), false)
})

// ---------- ManagementCell 槽位 ----------

test('ManagementCell 渲染顺序固定为 内容 → tag → selection → trailingAction → 箭头', () => {
  const tagNode = { type: 'TagMark', props: { className: 'tag-mark' } }
  const selectionNode = { type: 'CheckMark', props: { className: 'check-mark' } }
  const actionNode = { type: 'ActionMark', props: { className: 'action-mark' } }
  const cell = loadCell()({
    title: '应用',
    tag: tagNode,
    selection: selectionNode,
    trailingAction: actionNode,
  })
  const nodes = flat(cell)
  // 顺序直接看行的子节点数组：flat 是前序摊平，槽位嵌进别的槽位内部时 indexOf 依然靠后，
  // 用摊平下标断言抓不到「箭头被塞进动作槽 / 内容里」这类回归（末项必须还是箭头）。
  const rowChildren = cell.props.children.filter(Boolean)
  assert.deepEqual(
    rowChildren.map(classOf),
    ['row__content', 'row__tag', 'row__selection', 'row__action', 'row__arrow'],
    '槽位顺序固定为 内容 → tag → selection → trailingAction → 箭头，且箭头是行的最后一个子节点',
  )
  assert.equal(
    rowChildren[rowChildren.length - 1].props.children.props.name,
    'chevronRight',
    '末项是 chevronRight 箭头',
  )
  assert.equal(find(nodes, 'row__tag').props.children, tagNode)
  assert.equal(find(nodes, 'row__selection').props.children, selectionNode)
  assert.equal(find(nodes, 'row__action').props.children, actionNode)
})

test('未传槽位时不渲染槽位容器（旧调用点行为不变）', () => {
  const nodes = flat(loadCell()({ title: '应用', tag: { type: 'TagMark', props: {} } }))
  assert.equal(find(nodes, 'row__selection'), undefined)
  assert.equal(find(nodes, 'row__action'), undefined)
})

test('动作槽点击阻止冒泡，tag 继续只表达状态', () => {
  const nodes = flat(
    loadCell()({
      title: '应用',
      tag: { type: 'TagMark', props: {} },
      trailingAction: { type: 'ActionMark', props: {} },
    }),
  )
  // tag 是状态列：不承载按钮，也不拦截点击
  assert.equal(find(nodes, 'row__tag') !== undefined, true)
  assert.equal(find(nodes, 'row__tag').props.onClick, undefined)

  const action = find(nodes, 'row__action')
  let stopped = 0
  action.props.onClick({ stopPropagation: () => { stopped += 1 } })
  assert.equal(stopped, 1, '动作槽的点击必须阻止冒泡，否则点按钮会同时触发整行跳转')
})

// selection 是选择态：勾选框默认是行内装饰元素，行点击才是开关，由宿主决定是否拦截
test('选择槽不自行拦截点击，交给 Checkbox 的宿主决定', () => {
  const nodes = flat(
    loadCell()({ title: '应用', selection: { type: 'CheckMark', props: {} } }),
  )
  assert.equal(find(nodes, 'row__selection').props.onClick, undefined)
})

// ---------- 公开接口 ----------

test('公开接口固定：PickerRow / DateField 的 prop 集合与槽位名', () => {
  const read = (file, iface) => {
    const source = fs.readFileSync(path.resolve(__dirname, `../src/components/management/${file}`), 'utf8')
    const start = source.indexOf(`export interface ${iface}`)
    assert.notEqual(start, -1, `${iface} 必须是公开接口`)
    return source.slice(start, source.indexOf('}', start))
  }
  const pickerRow = read('PickerRow.tsx', 'PickerRowProps')
  for (const prop of ['label', 'value', 'placeholder', 'disabled', 'arrow', 'onClick']) {
    assert.match(pickerRow, new RegExp(`${prop}\\??:`), `PickerRowProps 应保留 ${prop}`)
  }
  const dateField = read('DateField.tsx', 'DateFieldProps')
  for (const prop of ['value', 'placeholder', 'disabled', 'onChange']) {
    assert.match(dateField, new RegExp(`${prop}\\??:`), `DateFieldProps 应保留 ${prop}`)
  }
  const cell = read('ManagementList.tsx', 'ManagementCellProps')
  for (const prop of ['selection', 'trailingAction']) {
    assert.match(cell, new RegExp(`${prop}\\??:`), `ManagementCellProps 应新增 ${prop}`)
  }
})
