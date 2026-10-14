const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTs } = require('./helpers/load-ts.cjs')

test('WeUI options retain distinct indices for equal labels and escape user-managed option text', () => {
  const { selectorPickerItems } = loadTs('src/components/management/selectorPickerItems.ts')
  assert.deepEqual(selectorPickerItems(['启用', '启用', '<img src=x onerror=alert(1)>', '研发 & "财务"']), [
    { label: '启用', value: 0 },
    { label: '启用', value: 1 },
    { label: '&lt;img src=x onerror=alert(1)&gt;', value: 2 },
    { label: '研发 &amp; &quot;财务&quot;', value: 3 },
  ])
})

test('Mini-program selector preserves the current index and disabled state and returns numeric indices', () => {
  const { SelectorPicker } = loadTs('src/components/management/SelectorPicker.tsx', {
    '@tarojs/components': { Picker: 'Picker' },
  })
  const selected = []
  const node = SelectorPicker({ range: ['男', '女'], value: 1, disabled: true, title: '选择性别', onChange: (event) => selected.push(event.detail.value) })
  assert.equal(node.type, 'Picker')
  assert.equal(node.props.value, 1)
  assert.equal(node.props.disabled, true)
  assert.equal(node.props.title, undefined)
  node.props.onChange({ detail: { value: '0' } })
  node.props.onChange({ detail: {} })
  assert.deepEqual(selected, [0])
})
