const assert = require('node:assert/strict')
const test = require('node:test')
const { mountPage } = require('./helpers/mount-page.cjs')

const scss = new Proxy({}, { get: (_, k) => (k === '__esModule' ? false : k) })

const ITEMS = [
  {
    id: 1,
    name: 'banner.png',
    originalName: 'b.png',
    kind: 'image',
    size: 1258291,
    status: '1',
    storage: 'local',
    path: '/u/b.png',
  },
  {
    id: 2,
    name: '',
    originalName: '介绍.mp4',
    kind: 'video',
    size: 100,
    status: '0',
    storage: 'local',
  },
]
const FOLDERS = [{ id: 7, name: '首页素材', status: '1', children: [] }]
const ALL = [
  'system:attachment:list',
  'system:attachment:create',
  'system:attachment:delete',
  'system:attachment:update',
  'system:option:list',
  'system:storage:upload-token',
]

function mount({
  permissions = ALL,
  cloud = { provider: 'disabled' },
  confirm = true,
  session,
  taro = {},
  upload,
} = {}) {
  const calls = { deleted: [], uploads: [], navigate: [], toasts: [], queries: [] }
  let options
  const list = {
    list: ITEMS,
    total: 2,
    loading: false,
    refreshing: false,
    loadingMore: false,
    finished: true,
    error: null,
    keyword: '',
    filters: { folderId: 0, kind: '', status: '' },
    refreshed: 0,
  }
  list.setKeyword = (k) => {
    list.keyword = k
  }
  list.setFilters = (patch) => {
    list.filters = { ...list.filters, ...patch }
  }
  list.refresh = async () => {
    list.refreshed++
  }
  let version = 1
  const page = mountPage('src/pages/system/attachments/index.tsx', {
    '@tarojs/components': { View: 'View', Text: 'Text' },
    '@tarojs/taro': {
      showToast: (o) => calls.toasts.push(o.title),
      pageScrollTo: async () => {},
      chooseImage: async () => ({
        tempFiles: [
          { path: 'p1', size: 10, type: 'image/png', originalFileObj: { name: 'a.png' } },
        ],
      }),
      chooseVideo: async () => ({ tempFilePath: 'v.mp4', size: 20 }),
      ...taro,
    },
    '@/api/admin/attachments': {
      listAttachments: async (query) => {
        calls.queries.push(query)
        return { data: [], pagination: { total: 0 } }
      },
      getFolderTree: async () => FOLDERS,
      getCloudUploadConfig: async () => cloud,
      uploadAttachment: async (file, meta, c) => {
        calls.uploads.push({ name: file.name, meta, cloud: Boolean(c) })
        if (session) version++
        return upload ? upload() : []
      },
      batchDeleteAttachments: async (ids) => {
        calls.deleted.push(ids)
      },
      attachmentUrl: (item) => (item.path ? `https://api.test${item.path}` : ''),
    },
    '@/api/client': { getSessionVersion: () => version },
    '@/components/atoms': { Tag: 'Tag' },
    '@/components/management': Object.fromEntries(
      [
        'ActionSheet',
        'Checkbox',
        'BottomSelectSheet',
        'ManagementCell',
        'ManagementFilterBar',
        'ManagementFilterClear',
        'ManagementFilterTriggers',
        'ManagementHeaderAction',
        'ManagementList',
        'ManagementListFooter',
        'ManagementPage',
        'ManagementPageHeader',
        'ManagementSearchBar',
        'ManagementStates',
        'SelectionFooter',
      ].map((k) => [k, k]),
    ),
    '@/constants/routes': {
      SYSTEM_PAGES: { attachmentDetail: 'D', attachmentImport: 'I', attachmentFolders: 'F' },
    },
    '@/hooks': {
      useCanWrite: (...codes) => codes.every((c) => permissions.includes(c)),
      useListPagination: (o) => {
        options = o
        return list
      },
      confirmAction: async () => confirm,
    },
    '@/utils/auth-guard': {
      useRequireAuth: () => ({ ready: true, allowed: true }),
      useCurrentModuleAccess:
        () =>
        (required = []) =>
          required.every((c) => permissions.includes(c)),
    },
    '@/utils/router': { navigateTo: (url) => calls.navigate.push(url) },
    '../_shared/AdminUI': { withAccountScope: (c) => c, errorMessage: (e) => e.message },
    './chooseFiles': {
      chooseFiles: async () => [{ path: 'f', name: 'c.pdf', size: 1, mimeType: 'application/pdf' }],
    },
    './FolderTreeSheet': { FolderTreeSheet: 'FolderTreeSheet' },
    './index.module.scss': scss,
  })
  return {
    page,
    calls,
    list,
    fetcher: () => options.fetcher,
    invalidate: () => {
      version++
    },
  }
}

test('fetcher 把关键词与筛选映射为查询参数', async () => {
  const { fetcher, calls } = mount()
  const result = await fetcher()({
    page: 1,
    pageSize: 20,
    keyword: ' a ',
    filters: { folderId: 7, kind: 'image', status: '0' },
  })
  assert.deepEqual(calls.queries, [
    { page: 1, pageSize: 20, keyword: 'a', folderId: 7, kind: 'image', status: '0' },
  ])
  assert.deepEqual(result, { list: [], total: 0 })
})

test('列表行：缩略图、标题回退原始名、单行大小描述、仅禁用显示标签、点行进详情', async () => {
  const { page, calls } = mount()
  await page.settle()
  const cells = page.all('ManagementCell')
  assert.equal(cells.length, 2)
  assert.deepEqual(cells[0].props.thumb, { src: 'https://api.test/u/b.png', glyph: 'image' })
  assert.equal(cells[0].props.description, '1.2 MB')
  assert.equal(cells[0].props.tag, undefined)
  assert.equal(cells[1].props.title, '介绍.mp4')
  assert.deepEqual(cells[1].props.thumb, { src: undefined, glyph: 'video' })
  assert.ok(cells[1].props.tag)
  cells[0].props.onClick()
  assert.deepEqual(calls.navigate, ['/D?id=1'])
})

test('无 create 权限不显示上传；无 delete 权限不显示管理', async () => {
  const { page } = mount({ permissions: ['system:attachment:list'] })
  await page.settle()
  assert.equal(page.byLabel('上传'), undefined)
  assert.equal(page.byLabel('管理'), undefined)
})

test('上传面板：七牛选项只在配置七牛且有权限时出现', async () => {
  const off = mount()
  await off.page.settle()
  off.page.byLabel('上传').props.onClick()
  assert.equal(
    off.page.one('ActionSheet').props.items.some((i) => i.label === '上传到七牛云'),
    false,
  )
  const on = mount({ cloud: { provider: 'qiniu', domain: 'cdn.test' } })
  await on.page.settle()
  on.page.byLabel('上传').props.onClick()
  assert.ok(on.page.one('ActionSheet').props.items.some((i) => i.label === '上传到七牛云'))
})

test('上传图片到当前分组并刷新列表', async () => {
  const { page, calls, list } = mount()
  list.filters = { folderId: 7, kind: '', status: '' }
  await page.settle()
  page.byLabel('上传').props.onClick()
  page
    .one('ActionSheet')
    .props.items.find((i) => i.label === '图片')
    .onClick()
  await page.settle()
  assert.deepEqual(calls.uploads, [
    { name: 'a.png', meta: { folderId: 7, kind: 'image' }, cloud: false },
  ])
  assert.ok(calls.toasts.includes('已上传 1 个文件'))
  assert.ok(list.refreshed >= 1)
})

test('链接导入带当前分组跳转', async () => {
  const { page, calls, list } = mount()
  list.filters = { folderId: 7, kind: '', status: '' }
  await page.settle()
  page.byLabel('上传').props.onClick()
  page
    .one('ActionSheet')
    .props.items.find((i) => i.label === '链接导入')
    .onClick()
  assert.deepEqual(calls.navigate, ['/I?folderId=7'])
})

test('多选删除：确认后批量删除并退出多选；取消确认不发请求', async () => {
  const { page, calls } = mount()
  await page.settle()
  page.byLabel('管理').props.onClick()
  page.rerender()
  page.byLabel('选择-banner.png').props.onClick()
  page.byLabel('选择-介绍.mp4').props.onClick()
  page.rerender()
  const footer = page.one('SelectionFooter')
  assert.equal(footer.props.count, 2)
  assert.equal(footer.props.confirmLabel, '删除')
  assert.equal(footer.props.confirmDanger, true)
  footer.props.onConfirm()
  await page.settle()
  assert.deepEqual(calls.deleted, [[1, 2]])
  assert.equal(page.one('SelectionFooter'), undefined)
  const cancelled = mount({ confirm: false })
  await cancelled.page.settle()
  cancelled.page.byLabel('管理').props.onClick()
  cancelled.page.rerender()
  cancelled.page.byLabel('选择-banner.png').props.onClick()
  cancelled.page.rerender()
  cancelled.page.one('SelectionFooter').props.onConfirm()
  await cancelled.page.settle()
  assert.deepEqual(cancelled.calls.deleted, [])
})

test('筛选或关键词变化清空已选', async () => {
  const { page, list } = mount()
  await page.settle()
  page.byLabel('管理').props.onClick()
  page.rerender()
  page.byLabel('选择-banner.png').props.onClick()
  page.rerender()
  assert.equal(page.one('SelectionFooter').props.count, 1)
  list.filters = { ...list.filters, kind: 'image' }
  await page.settle()
  assert.equal(page.one('SelectionFooter').props.count, 0)
})

test('分组筛选面板底部有「管理分组」入口，不依赖上传权限', async () => {
  const { page, calls } = mount({ permissions: ['system:attachment:list'] })
  await page.settle()
  const sheet = page.one('FolderTreeSheet')
  assert.equal(sheet.props.footer.label, '管理分组')
  sheet.props.footer.onClick()
  assert.deepEqual(calls.navigate, ['/F'])
})

test('上传中会话切换：停止后续文件且不 toast', async () => {
  const { page, calls } = mount({ session: true })
  await page.settle()
  page.byLabel('上传').props.onClick()
  page
    .one('ActionSheet')
    .props.items.find((i) => i.label === '图片')
    .onClick()
  await page.settle()
  assert.equal(calls.uploads.length, 1)
  assert.equal(calls.toasts.includes('已上传 1 个文件'), false)
})

test('选图期间会话结束：选完后不开始上传', async () => {
  let resolvePicker
  const picker = new Promise((resolve) => {
    resolvePicker = resolve
  })
  const { page, calls, invalidate } = mount({ taro: { chooseImage: () => picker } })
  await page.settle()
  page.byLabel('上传').props.onClick()
  page
    .one('ActionSheet')
    .props.items.find((i) => i.label === '图片')
    .onClick()
  invalidate()
  resolvePicker({ tempFiles: [{ path: '/image.jpg', size: 10, type: 'image/jpeg' }] })
  await page.settle()
  assert.deepEqual(calls.uploads, [])
  assert.deepEqual(calls.toasts, [])
})

test('批量上传中会话结束：不再发送后续文件', async () => {
  let finishFirst
  const first = new Promise((resolve) => {
    finishFirst = resolve
  })
  const { page, calls, invalidate } = mount({
    taro: {
      chooseImage: async () => ({
        tempFiles: [
          { path: '/one.jpg', size: 10 },
          { path: '/two.jpg', size: 10 },
        ],
      }),
    },
    upload: () => first,
  })
  await page.settle()
  page.byLabel('上传').props.onClick()
  page
    .one('ActionSheet')
    .props.items.find((i) => i.label === '图片')
    .onClick()
  await page.settle()
  assert.equal(calls.uploads.length, 1)
  invalidate()
  finishFirst([])
  await page.settle()
  assert.equal(calls.uploads.length, 1)
  assert.deepEqual(calls.toasts, [])
})

test('多选时点整行（含复选框区域）切换一次，Cell 与复选框不再各自响应', async () => {
  const { page, calls } = mount()
  await page.settle()
  assert.equal(page.byLabel('选择-banner.png'), undefined)
  page.byLabel('管理').props.onClick()
  page.rerender()
  const row = page.byLabel('选择-banner.png')
  assert.equal(row.props.className, 'selectRow')
  // 只有外层行响应点击：内层 Cell 与 Checkbox 没有 onClick，冒泡不会重复切换
  assert.equal(page.all('ManagementCell')[0].props.onClick, undefined)
  assert.equal(page.all('Checkbox')[0].props.onClick, undefined)
  row.props.onClick()
  page.rerender()
  assert.equal(page.one('SelectionFooter').props.count, 1)
  assert.equal(page.byLabel('选择-banner.png').props['aria-checked'], true)
  page.byLabel('选择-banner.png').props.onClick()
  page.rerender()
  assert.equal(page.one('SelectionFooter').props.count, 0)
  assert.deepEqual(calls.navigate, [])
})
