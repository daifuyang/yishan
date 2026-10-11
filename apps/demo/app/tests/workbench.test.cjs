const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const { loadTs, deferred, appRoot } = require('./helpers/load-ts.cjs')

const registry = loadTs('src/modules/registry.ts')
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
  const saved = new Map()
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
    '@/config': { API_BASE_URL: 'https://tenant-a.example' },
    '@/utils/storage': {
      storage: { get: (key) => saved.get(key) ?? null, set: (key, value) => saved.set(key, value) },
    },
  }).useModuleStore
  return { store, auth, api, authApi, saved }
}

test('favorites default to accessible apps, persist edited order and respect explicit empty selection', async () => {
  const h = harness()
  await h.store.getState().load()
  assert.deepEqual(h.store.getState().commonModuleIds, ['system-user', 'contacts'])
  assert.equal(typeof h.store.getState().setCommonModules, 'function')
  h.store.getState().setCommonModules(['contacts', 'system-user', 'contacts', 'not-built'])
  assert.deepEqual(h.store.getState().commonModuleIds, ['contacts', 'system-user'])
  h.store.getState().reset()
  await h.store.getState().load()
  assert.deepEqual(h.store.getState().commonModuleIds, ['contacts', 'system-user'])
  h.store.getState().setCommonModules([])
  h.store.getState().reset()
  await h.store.getState().load()
  assert.deepEqual(h.store.getState().commonModuleIds, [])
})

test('account switches restore only that account preferences and revoked apps disappear', async () => {
  const h = harness()
  await h.store.getState().load()
  h.store.getState().setCommonModules(['contacts'])
  const first = h.auth.getState().user
  h.auth.setState({ token: 'two', user: { ...first, id: 2 } })
  await h.store.getState().load()
  assert.deepEqual(h.store.getState().commonModuleIds, ['system-user', 'contacts'])
  h.store.getState().setCommonModules(['system-user'])
  h.auth.setState({ token: 'one', user: first })
  await h.store.getState().load()
  assert.deepEqual(h.store.getState().commonModuleIds, ['contacts'])
  h.auth.setState({ user: { ...first, permissions: ['system:user:list'] } })
  h.api.getAuthorizedMenuTree = async () => [directory()]
  await h.store.getState().load()
  assert.deepEqual(h.store.getState().commonModuleIds, [])
  assert.ok(
    [...h.saved.keys()].every((key) =>
      key.includes(encodeURIComponent('https://tenant-a.example')),
    ),
  )
})

test('forced refresh updates permissions and menus together; failure keeps prior content', async () => {
  const h = harness()
  await h.store.getState().load()
  h.authApi.getCapabilities = async () => ({
    permissions: [...ALL_PERMISSIONS],
    enabledModuleIds: [],
  })
  await h.store.getState().load({ force: true })
  assert.deepEqual(h.store.getState().commonModuleIds, ['system-user', 'contacts'])
  h.authApi.getCapabilities = async () => ({ permissions: [], enabledModuleIds: [] })
  await h.store.getState().load({ force: true })
  assert.deepEqual(h.auth.getState().user.permissions, [])
  assert.deepEqual(h.store.getState().commonModuleIds, [])
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
  assert.deepEqual(modules.getState().commonModuleIds, [])
})

test('entries without a registered mobile page never become favorites or navigate', async () => {
  const h = harness()
  h.api.getAuthorizedMenuTree = async () => [
    directory({ children: [menu({ id: 8, name: '角色管理', page: 'pages/system/role/index' })] }),
  ]
  await h.store.getState().load()
  assert.deepEqual(h.store.getState().commonModuleIds, [])
  const navigation = loadTs('src/pages/apps/navigation.ts', {
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
