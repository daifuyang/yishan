const assert = require('node:assert/strict')
const test = require('node:test')
const { mountPage } = require('./helpers/mount-page.cjs')

const TREE = [
  { id: 1, name: '营销素材', status: '1', children: [
    { id: 2, name: '首页素材', status: '1', children: [] },
    { id: 3, name: '活动海报', status: '0', children: [{ id: 4, name: '双十一', status: '1' }] },
  ] },
  { id: 5, name: '短视频', status: '1' },
]
const scss = new Proxy({}, { get: (_, k) => (k === '__esModule' ? false : k) })

function mount(props) {
  const calls = { select: [], close: 0, footer: 0 }
  // FolderTreeSheet 是具名导出，包一层 default 交给驱动器
  const page = mountPage('tests/fixtures/folder-sheet-host.tsx', {
    '@tarojs/components': { View: 'View', Text: 'Text', ScrollView: 'ScrollView' },
    '@/components/management': { LineIcon: 'LineIcon', Breadcrumbs: 'Breadcrumbs' },
    './FolderTreeSheet.module.scss': scss,
    '@host/props': {
      props: {
        open: true, title: '选择分组', folders: TREE, value: 0, rootLabel: '全部分组',
        onSelect: (id) => calls.select.push(id), onClose: () => calls.close++,
        ...props,
      },
    },
  })
  return { page, calls }
}

test('根层：根选项 + 顶层分组，有子分组的显示下级入口', () => {
  const { page } = mount({})
  assert.ok(page.byLabel('全部分组'))
  assert.ok(page.byLabel('营销素材'))
  assert.ok(page.byLabel('进入-营销素材'))
  assert.equal(page.byLabel('进入-短视频'), undefined)
})

test('下钻后选择子分组；禁用分组带后缀', () => {
  const { page, calls } = mount({})
  page.byLabel('进入-营销素材').props.onClick()
  page.rerender()
  assert.ok(page.byLabel('全部（营销素材）'))
  assert.ok(page.byLabel('活动海报（已禁用）'))
  page.byLabel('首页素材').props.onClick()
  assert.deepEqual(calls.select, [2])
  assert.equal(calls.close, 1)
  page.byLabel('全部（营销素材）').props.onClick()
  assert.deepEqual(calls.select, [2, 1])
})

test('打开时定位到当前值所在层，面包屑可返回根', () => {
  const { page } = mount({ value: 4 })
  assert.ok(page.byLabel('双十一'))
  // Breadcrumbs 被 mock 成字符串，直接驱动它的 onNavigate(-1) 回根
  const crumbs = page.one('Breadcrumbs')
  assert.deepEqual(crumbs.props.items.map((item) => item.label), ['营销素材', '活动海报'])
  crumbs.props.onNavigate(-1)
  page.rerender()
  assert.ok(page.byLabel('营销素材'))
})

test('excludeIds 中的分组既不可选也不可进入', () => {
  const { page } = mount({ excludeIds: new Set([1, 2, 3, 4]) })
  assert.equal(page.byLabel('营销素材'), undefined)
  assert.ok(page.byLabel('短视频'))
})

test('底部入口点击触发回调并关闭', () => {
  const { page, calls } = mount({ footer: { label: '管理分组', onClick: () => calls.footer++ } })
  page.byLabel('管理分组').props.onClick()
  assert.equal(calls.footer, 1)
  assert.equal(calls.close, 1)
})
