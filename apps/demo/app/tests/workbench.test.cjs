const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const { loadTs, deferred, appRoot } = require('./helpers/load-ts.cjs')

const registry = loadTs('src/modules/registry.ts')

test('工作台搜索与管理页同一套线框搜索', () => {
  const page = fs.readFileSync(path.join(appRoot, 'src/pages/apps/index.tsx'), 'utf8')
  const scss = fs.readFileSync(path.join(appRoot, 'src/pages/apps/index.module.scss'), 'utf8')
  // 页面不再自绘搜索框：直接复用 ManagementSearchBar，线框搜索图标由它内部渲染。
  // 断言仍要覆盖「同一套线框搜索」，所以同时钉住共享组件的实现，而不是只钉页面。
  assert.match(page, /<ManagementSearchBar\b/, '应复用共享搜索框')
  assert.doesNotMatch(page, /<Input\b/, '不应再自绘搜索输入')
  const shared = fs.readFileSync(
    path.join(appRoot, 'src/components/management/ManagementSearch.tsx'),
    'utf8',
  )
  assert.match(shared, /<LineIcon name="search"/, '共享搜索框内部使用 LineIcon search')
  assert.doesNotMatch(scss, /apps__searchIcon/, '不应再内嵌另一套搜索图标')
  assert.doesNotMatch(scss, /apps__searchWrap/, '私有的搜索外框已由共享 ManagementSearchBar 取代')
})

test('工作台自绘页头用全局安全区变量避让 H5 刘海', () => {
  const scss = fs.readFileSync(path.join(appRoot, 'src/pages/apps/index.module.scss'), 'utf8')
  assert.match(scss, /\.apps__top \{[\s\S]*?--safe-area-top/, 'H5 自绘页头需避让安全区')
})
const menu = (overrides = {}) => ({
  id: 1,
  parentId: 10,
  type: 1,
  name: '用户管理',
  page: 'pages/system/user/index',
  moduleId: 'core',
  sortOrder: 10,
  status: '1',
  ...overrides,
})
const contacts = (overrides = {}) =>
  menu({ id: 2, name: '通讯录', page: 'pages/contacts/index/index', ...overrides })
const directory = (overrides = {}) => ({
  id: 10,
  type: 0,
  name: '企业管理',
  moduleId: 'core',
  sortOrder: 10,
  status: '1',
  children: [menu()],
  ...overrides,
})
const ALL_PERMISSIONS = ['system:user:list', 'app:contacts:dept-tree']

test('catalog keeps the server group/entry order, names and icons, deduplicating pages', () => {
  const groups = registry.getWorkbenchGroups(
    [
      directory({
        id: 20,
        name: '协作',
        children: [
          contacts({ id: 21, name: '企业通讯录', icon: 'users' }),
          menu({ id: 22 }),
          menu({ id: 23, page: 'pages/not-built/index' }),
        ],
      }),
      directory({ id: 30, name: '重复目录', children: [menu({ id: 31 })] }),
    ],
    ALL_PERMISSIONS,
    [],
  )
  assert.deepEqual(
    groups.map((g) => [g.name, g.apps.map((a) => a.id)]),
    [['协作', ['contacts', 'system-user']]],
  )
  const first = groups[0].apps[0]
  assert.equal(first.name, '企业通讯录')
  assert.equal(first.icon, 'users')
  assert.equal(first.entry, 'pages/contacts/index/index')
})

test('entries the user lacks permission for are hidden and search stays local', () => {
  const menus = [directory({ children: [menu(), contacts()] })]
  assert.deepEqual(registry.getWorkbenchGroups(menus, [], []), [])
  assert.equal(
    registry.getWorkbenchGroups(menus, ALL_PERMISSIONS, [], '用户')[0].apps[0].id,
    'system-user',
  )
  assert.equal(
    registry.getWorkbenchGroups(menus, ALL_PERMISSIONS, [], 'contacts')[0].apps[0].id,
    'contacts',
  )
  assert.equal(
    registry.getWorkbenchGroups(menus, ALL_PERMISSIONS, [], ' 用 户 ')[0].apps[0].id,
    'system-user',
  )
  assert.equal(
    registry.getWorkbenchGroups(menus, ALL_PERMISSIONS, [], 'USER')[0].apps[0].id,
    'system-user',
  )
  assert.deepEqual(registry.getWorkbenchGroups(menus, ALL_PERMISSIONS, [], '不存在'), [])
})

test('unregistered and disabled entries are hidden and never invent routes', () => {
  const menus = [
    directory({
      children: [
        menu({ id: 2, name: '角色管理', page: 'pages/system/role/index' }),
        menu({ id: 3, name: '部门管理', page: 'pages/system/dept/index' }),
        menu({ id: 4, name: '重复角色', page: 'pages/system/role/index' }),
        menu({ id: 6, page: 'pages/contacts/index/index', status: '0' }),
      ],
    }),
  ]
  assert.deepEqual(
    registry.getWorkbenchGroups(menus, [...ALL_PERMISSIONS, 'system:department:list', 'system:role:list'], [])[0].apps.map((app) => app.id),
    ['system-role', 'system-dept'],
  )
  assert.deepEqual(registry.getAuthorizedMobileModules(menus, ALL_PERMISSIONS, []), [])
})

test('implemented system entries are registered and respect real backend permissions', () => {
  const baseEntries = [
    ['system-role', 'pages/system/role/index', '角色管理'],
    ['system-dept', 'pages/system/dept/index', '部门管理'],
    ['system-position', 'pages/system/position/index', '岗位管理'],
    ['system-menu', 'pages/system/menu/index', '菜单管理'],
    ['system-app-menu', 'pages/system/app-menu/index', '工作台配置'],
    ['system-dict', 'pages/system/dict/index', '字典管理'],
    ['system-region', 'pages/system/region/index', '地区管理'],
    ['system-site', 'pages/system/site/index', '站点配置'],
    ['system-storage', 'pages/system/storage/index', '云存储'],
    ['system-attachments', 'pages/system/attachments/index', '媒体库'],
    ['system-login-log', 'pages/system/login-log/index', '登录日志'],
  ]
  const menus = [directory({ children: baseEntries.map(([_id, page, name], index) => menu({
    id: 100 + index, name, page, permissions: undefined,
  })) })]
  const groups = registry.getWorkbenchGroups(menus, [
    'system:role:list', 'system:department:list', 'system:position:list', 'system:menu:list',
    'system:app-menu:list', 'system:dict:list', 'region:tree', 'system:option:list',
    'system:storage:list', 'system:attachment:list', 'system:login-log:list',
  ], [])
  assert.deepEqual(groups[0].apps.map((app) => app.id), baseEntries.map(([id]) => id))
  assert.deepEqual(groups[0].apps.map((app) => app.entry), baseEntries.map(([, page]) => page))
})

test('an implemented registry entry still denies uncompiled or mobile-hidden routes', () => {
  const user = registry.getMobileModuleById('system-user')
  assert.equal(
    registry.isMobileModuleAuthorized(
      { ...user, entry: 'pages/missing/index' },
      [directory({ children: [menu({ page: 'pages/missing/index' })] })],
      ['system:user:list'],
    ),
    false,
  )
  assert.equal(
    registry.isMobileModuleAuthorized({ ...user, showInWorkbench: false }, [directory()], [
      'system:user:list',
    ]),
    false,
  )
  assert.deepEqual(
    registry.getAuthorizedMobileModules([menu({ parentId: undefined })], ['system:user:list']),
    [],
  )
})

test('business entries cannot skip the backend module enablement requirement', () => {
  const user = registry.getMobileModuleById('system-user')
  assert.equal(registry.isModuleEnabled({ ...user, backendModuleId: undefined }, ['crm']), false)
  assert.equal(registry.isModuleEnabled({ ...user, backendModuleId: 'crm' }, []), false)
  assert.equal(registry.isModuleEnabled({ ...user, backendModuleId: 'crm' }, ['crm']), true)
})

test('every registered main or subpackage page exists on disk', () => {
  global.defineAppConfig = (value) => value
  try {
    const config = loadTs('src/app.config.ts').default
    const pages = [
      ...config.pages,
      ...(config.subPackages || []).flatMap((p) => p.pages.map((page) => `${p.root}/${page}`)),
    ]
    for (const page of pages)
      assert.ok(fs.existsSync(path.join(appRoot, 'src', `${page}.tsx`)), page)
  } finally {
    delete global.defineAppConfig
  }
})

function harness() {
  let identity = {
    bootstrapped: true,
    token: 'one',
    user: { id: 1, permissions: [...ALL_PERMISSIONS] },
    enabledModuleIds: [],
  }
  const subscribers = []
  const auth = {
    getState: () => identity,
    subscribe: (fn) => subscribers.push(fn),
    setState(patch) {
      const previous = identity
      identity = { ...identity, ...patch }
      subscribers.forEach((fn) => {
        fn(identity, previous)
      })
    },
  }
  const api = {
    getAuthorizedMenuTree: async () => [directory({ children: [menu(), contacts()] })],
    getHomeApps: async () => ({ pinned: [], ranked: [1, 2] }),
    saveHomePins: async (menuIds) => ({ pinned: [...menuIds], ranked: [] }),
    reportAppUsage: async () => ({ recorded: true }),
  }
  const authApi = {
    getCurrentUser: async () => identity.user,
    getCapabilities: async () => ({ permissions: identity.user.permissions, enabledModuleIds: [] }),
  }
  const store = loadTs('src/stores/modules.ts', {
    '@/api': { menuApi: api, authApi },
    './auth': {
      useAuthStore: auth,
      loadIdentity: async () => {
        const [user, capabilities] = await Promise.all([
          authApi.getCurrentUser(),
          authApi.getCapabilities(),
        ])
        return {
          user: { ...user, permissions: capabilities.permissions },
          enabledModuleIds: capabilities.enabledModuleIds,
        }
      },
    },
  }).useModuleStore
  return { store, auth, api, authApi }
}

test('load fetches menus and home apps together; a failing home list keeps menus usable', async () => {
  const h = harness()
  await h.store.getState().load()
  assert.deepEqual(h.store.getState().home, { pinned: [], ranked: [1, 2] })
  assert.equal(h.store.getState().menus[0].children.length, 2)
  h.api.getHomeApps = async () => {
    throw new Error('404')
  }
  await h.store.getState().load({ force: true })
  assert.equal(h.store.getState().error, null)
  assert.deepEqual(h.store.getState().home, { pinned: [], ranked: [1, 2] }, 'keeps the last good home list')
  h.store.getState().reset()
  await h.store.getState().load()
  assert.equal(h.store.getState().home, null)
  assert.equal(h.store.getState().loaded, true)
})

test('savePins stores the server answer and refuses results that land after an account switch', async () => {
  const h = harness()
  await h.store.getState().load()
  await h.store.getState().savePins([2, 1])
  assert.deepEqual(h.store.getState().home, { pinned: [2, 1], ranked: [] })
  const pending = deferred()
  h.api.saveHomePins = () => pending.promise
  const saving = h.store.getState().savePins([1])
  const first = h.auth.getState().user
  h.auth.setState({ token: 'two', user: { ...first, id: 2 } })
  pending.resolve({ pinned: [1], ranked: [] })
  await assert.rejects(saving, /登录状态已变化/)
  assert.equal(h.store.getState().home, null)
})

test('an older load that lands after savePins keeps the freshly saved home', async () => {
  const h = harness()
  await h.store.getState().load()
  const pending = deferred()
  h.api.getHomeApps = () => pending.promise
  const loading = h.store.getState().load({ force: true })
  await h.store.getState().savePins([2])
  pending.resolve({ pinned: [], ranked: [1, 2] })
  await loading
  assert.deepEqual(h.store.getState().home, { pinned: [2], ranked: [] })
})

test('savePins requires a loaded catalog for the current account', async () => {
  const h = harness()
  await assert.rejects(h.store.getState().savePins([1]), /请刷新应用列表后重试/)
})

test('forced refresh updates permissions and menus together; failure keeps prior content', async () => {
  const h = harness()
  await h.store.getState().load()
  h.authApi.getCapabilities = async () => ({
    permissions: [...ALL_PERMISSIONS],
    enabledModuleIds: [],
  })
  await h.store.getState().load({ force: true })
  h.authApi.getCapabilities = async () => ({ permissions: [], enabledModuleIds: [] })
  await h.store.getState().load({ force: true })
  assert.deepEqual(h.auth.getState().user.permissions, [])
  h.api.getAuthorizedMenuTree = async () => {
    throw new Error('offline')
  }
  await h.store.getState().load({ force: true })
  assert.equal(h.store.getState().loaded, true)
  assert.equal(h.store.getState().menus[0].children.length, 2)
  assert.equal(h.store.getState().error, 'offline')
})

test('late refresh from a signed-out account cannot update capabilities or preferences', async () => {
  const h = harness()
  await h.store.getState().load()
  const pending = deferred()
  h.authApi.getCapabilities = () => pending.promise
  const request = h.store.getState().load({ force: true })
  h.auth.setState({ token: null, user: null, enabledModuleIds: null })
  pending.resolve({ permissions: ['system:user:list'], enabledModuleIds: ['demo'] })
  await request
  assert.equal(h.auth.getState().user, null)
  assert.deepEqual(h.store.getState().menus, [])
})

test('navigation refreshes authorization, refuses revoked apps and blocks consecutive clicks', async () => {
  const h = harness()
  const calls = []
  const pending = deferred()
  const navigation = loadTs('src/pages/apps/navigation.ts', {
    '@/api': { menuApi: h.api },
    '@/stores/auth': { useAuthStore: h.auth },
    '@/stores/modules': { useModuleStore: h.store },
    '@/utils/router': {
      navigateTo: (url) => {
        calls.push(url)
        return pending.promise
      },
    },
  })
  const first = navigation.openWorkbenchApp('system-user')
  await navigation.openWorkbenchApp('system-user')
  await new Promise((resolve) => setImmediate(resolve))
  assert.deepEqual(calls, ['/pages/system/user/index'])
  pending.resolve()
  await first
  h.authApi.getCapabilities = async () => ({ permissions: [], enabledModuleIds: [] })
  await assert.rejects(navigation.openWorkbenchApp('contacts'), /权限|不可用/)
  assert.deepEqual(calls, ['/pages/system/user/index'])
})

test('workbench and profile refresh share identity requests so older permissions cannot overwrite newer ones', async () => {
  const pending = deferred()
  let capabilityCalls = 0
  const user = { id: 1, permissions: ['system:user:list'] }
  const api = {
    getCurrentUser: async () => user,
    getCapabilities: () => {
      capabilityCalls++
      return pending.promise
    },
  }
  const saved = new Map()
  const storage = {
    get: (key) => saved.get(key) ?? null,
    set: (key, value) => saved.set(key, value),
    remove: (key) => saved.delete(key),
  }
  const authModule = loadTs('src/stores/auth.ts', {
    '../api/auth': api,
    '../api/client': {
      getSessionVersion: () => 0,
      invalidateSessionRequests() {},
      setTokenRefreshedHandler() {},
      setUnauthorizedHandler() {},
    },
    '../utils/router': { redirectToLogin() {} },
    '../utils/storage': { storage, STORAGE_KEYS: {} },
  })
  authModule.useAuthStore.setState({
    user,
    token: 'one',
    bootstrapped: true,
    enabledModuleIds: [],
  })
  const modules = loadTs('src/stores/modules.ts', {
    '@/api': { authApi: api, menuApi: { getAuthorizedMenuTree: async () => [directory()] } },
    './auth': authModule,
    '@/config': { API_BASE_URL: 'https://tenant-a.example' },
    '@/utils/storage': { storage },
  }).useModuleStore
  const profile = authModule.useAuthStore.getState().refreshMe()
  const workbench = modules.getState().load({ force: true })
  assert.equal(capabilityCalls, 1)
  pending.resolve({ permissions: [], enabledModuleIds: [] })
  await Promise.all([profile, workbench])
  await modules.getState().load()
  assert.deepEqual(authModule.useAuthStore.getState().user.permissions, [])
})

test('entries without a registered mobile page never become favorites or navigate', async () => {
  const h = harness()
  h.api.getAuthorizedMenuTree = async () => [
    directory({ children: [menu({ id: 8, name: '角色管理', page: 'pages/system/role/index' })] }),
  ]
  await h.store.getState().load()
  const groups = registry.getWorkbenchGroups(h.store.getState().menus, ALL_PERMISSIONS, [])
  assert.deepEqual(registry.getHomeApps(groups, { pinned: [8], ranked: [] }), [])
  const navigation = loadTs('src/pages/apps/navigation.ts', {
    '@/api': { menuApi: h.api },
    '@/stores/auth': { useAuthStore: h.auth },
    '@/stores/modules': { useModuleStore: h.store },
    '@/utils/router': {
      navigateTo: () => {
        throw new Error('Unregistered entries must never navigate')
      },
    },
  })
  await assert.rejects(navigation.openWorkbenchApp('menu-8'), /不可用/)
})

test('opening an app reports usage once after navigation; reporting failures are swallowed', async () => {
  const h = harness()
  const reported = []
  h.api.reportAppUsage = async (menuId) => {
    reported.push(menuId)
    throw new Error('offline')
  }
  const calls = []
  const navigation = loadTs('src/pages/apps/navigation.ts', {
    '@/api': { menuApi: h.api },
    '@/stores/auth': { useAuthStore: h.auth },
    '@/stores/modules': { useModuleStore: h.store },
    '@/utils/router': { navigateTo: async (url) => calls.push(url) },
  })
  await navigation.openWorkbenchApp('contacts')
  await new Promise((resolve) => setImmediate(resolve))
  assert.deepEqual(calls, ['/pages/contacts/index/index'])
  assert.deepEqual(reported, [2])
})

test('a refused app is never reported', async () => {
  const h = harness()
  const reported = []
  h.api.reportAppUsage = async (menuId) => reported.push(menuId)
  h.authApi.getCapabilities = async () => ({ permissions: [], enabledModuleIds: [] })
  const navigation = loadTs('src/pages/apps/navigation.ts', {
    '@/api': { menuApi: h.api },
    '@/stores/auth': { useAuthStore: h.auth },
    '@/stores/modules': { useModuleStore: h.store },
    '@/utils/router': { navigateTo: async () => undefined },
  })
  await assert.rejects(navigation.openWorkbenchApp('contacts'), /权限|不可用/)
  assert.deepEqual(reported, [])
})
