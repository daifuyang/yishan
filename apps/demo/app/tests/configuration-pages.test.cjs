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
    '@/utils/account-scope': {
      withAccountScope: (component) => component,
      errorMessage: (error) => error.message,
    },
    './index.module.scss': {},
    '../form.module.scss': {},
    './LogoField.module.scss': {},
    './ConnectionTest.module.scss': {},
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

function logoHarness({ value = '', disabled = false, canUpload = true, chooseImage, uploadAttachment } = {}) {
  const changes = []
  const errors = []
  const picks = []
  const uploads = []
  const states = []
  const refs = []
  let stateIndex = 0
  let refIndex = 0
  const component = loadTs('src/pages/system/site/basic/LogoField.tsx', {
    react: {
      useState(initial) {
        const index = stateIndex++
        if (!(index in states)) states[index] = initial
        return [states[index], (next) => { states[index] = next }]
      },
      useRef(initial) {
        const index = refIndex++
        refs[index] ||= { current: initial }
        return refs[index]
      },
    },
    '@tarojs/components': { View: 'View', Text: 'Text', Image: 'Image' },
    '@tarojs/taro': { chooseImage: (options) => {
      picks.push(options)
      return chooseImage ? chooseImage(options) : Promise.resolve({ tempFiles: [{ path: '/tmp/logo.png', size: 10, type: 'image/png' }] })
    } },
    '@/api/admin/attachments': {
      uploadAttachment: async (file, options) => {
        uploads.push({ file, options })
        return uploadAttachment ? uploadAttachment(file, options) : [{ url: 'https://example.com/logo.png' }]
      },
      attachmentUrl: () => 'https://example.com/local-logo.png',
    },
    '@/components/management': { FormField: 'FormField', LineIcon: 'LineIcon', ActionSheet: 'ActionSheet' },
    '@/components/atoms': { Button: 'Button' },
    '@/hooks': { useCanWrite: () => canUpload },
    '@/utils/account-scope': { errorMessage: (reason) => reason.message },
    './LogoField.module.scss': { logo: 'logo' },
  }).LogoField
  const render = () => {
    stateIndex = 0
    refIndex = 0
    return nodes(component({ value, disabled, onChange: (next) => { value = next; changes.push(next) }, onError: (message) => errors.push(message) }))
  }
  return {
    render, changes, errors, picks, uploads,
    field: () => render().find((node) => node.type === 'FormField'),
    valueArea: () => render().find((node) => node.props?.className === 'logo'),
    remove: () => render().find((node) => node.type === 'Button' && node.props.children === '移除 Logo'),
    settle: () => new Promise((resolve) => setImmediate(resolve)),
  }
}

test('Logo 值区和箭头直接从相册选图并写入上传地址', async () => {
  for (const entry of ['value', 'arrow']) {
    const h = logoHarness()
    const click = entry === 'value' ? h.valueArea().props.onClick : h.field().props.onArrowClick
    click()
    assert.deepEqual(h.picks, [{ count: 1, sizeType: ['compressed'], sourceType: ['album'] }])
    await h.settle()
    assert.deepEqual(h.uploads, [{ file: { path: '/tmp/logo.png', name: 'logo.png', size: 10, mimeType: 'image/png' }, options: { kind: 'image' } }])
    assert.deepEqual(h.changes, ['https://example.com/logo.png'])
    assert.deepEqual(h.errors, [])
  }
})

test('Logo 选图与上传期间拦截重复点击及移除，完成后恢复操作', async () => {
  const picked = deferred()
  const uploaded = deferred()
  const h = logoHarness({ value: 'https://example.com/old.png', chooseImage: () => picked.promise, uploadAttachment: () => uploaded.promise })
  const click = h.valueArea().props.onClick
  const remove = h.remove().props.onClick
  click()
  click()
  remove()
  assert.equal(h.picks.length, 1)
  assert.deepEqual(h.changes, [])
  picked.resolve({ tempFiles: [{ path: '/tmp/new.png', size: 20, type: 'image/png' }] })
  await h.settle()
  assert.equal(h.remove().props.disabled, true)
  click()
  remove()
  assert.equal(h.picks.length, 1)
  assert.equal(h.uploads.length, 1)
  assert.deepEqual(h.changes, [])
  uploaded.resolve([{ url: 'https://example.com/new.png' }])
  await h.settle()
  assert.equal(h.remove().props.disabled, false)
  h.remove().props.onClick()
  assert.deepEqual(h.changes, ['https://example.com/new.png', ''])
  assert.equal(h.picks.length, 1, '移除不会选图')
})

test('Logo 选图取消不上传、不报错，并允许再次选图', async () => {
  const h = logoHarness({ value: '/old.png', chooseImage: async () => { throw { errMsg: 'chooseImage:fail cancel' } } })
  h.valueArea().props.onClick()
  await h.settle()
  h.valueArea().props.onClick()
  await h.settle()
  assert.equal(h.picks.length, 2)
  assert.deepEqual(h.uploads, [])
  assert.deepEqual(h.changes, [])
  assert.deepEqual(h.errors, [])
})

test('Logo 上传失败保留旧值并显示错误，允许重试', async () => {
  const h = logoHarness({ value: 'https://example.com/old.png', uploadAttachment: async () => { throw new Error('图片上传失败') } })
  h.valueArea().props.onClick()
  await h.settle()
  assert.deepEqual(h.changes, [])
  assert.deepEqual(h.errors, ['图片上传失败'])
  assert.equal(h.render().find((node) => node.type === 'Image').props.src, 'https://example.com/old.png')
  h.valueArea().props.onClick()
  await h.settle()
  assert.equal(h.uploads.length, 2)
})

test('Logo 无上传权限时值区与箭头不上传，已有 Logo 仍可单独移除', () => {
  const h = logoHarness({ value: '/old.png', canUpload: false })
  h.valueArea().props.onClick?.()
  h.field().props.onArrowClick?.()
  assert.equal(h.field().props.arrow, false)
  assert.deepEqual(h.picks, [])
  assert.ok(h.remove())
  assert.equal(nodes(h.valueArea()).some((node) => node.type === 'Button'), false, '移除按钮位于上传区外')
  h.remove().props.onClick()
  assert.deepEqual(h.changes, [''])
  assert.equal(h.remove(), undefined)
  assert.deepEqual(h.picks, [])
})

test('Logo 禁用时上传与移除均不可操作', () => {
  const h = logoHarness({ value: '/old.png', disabled: true })
  h.valueArea().props.onClick?.()
  h.field().props.onArrowClick?.()
  assert.equal(h.remove().props.disabled, true)
  h.remove().props.onClick?.()
  assert.deepEqual(h.picks, [])
  assert.deepEqual(h.changes, [])
})
