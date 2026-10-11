const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTs } = require('./helpers/load-ts.cjs')

function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes)
  if (!tree || typeof tree !== 'object') return []
  return [tree, ...nodes(tree.props?.children)]
}

test('bottom selection marks current choice, selects and closes, and cancels without selecting', () => {
  const { BottomSelectSheet } = loadTs('src/components/management/BottomSelectSheet.tsx', {
    '@tarojs/components': { View: 'View', Text: 'Text', ScrollView: 'ScrollView' },
    './LineIcon': { LineIcon: 'LineIcon' },
    './BottomSelectSheet.module.scss': {},
  })
  const events = []
  const props = {
    open: true,
    title: '状态',
    options: [
      { key: '', label: '全部' },
      { key: '1', label: '启用' },
    ],
    value: '1',
    onSelect: (value) => events.push(value),
    onClose: () => events.push('closed'),
  }
  assert.equal(BottomSelectSheet({ ...props, open: false }), null)
  const rendered = nodes(BottomSelectSheet(props))
  const selected = rendered.find((node) => node.props?.['aria-selected'])
  assert.equal(selected.props['aria-label'], '启用')
  rendered.find((node) => node.props?.['aria-label'] === '全部').props.onClick()
  assert.deepEqual(events, ['', 'closed'])
  events.length = 0
  rendered.find((node) => node.props?.['aria-label'] === '取消选择').props.onClick()
  assert.deepEqual(events, ['closed'])
})
