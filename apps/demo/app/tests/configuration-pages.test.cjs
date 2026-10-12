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
    '@tarojs/components': { View: 'View', Text: 'Text', Image: 'Image', Input: 'Input' },
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
    '@/utils/router': { navigateTo: () => {}, navigateBack: () => {} },
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
        'ActionSheet',
        'EnumField',
        'FormError',
        'SecretField',
        'SwitchField',
        'FormContent',
        'FormField',
        'FormSection',
        'FormSubmitBar',
        'LineIcon',
        'TextAreaField',
        'TextField',
      ].map((name) => [name, name]),
    ),
    '@/components/atoms': { Button: 'Button', Tag: 'Tag' },
    '@/components/molecules': { FormField: 'FormField', PageHeader: 'PageHeader' },
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
    '../form.module.scss': {},
    './LogoField.module.scss': {},
    './ConnectionTest.module.scss': {},
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
      ['site', 'storage', 'region', 'module-management'].includes(page) ? 'ManagementPage' : 'AdminPage',
    )
    await harness.settle()
    assert.equal(calls, 0)
  }
})

const fieldControl = (tree, label) =>
  tree.find((node) => node.type === 'FormField' && node.props.label === label).props.children

test('site overview lists only the categories backed by basicConfig', async () => {
  const harness = pageHarness('site', {
    getSiteConfig: async () => ({ siteName: 'Demo', siteDomain: 'https://example.com/', siteLogo: '' }),
  })
  harness.render()
  const tree = await harness.settle()
  const hero = tree.find((node) => node.type === 'DetailHero').props
  assert.equal(hero.title, 'Demo')
  assert.equal(hero.subtitle, 'example.com')
  assert.deepEqual(
    tree.filter((node) => node.type === 'ManagementCell').map((node) => node.props.title),
    ['基础信息', 'SEO 优化', '备案与页脚'],
  )
})

test('read-only site access hides save action after configuration loads', async () => {
  const harness = pageHarness(
    'site/basic',
    { getSiteConfig: async () => ({ siteName: 'Demo', siteDomain: '', siteFavicon: '', contactPhone: '', contactEmail: '', contactAddress: '', siteLogo: '' }) },
    { write: false },
  )
  harness.render()
  const tree = await harness.settle()
  assert.equal(tree.some((node) => node.type === 'FormSubmitBar'), false)
  assert.equal(
    tree.filter((node) => node.type === 'TextField').every((node) => node.props.disabled),
    true,
  )
})

test('site basic save rejects a blank name before calling the API', async () => {
  let saves = 0
  const harness = pageHarness('site/basic', {
    getSiteConfig: async () => ({ ...emptySite(), siteName: 'Old' }),
    updateSiteConfig: async () => {
      saves++
    },
  })
  harness.render()
  let tree = await harness.settle()
  fieldControl(tree, '站点名称').props.onChange('  ')
  tree = harness.render()
  await tree.find((node) => node.type === 'FormSubmitBar').props.onSubmit()
  tree = harness.render()
  assert.equal(saves, 0)
  assert.equal(tree.some((node) => node.type === 'FormError' && node.props.children === '请输入站点名称'), true)
})

test('site save sends only its own fields, locks duplicate submits and keeps edits after failure', async () => {
  const pending = deferred()
  const patches = []
  const harness = pageHarness('site/seo', {
    getSiteConfig: async () => ({ ...emptySite(), siteName: 'Demo', siteTitle: 'Old' }),
    updateSiteConfig: async (patch) => {
      patches.push(patch)
      return pending.promise
    },
  })
  harness.render()
  let tree = await harness.settle()
  fieldControl(tree, '站点标题').props.onChange('New')
  tree = harness.render()
  const submit = tree.find((node) => node.type === 'FormSubmitBar').props.onSubmit
  submit()
  submit()
  assert.equal(patches.length, 1)
  assert.deepEqual(patches[0], { siteTitle: 'New', seoKeywords: '', seoDescription: '' })
  pending.reject(new Error('保存失败'))
  await new Promise((resolve) => setImmediate(resolve))
  tree = harness.render()
  assert.equal(fieldControl(tree, '站点标题').props.value, 'New')
  assert.equal(tree.some((node) => node.type === 'FormError' && node.props.children === '保存失败'), true)
})

const qiniuStored = () => ({
  provider: 'qiniu',
  qiniu: { accessKey: 'ak', bucket: 'media', region: 'z1', domain: 'https://cdn.example.com', useHttps: true, tokenExpires: 3600 },
  aliyunOss: {},
})

test('storage overview summarises the active provider and only offers its categories', async () => {
  for (const [config, titles] of [
    [qiniuStored(), ['基础配置', '访问配置', '上传设置']],
    [{ provider: 'aliyunOss', qiniu: {}, aliyunOss: { bucket: 'b', region: 'oss-cn-hangzhou' } }, ['基础配置', '访问配置']],
    [{ provider: 'disabled', qiniu: {}, aliyunOss: {} }, ['基础配置']],
  ]) {
    const harness = pageHarness('storage', { getStorageConfig: async () => config })
    harness.render()
    const tree = await harness.settle()
    assert.deepEqual(tree.filter((node) => node.type === 'ManagementCell').map((node) => node.props.title), titles)
    if (config.provider === 'qiniu') {
      assert.equal(tree.find((node) => node.type === 'DetailHero').props.title, '七牛云')
      const rows = Object.fromEntries(tree.filter((node) => node.type === 'DetailRow').map((node) => [node.props.label, node.props.value]))
      assert.deepEqual(rows, { 空间: 'media', 区域: '华北', 访问域名: 'https://cdn.example.com' })
    }
  }
})

test('storage basic save submits only its own fields and keeps keys masked by default', async () => {
  const saved = []
  const harness = pageHarness('storage/basic', {
    getStorageConfig: async () => qiniuStored(),
    saveStorageConfig: async (config) => saved.push(config),
  })
  harness.render()
  let tree = await harness.settle()
  const secrets = tree.filter((node) => node.type === 'SecretField').map((node) => node.props.label)
  assert.deepEqual(secrets, ['AccessKey', 'SecretKey'])
  tree.find((node) => node.type === 'FormField' && node.props.label === 'Bucket').props.children.props.onChange('media-2')
  tree = harness.render()
  await tree.find((node) => node.type === 'FormSubmitBar').props.onSubmit()
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(saved.length, 1)
  assert.deepEqual(Object.keys(saved[0].qiniu).sort(), ['accessKey', 'bucket', 'region', 'secretKey'])
  assert.equal(saved[0].qiniu.bucket, 'media-2')
})

test('storage switching provider asks first and cannot submit after its page session ends', async () => {
  const confirmation = deferred()
  let saves = 0
  const harness = pageHarness(
    'storage/basic',
    { getStorageConfig: async () => qiniuStored(), saveStorageConfig: async () => { saves++ } },
    { confirm: () => confirmation.promise },
  )
  harness.render()
  let tree = await harness.settle()
  tree.find((node) => node.type === 'EnumField' && node.props.label === '存储服务商').props.onChange('disabled')
  tree = harness.render()
  tree.find((node) => node.type === 'FormSubmitBar').props.onSubmit()
  harness.invalidate()
  confirmation.resolve(true)
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(saves, 0)
})

test('storage connection test reports the probe result and drops it once the draft changes', async () => {
  const drafts = []
  const harness = pageHarness('storage/basic', {
    getStorageConfig: async () => qiniuStored(),
    testStorageConnection: async (config) => {
      drafts.push(config)
      return { ok: false, provider: 'qiniu', bucket: 'media', latencyMs: 120, message: 'AccessKey 或 SecretKey 不正确' }
    },
  })
  harness.render()
  let tree = await harness.settle()
  tree.find((node) => node.type?.name === 'ConnectionTest').props.onTest()
  await new Promise((resolve) => setImmediate(resolve))
  tree = harness.render()
  assert.equal(drafts[0].qiniu.bucket, 'media')
  assert.equal(tree.find((node) => node.type?.name === 'ConnectionTest').props.result.latencyMs, 120)
  tree.find((node) => node.type === 'SecretField' && node.props.label === 'SecretKey').props.onChange('new-secret')
  tree = harness.render()
  assert.equal(tree.find((node) => node.type?.name === 'ConnectionTest').props.result, null)
})

test('storage upload settings validate the token lifetime before saving', async () => {
  let saves = 0
  const harness = pageHarness('storage/upload', {
    getStorageConfig: async () => qiniuStored(),
    saveStorageConfig: async () => { saves++ },
  })
  harness.render()
  let tree = await harness.settle()
  tree.find((node) => node.type === 'FormField' && node.props.label === '有效期(秒)').props.children.props.onChange('30')
  tree = harness.render()
  await tree.find((node) => node.type === 'FormSubmitBar').props.onSubmit()
  tree = harness.render()
  assert.equal(saves, 0)
  assert.equal(tree.find((node) => node.type === 'FormError').props.children, '凭证有效期须为 60–86400 秒的整数')
})

function emptySite() {
  return loadTs('src/api/admin/site.ts', { '../client': {} }).emptySiteConfig()
}
