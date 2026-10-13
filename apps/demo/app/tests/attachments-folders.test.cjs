const assert = require('node:assert/strict')
const test = require('node:test')
const { mountPage } = require('./helpers/mount-page.cjs')

const TREE = [
  {
    id: 1,
    name: '营销素材',
    kind: 'all',
    status: '1',
    sort_order: 0,
    children: [
      { id: 2, name: '首页素材', kind: 'image', status: '1', sort_order: 0, children: [] },
    ],
  },
  { id: 5, name: '短视频', kind: 'video', status: '0', sort_order: 1 },
]
const scss = new Proxy({}, { get: (_, k) => (k === '__esModule' ? false : k) })
const common = (permissions) => ({
  '@tarojs/components': { View: 'View', Text: 'Text' },
  '@/api/client': { getSessionVersion: () => 1 },
  '@/components/atoms': { Tag: 'Tag' },
  '@/components/feedback': { StateView: 'StateView' },
  '@/constants/routes': { SYSTEM_PAGES: { attachmentFolderForm: 'FF' } },
  '@/hooks': {
    useCanWrite: (...c) => c.every((x) => permissions.includes(x)),
    confirmAction: async () => true,
  },
  '@/utils/auth-guard': {
    useRequireAuth: () => ({ ready: true, allowed: true }),
    canWriteModuleNow: (_, r) => r.every((x) => permissions.includes(x)),
    useCurrentModuleAccess:
      () =>
      (r = []) =>
        r.every((x) => permissions.includes(x)),
  },
  '../../_shared/AdminUI': { withAccountScope: (c) => c, errorMessage: (e) => e.message },
})

function mountList(permissions = ['system:attachment:create']) {
  const nav = []
  const page = mountPage('src/pages/system/attachments/folders/index.tsx', {
    ...common(permissions),
    '@tarojs/taro': {},
    '@/api/admin/attachments': { getFolderTree: async () => TREE },
    '@/components/management': Object.fromEntries(
      [
        'ManagementHeaderAction',
        'ManagementList',
        'ManagementPage',
        'ManagementPageHeader',
        'ManagementStates',
        'ManagementTreeCell',
      ].map((k) => [k, k]),
    ),
    '@/utils/router': { navigateTo: (u) => nav.push(u) },
  })
  return { page, nav }
}

test('分组列表：默认只显示顶层，展开后显示子分组；点行进编辑；类型限制作描述、禁用作标签', async () => {
  const { page, nav } = mountList()
  await page.settle()
  let cells = page.all('ManagementTreeCell')
  assert.deepEqual(
    cells.map((c) => c.props.title),
    ['营销素材', '短视频'],
  )
  assert.equal(cells[0].props.hasChildren, true)
  assert.equal(cells[0].props.description, undefined)
  assert.equal(cells[1].props.description, '仅视频')
  assert.ok(cells[1].props.tag)
  cells[0].props.onToggle()
  cells = page.all('ManagementTreeCell')
  assert.deepEqual(
    cells.map((c) => c.props.title),
    ['营销素材', '首页素材', '短视频'],
  )
  assert.equal(cells[1].props.depth, 1)
  cells[1].props.onClick()
  assert.deepEqual(nav, ['/FF?id=2'])
})

test('新建入口受 create 权限控制', async () => {
  const yes = mountList()
  await yes.page.settle()
  yes.page.byLabel('新建').props.onClick()
  assert.deepEqual(yes.nav, ['/FF'])
  const no = mountList([])
  await no.page.settle()
  assert.equal(no.page.byLabel('新建'), undefined)
})

function mountForm({
  router = {},
  tree = async () => TREE,
  folder = async () => ({ ...TREE[0], remark: '旧备注' }),
  permissions = [
    'system:attachment:create',
    'system:attachment:update',
    'system:attachment:delete',
  ],
} = {}) {
  const calls = { creates: [], updates: [], deletes: [], confirms: [], back: 0 }
  const page = mountPage(
    'src/pages/system/attachments/folder-form/index.tsx',
    {
      ...common(permissions),
      '@tarojs/taro': { showToast() {}, setNavigationBarTitle() {} },
      '@/hooks': {
        useCanWrite: (...c) => c.every((x) => permissions.includes(x)),
        confirmAction: async (options) => {
          calls.confirms.push(options)
          return true
        },
      },
      '@/api/admin/attachments': {
        getFolderTree: tree,
        getFolder: folder,
        createFolder: async (d) => calls.creates.push(d),
        updateFolder: async (id, d) => calls.updates.push({ id, d }),
        deleteFolder: async (id) => calls.deletes.push(id),
      },
      '@/components/management': Object.fromEntries(
        [
          'ActionSheet',
          'EnumField',
          'FormContent',
          'FormError',
          'FormField',
          'FormSection',
          'FormSubmitBar',
          'ManagementHeaderAction',
          'ManagementPage',
          'ManagementPageHeader',
          'TextAreaField',
          'TextField',
        ].map((k) => [k, k]),
      ),
      '@/utils/router': { navigateBack: () => calls.back++ },
      '../FolderTreeSheet': { FolderTreeSheet: 'FolderTreeSheet' },
      './index.module.scss': scss,
    },
    { router },
  )
  return { page, calls }
}

test('新建分组：默认上级来自路由，提交完整 FolderInput', async () => {
  const { page, calls } = mountForm({ router: { parentId: '1' } })
  await page.settle()
  page.all('TextField')[0].props.onChange('活动')
  page.one('FormSubmitBar').props.onSubmit()
  await page.settle()
  assert.deepEqual(calls.creates, [
    { name: '活动', parentId: 1, kind: 'all', status: '1', sort_order: 0, remark: '' },
  ])
  assert.equal(calls.back, 1)
})

test('编辑分组：回填全部字段，上级选择排除自身及后代', async () => {
  const { page, calls } = mountForm({ router: { id: '1' } })
  await page.settle()
  assert.equal(page.all('TextField')[0].props.value, '营销素材')
  assert.equal(page.one('TextAreaField').props.value, '旧备注')
  assert.deepEqual([...page.one('FolderTreeSheet').props.excludeIds].sort(), [1, 2])
  page.one('FormSubmitBar').props.onSubmit()
  await page.settle()
  assert.deepEqual(calls.updates, [
    {
      id: 1,
      d: {
        name: '营销素材',
        parentId: 0,
        kind: 'all',
        status: '1',
        sort_order: 0,
        remark: '旧备注',
      },
    },
  ])
})

test('编辑态更多→删除，确认文案含限制说明', async () => {
  const { page, calls } = mountForm({ router: { id: '1' } })
  await page.settle()
  page.byLabel('更多').props.onClick()
  page.rerender()
  page
    .one('ActionSheet')
    .props.items.find((i) => i.key === 'delete')
    .onClick()
  await page.settle()
  assert.match(calls.confirms[0].content, /包含子分组或素材的分组不能删除/)
  assert.deepEqual(calls.deletes, [1])
  assert.equal(calls.back, 1)
})

test('无 update/delete 权限：编辑态不显示保存栏与「更多」，字段只读', async () => {
  const { page } = mountForm({ router: { id: '1' }, permissions: [] })
  await page.settle()
  assert.equal(page.all('FormSubmitBar').length, 0)
  assert.equal(page.byLabel('更多'), undefined)
  assert.equal(page.all('TextField')[0].props.disabled, true)
})

test('无写权限：名称/上级分组/排序/备注整行置灰，上级分组行不带箭头', async () => {
  const { page } = mountForm({ router: { id: '1' }, permissions: [] })
  await page.settle()
  const rows = Object.fromEntries(page.all('FormField').map((f) => [f.props.label, f.props]))
  for (const label of ['名称', '上级分组', '排序', '备注']) assert.equal(rows[label].disabled, true, label)
  assert.equal(rows.上级分组.arrow, false)
})

test('分组树加载失败：上级行提示失败且不能打开面板，保存仍提交原上级', async () => {
  const { page: failing, calls } = mountForm({
    router: { id: '2' },
    tree: async () => {
      throw new Error('网络错误')
    },
    folder: async () => ({ ...TREE[0].children[0], parentId: 1, remark: '' }),
  })
  await failing.settle()
  const row = failing.all('FormField').find((f) => f.props.label === '上级分组')
  assert.match(JSON.stringify(row.props.children), /分组加载失败/)
  assert.doesNotMatch(JSON.stringify(row.props.children), /顶级分组/)
  assert.equal(row.props.arrow, false)
  row.props.onArrowClick()
  row.props.children.props.onClick()
  failing.rerender()
  assert.equal(failing.one('FolderTreeSheet').props.open, false)
  failing.one('FormSubmitBar').props.onSubmit()
  await failing.settle()
  assert.equal(calls.updates.length, 1)
  assert.equal(calls.updates[0].d.parentId, 1)
  assert.equal(calls.back, 1)
})
