const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTs, deferred } = require('./helpers/load-ts.cjs')

function nodes(tree) {
  if (!tree || typeof tree !== 'object') return []
  if (Array.isArray(tree)) return tree.flatMap(nodes)
  return [tree, ...nodes(tree.props?.children)]
}

function pageHarness(
  page,
  api,
  { allowed = true, write = true, confirm = async () => true, taro = {} } = {},
) {
  let current = true
  const states = []
  const refs = []
  const deps = []
  let effects = []
  let stateIndex = 0
  let refIndex = 0
  let effectIndex = 0
  const site = loadTs('src/api/admin/site.ts', { '../client': {} })
  const component = loadTs(`src/pages/system/${page}/index.tsx`, {
    react: {
      useState(initial) {
        const index = stateIndex++
        if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial
        return [
          states[index],
          (value) => {
            states[index] = typeof value === 'function' ? value(states[index]) : value
          },
        ]
      },
      useRef(initial) {
        const index = refIndex++
        refs[index] ||= { current: initial }
        return refs[index]
      },
      useEffect(effect, next) {
        const index = effectIndex++
        if (!deps[index] || next.some((value, n) => value !== deps[index][n])) {
          effects.push(effect)
          deps[index] = next
        }
      },
    },
    '@tarojs/components': { View: 'View', Text: 'Text' },
    '@tarojs/taro': {
      useRouter: () => ({ params: { id: 'demo' } }),
      useDidHide: () => {},
      useDidShow: () => {},
      usePullDownRefresh: () => {},
      useReachBottom: () => {},
      stopPullDownRefresh: async () => {},
      showToast: async () => {},
      ...taro,
    },
    '@/api/client': { getSessionVersion: () => (current ? 1 : 2) },
    '@/constants/routes': { SYSTEM_PAGES: {} },
    '@/utils/router': { navigateTo: () => {} },
    '@/components/management': Object.fromEntries(
      [
        'ManagementPage',
        'ManagementPageHeader',
        'ManagementFilterBar',
        'ManagementSearchBar',
        'ManagementStates',
        'ManagementList',
        'ManagementCell',
        'ManagementListFooter',
        'DetailContent',
        'DetailHero',
        'DetailSection',
        'DetailRow',
        'BottomActionBar',
      ].map((name) => [name, name]),
    ),
    '@/components/atoms': { Button: 'Button', Tag: 'Tag' },
    '@/components/molecules': { FormField: 'FormField' },
    '@/components/feedback': { StateView: 'StateView' },
    '@/hooks': {
      useCanWrite: () => write,
      confirmAction: confirm,
      useListPagination: () => ({
        list: [],
        total: 0,
        keyword: '',
        filters: {},
        finished: true,
        refresh: async () => {},
      }),
    },
    '@/utils/auth-guard': {
      useRequireAuth: () => ({ ready: true, allowed }),
      useCurrentModuleAccess: () => () => current && allowed,
      canWriteModuleNow: () => current && allowed && write,
    },
    '../../_shared/AdminUI': {
      withAccountScope: (component) => component,
      errorMessage: (error) => error.message,
    },
    './index.module.scss': {},
    '../_shared/AdminUI': {
      withAccountScope: (component) => component,
      AdminPage: 'AdminPage',
      AdminNotice: 'AdminNotice',
      AdminSelect: 'AdminSelect',
      errorMessage: (error) => error.message,
    },
    '@/api/admin/site': { ...site, ...api },
    '@/api/admin/storage': api,
    '@/api/admin/region': api,
    '@/api/admin/moduleManagement': api,
    '@/api/admin/attachments': {
      getFolderTree: async () => [],
      getCloudUploadConfig: async () => ({ provider: 'disabled' }),
      folderOptions: () => [],
      ...api,
    },
    './AttachmentCard': { __esModule: true, default: 'AttachmentCard' },
    './FolderForm': { __esModule: true, default: 'FolderForm', kindOptions: [] },
    './FileUpload': { __esModule: true, default: 'FileUpload' },
  }).default
  const render = () => {
    stateIndex = 0
    refIndex = 0
    effectIndex = 0
    return nodes(component())
  }
  const settle = async () => {
    const pending = effects
    effects = []
    for (const effect of pending) effect()
    await new Promise((resolve) => setImmediate(resolve))
    return render()
  }
  return {
    render,
    settle,
    invalidate: () => {
      current = false
    },
  }
}

test('storage disable confirmation cannot submit after its page session ends', async () => {
  const confirmation = deferred()
  let saves = 0
  const harness = pageHarness(
    'storage',
    {
      getStorageConfig: async () => ({ provider: 'disabled', qiniu: {}, aliyunOss: {} }),
      saveStorageConfig: async () => {
        saves++
        return { provider: 'disabled', qiniu: {}, aliyunOss: {} }
      },
    },
    { confirm: () => confirmation.promise },
  )
  harness.render()
  const tree = await harness.settle()
  const pending = tree
    .find((node) => node.type === 'Button' && node.props.children === '保存')
    .props.onClick()
  harness.invalidate()
  confirmation.resolve(true)
  await pending
  assert.equal(saves, 0)
})

test('module toggle confirmation cannot submit after its page session ends', async () => {
  const confirmation = deferred()
  let toggles = 0
  const harness = pageHarness(
    'module-management/detail',
    {
      listManagedModules: async () => ({
        items: [
          {
            id: 'demo',
            name: 'Demo',
            enabled: true,
            mounted: true,
            version: '1',
            routePrefix: '/api/demo',
            tablePrefix: 'demo_',
          },
        ],
      }),
      toggleModule: async () => {
        toggles++
      },
    },
    { confirm: () => confirmation.promise },
  )
  harness.render()
  const tree = await harness.settle()
  const pending = tree.find((node) => node.type === 'BottomActionBar').props.actions[0].onClick()
  harness.invalidate()
  confirmation.resolve(true)
  await pending
  assert.equal(toggles, 0)
})

test('image picker cannot begin an upload after its page session ends', async () => {
  const picker = deferred()
  let uploads = 0
  const harness = pageHarness(
    'attachments',
    {
      uploadAttachment: async () => {
        uploads++
      },
    },
    { taro: { chooseImage: () => picker.promise } },
  )
  harness.render()
  const tree = await harness.settle()
  const pending = tree
    .find((node) => node.type === 'Button' && node.props.children === '选择图片')
    .props.onClick()
  harness.invalidate()
  picker.resolve({ tempFiles: [{ path: '/image.jpg', size: 10, type: 'image/jpeg' }] })
  await pending
  assert.equal(uploads, 0)
})

test('batch upload does not send later files after its page session ends', async () => {
  const firstUpload = deferred()
  let uploads = 0
  const harness = pageHarness(
    'attachments',
    {
      uploadAttachment: async () => {
        uploads++
        return firstUpload.promise
      },
    },
    {
      taro: {
        chooseImage: async () => ({
          tempFiles: [
            { path: '/one.jpg', size: 10 },
            { path: '/two.jpg', size: 10 },
          ],
        }),
      },
    },
  )
  harness.render()
  const tree = await harness.settle()
  const pending = tree
    .find((node) => node.type === 'Button' && node.props.children === '选择图片')
    .props.onClick()
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(uploads, 1)
  harness.invalidate()
  firstUpload.resolve([])
  await pending
  assert.equal(uploads, 1)
})

test('configuration pages render access chrome without requesting data when denied', async () => {
  for (const page of ['site', 'storage', 'region', 'module-management']) {
    let calls = 0
    const request = () => {
      calls++
      return Promise.resolve([])
    }
    const harness = pageHarness(
      page,
      {
        getSiteConfig: request,
        getStorageConfig: request,
        getRegionTree: request,
        listManagedModules: request,
      },
      { allowed: false },
    )
    assert.equal(
      harness.render()[0].type,
      ['region', 'module-management'].includes(page) ? 'ManagementPage' : 'AdminPage',
    )
    await harness.settle()
    assert.equal(calls, 0)
  }
})

test('read-only site access hides save action after configuration loads', async () => {
  const harness = pageHarness(
    'site',
    { getSiteConfig: async () => ({ siteName: 'Demo' }) },
    { write: false },
  )
  harness.render()
  const tree = await harness.settle()
  assert.equal(
    tree.some((node) => node.type === 'Button' && node.props.children === '保存'),
    false,
  )
  assert.equal(
    tree.filter((node) => node.type === 'FormField').every((node) => node.props.disabled),
    true,
  )
})

test('site save locks duplicate submits and retains edited fields after failure', async () => {
  const pending = deferred()
  let saves = 0
  const harness = pageHarness('site', {
    getSiteConfig: async () => ({ siteName: 'Old' }),
    saveSiteConfig: async () => {
      saves++
      return pending.promise
    },
  })
  harness.render()
  let tree = await harness.settle()
  tree
    .find((node) => node.type === 'FormField' && node.props.label === '站点名称')
    .props.onInput('New')
  tree = harness.render()
  const submit = tree.find((node) => node.type === 'Button' && node.props.children === '保存').props
    .onClick
  const first = submit()
  await submit()
  assert.equal(saves, 1)
  pending.reject(new Error('保存失败'))
  await first
  tree = harness.render()
  assert.equal(
    tree.find((node) => node.type === 'FormField' && node.props.label === '站点名称').props.value,
    'New',
  )
  assert.equal(
    tree.some((node) => node.type === 'AdminNotice' && node.props.children === '保存失败'),
    true,
  )
})
