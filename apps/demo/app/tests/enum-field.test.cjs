const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTs } = require('./helpers/load-ts.cjs')

const scssMock = () => new Proxy({}, { get: (_, key) => (key === '__esModule' ? false : key) })

function load() {
  return loadTs('src/components/management/FormLayout.tsx', {
    react: { useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}] },
    '@tarojs/components': {
      View: 'View',
      Text: 'Text',
      Input: 'Input',
      Textarea: 'Textarea',
      Picker: 'Picker',
      Switch: 'Switch',
    },
    './LineIcon': { LineIcon: 'LineIcon' },
    './FormLayout.module.scss': scssMock(),
  })
}

function find(node, pred, out = []) {
  if (Array.isArray(node)) {
    for (const n of node) find(n, pred, out)
    return out
  }
  if (!node || typeof node !== 'object') return out
  if (pred(node)) out.push(node)
  find(node.props?.children, pred, out)
  return out
}

const STATUS = [
  { value: '1', label: '启用' },
  { value: '0', label: '禁用' },
]

test('EnumField 渲染当前值的文案而不是编码', () => {
  const { EnumField } = load()
  const tree = EnumField({ label: '状态', value: '0', options: STATUS, onChange: () => {} })
  const picker = find(tree, (n) => n.type === 'Picker')[0] ?? null
  assert.deepEqual(picker.props.range, ['启用', '禁用'])
  // 下标 1 = 禁用：提交 0，展示「禁用」
  assert.equal(picker.props.value, 1)
  assert.equal(find(tree, (n) => typeof n === 'object' && n.props?.children === '禁用').length, 1)
})

test('EnumField 选择后回传后端编码而不是文案', () => {
  const { EnumField } = load()
  const picked = []
  const tree = EnumField({ label: '状态', value: '1', options: STATUS, onChange: (v) => picked.push(v) })
  const picker = find(tree, (n) => n.type === 'Picker')[0] ?? null
  picker.props.onChange({ detail: { value: 1 } })
  assert.deepEqual(picked, ['0'])
})

// 箭头由 FormField 渲染（EnumField 只是把 arrow 传下去），本用例直接断言这个边界。
test('EnumField 交给 FormField 的行带箭头', () => {
  const { EnumField } = load()
  const tree = EnumField({ label: '状态', value: '1', options: STATUS, onChange: () => {} })
  assert.equal(tree.props.arrow, true)
  assert.equal(tree.props.label, '状态')
})

// 编码不在选项内时不能默默高亮到第一项 —— 那会把「未知状态」显示成「启用」。
test('EnumField 遇到未知编码显示占位文案而不是高亮首项', () => {
  const { EnumField } = load()
  const tree = EnumField({ label: '状态', value: '9', options: STATUS, onChange: () => {} })
  assert.equal(find(tree, (n) => typeof n === 'object' && n.props?.children === '请选择').length, 1)
  assert.equal(find(tree, (n) => typeof n === 'object' && n.props?.children === '启用').length, 0)
})

test('EnumField 禁用时 Picker 不可交互', () => {
  const { EnumField } = load()
  const tree = EnumField({ label: '状态', value: '1', options: STATUS, onChange: () => {}, disabled: true })
  assert.equal(find(tree, (n) => n.type === 'Picker')[0].props.disabled, true)
})

const fs = require('node:fs')
const path = require('node:path')
const srcRoot = path.resolve(__dirname, '../src')

// 分段控件在 76px 标签列里会被挤成竖排，且当前值不在选项内时只显示高亮位置、
// 看不出真实状态。单选枚举一律走 EnumField（原生 selector Picker）。
const ENUM_FORM_PAGES = [
  'pages/system/position/form/index.tsx',
  'pages/system/dept/DepartmentForm.tsx',
  'pages/system/dict/DictionaryForm.tsx',
]

test('表单页的状态用 EnumField 而不是分段控件', () => {
  for (const file of ENUM_FORM_PAGES) {
    const source = fs.readFileSync(path.join(srcRoot, file), 'utf8')
    assert.doesNotMatch(source, /SegmentField/, `${file} 不应再使用 SegmentField`)
    assert.match(source, /EnumField/, `${file} 应使用共享的 EnumField`)
  }
})

// 有 placeholder 就不需要 note —— 规范：不要把 placeholder 在提示行里重述一遍。
test('排序字段的说明进 placeholder 而不是 note', () => {
  for (const file of ENUM_FORM_PAGES) {
    const source = fs.readFileSync(path.join(srcRoot, file), 'utf8')
    assert.doesNotMatch(
      source,
      /label="排序"[^>]*note=/,
      `${file} 的排序字段不应再用 note 重复提示`,
    )
  }
  const position = fs.readFileSync(path.join(srcRoot, ENUM_FORM_PAGES[0]), 'utf8')
  assert.match(position, /placeholder="非负整数，越小越靠前"/)
})

// 表单里每行都是「白底 + 一条分隔线」，控件本身无边框。textarea 画一圈边框 +
// 圆角会在无边框的行里凭空多出一个卡片块，读起来像嵌了个原生控件。
test('stacked textarea 不画边框，与其他控件同一套语言', () => {
  const css = fs.readFileSync(
    path.resolve(__dirname, '../src/components/management/FormLayout.module.scss'),
    'utf8',
  )
  const rule = css.match(/\.field--stacked \.field__textarea \{([^}]*)\}/)
  assert.ok(rule, '应存在 .field--stacked .field__textarea 规则')
  assert.doesNotMatch(rule[1], /\bborder\s*:/, 'textarea 不应再画边框')
  assert.doesNotMatch(rule[1], /border-radius/, 'textarea 不应再有圆角')
  assert.doesNotMatch(rule[1], /background/, 'textarea 不应再有独立底色')
  // 保留多行区域的识别度与不可拖拽
  assert.match(rule[1], /min-height/, '应保留最小高度，读得出这是多行区域')
  assert.match(rule[1], /resize:\s*none/, '应禁止拖拽改变高度')
})

// 去掉边框后禁用态失去视觉锚点，值文字必须跟着弱化。
test('disabled 的 stacked textarea 值文字一起弱化', () => {
  const css = fs.readFileSync(
    path.resolve(__dirname, '../src/components/management/FormLayout.module.scss'),
    'utf8',
  )
  assert.match(
    css,
    /\.field--disabled \.field__textarea \{[^}]*color:\s*var\(--color-text-tertiary\)/,
    '禁用时应把 textarea 的值文字弱化为 tertiary',
  )
})

// ---- Switch 必须右对齐 ----
// TextField / EnumField 都靠 flex:1 + 右对齐把值推到行尾；Switch 没有 flex，
// 会紧跟在 76px 标签后面停在行中间 —— 同一张表单里两种对齐，用户看着像两套表单。
test('SwitchField 把开关推到行尾而不是紧跟标签', () => {
  const css = fs.readFileSync(
    path.resolve(__dirname, '../src/components/management/FormLayout.module.scss'),
    'utf8',
  )
  const rule = css.match(/\.switchField \{([^}]*)\}/)
  assert.ok(rule, '应有 .switchField 右对齐容器')
  assert.match(rule[1], /flex:\s*1/, '容器需占据标签右侧全部空间')
  assert.match(rule[1], /justify-content:\s*flex-end/, '开关需靠行尾')
})

test('SwitchField 透传 checked / disabled / onChange', () => {
  const { SwitchField } = load()
  let changed = 0
  const tree = SwitchField({
    checked: true,
    disabled: false,
    onChange: () => changed++,
  })
  const toggle = find(tree, (n) => n.type === 'Switch')[0]
  assert.equal(toggle.props.checked, true)
  assert.equal(toggle.props.disabled, false)
  toggle.props.onChange({ detail: { value: false } })
  assert.equal(changed, 1)
})
