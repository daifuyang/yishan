const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const { loadTs, deferred, appRoot } = require('./helpers/load-ts.cjs')

const registry = loadTs('src/modules/registry.ts')
const menu = (overrides = {}) => ({
  id: 1,
  name: '用户管理',
  path: '/system/user',
  type: 1,
  status: '1',
  hideInMenu: false,
  isExternalLink: false,
  sort_order: 1,
  ...overrides,
})
const directory = (overrides = {}) =>
  menu({
    id: 10,
    name: '企业管理',
    path: '/system',
    type: 0,
    children: [menu()],
    ...overrides,
  })

test('catalog follows top-level menu categories and configured order, deduplicating entries', () => {
  assert.equal(typeof registry.getWorkbenchGroups, 'function')
  const groups = registry.getWorkbenchGroups(
    [
      directory({ sort_order: 20 }),
      directory({
        id: 20,
        name: '协作',
        sort_order: 10,
        children: [
          menu({ id: 21, path: '/contacts', name: '企业通讯录', sort_order: 2 }),
          menu({ id: 22, type: 2 }),
          menu({ id: 23, path: '/not-built' }),
        ],
      }),
      directory({ id: 30, name: '重复目录', sort_order: 30 }),
    ],
    ['system:user:list', 'app:contacts:dept-tree'],
    [],
  )
  assert.deepEqual(
    groups.map((g) => [g.name, g.apps.map((a) => a.id)]),
    [
      ['协作', ['menu-23', 'contacts']],
      ['企业管理', ['system-user']],
    ],
  )
  assert.equal(groups[0].apps.find((app) => app.id === 'contacts').name, '企业通讯录')
})

test('catalog previews returned menus without extra permission filtering and search stays local', () => {
  assert.equal(typeof registry.getWorkbenchGroups, 'function')
  const menus = [directory({ children: [menu(), menu({ id: 2, path: '/contacts' })] })]
  assert.equal(registry.getWorkbenchGroups(menus, [], [], '用户')[0].apps[0].id, 'system-user')
  assert.equal(
    registry.getWorkbenchGroups(menus, ['system:user:list'], [], 'contacts')[0].apps[0].id,
    'contacts',
  )
  assert.equal(
    registry.getWorkbenchGroups(menus, ['system:user:list'], [], ' 用 户 ')[0].apps[0].id,
    'system-user',
  )
  assert.equal(
    registry.getWorkbenchGroups(menus, ['system:user:list'], [], 'USER')[0].apps[0].id,
    'system-user',
  )
})

test('unadapted menus show searchable placeholder entries but never invent mobile routes', () => {
  const menus = [
    directory({
      children: [
        menu({ id: 2, name: '角色管理', path: '/system/role' }),
        menu({ id: 3, name: '部门管理', path: '/system/department' }),
        menu({ id: 4, name: '重复角色', path: '/system/role' }),
        menu({ id: 5, type: 2, name: '创建用户' }),
        menu({ id: 6, path: '/disabled', status: '0' }),
        menu({ id: 7, path: '/hidden', hideInMenu: true }),
      ],
    }),
  ]
  const apps = registry.getWorkbenchGroups(menus, [], []).flatMap((group) => group.apps)
  assert.deepEqual(
    apps.map((app) => app.name),
    ['角色管理', '部门管理'],
  )
  assert.ok(apps.every((app) => app.entry === undefined))
  assert.equal(registry.getWorkbenchGroups(menus, [], [], '角色')[0].apps.length, 1)
  assert.deepEqual(registry.getAuthorizedMobileModules(menus, [], []), [])
})

test('an implemented registry entry still denies uncompiled or mobile-hidden routes', () => {
  const user = registry.getMobileModuleById('system-user')
  assert.equal(
    registry.isMobileModuleAuthorized(
      { ...user, entry: 'pages/missing/index' },
      [menu()],
      ['system:user:list'],
    ),
    false,
  )
  assert.equal(
    registry.isMobileModuleAuthorized(
      { ...user, showInWorkbench: false },
      [menu()],
      ['system:user:list'],
    ),
    false,
  )
  assert.deepEqual(
    registry.getAuthorizedMobileModules(
      [menu({ type: 2, children: [menu()] })],
      ['system:user:list'],
    ),
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
    user: { id: 1, permissions: ['system:user:list', 'app:contacts:dept-tree'] },
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
    getAuthorizedMenuTree: async () => [menu(), menu({ id: 2, name: '通讯录', path: '/contacts' })],
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
  assert.equal(typeof h.store.getState().setCommonModules, 'function')
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
  h.api.getAuthorizedMenuTree = async () => [menu()]
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
  h.authApi.getCapabilities = async () => ({ permissions: [], enabledModuleIds: [] })
  await h.store.getState().load({ force: true })
  assert.deepEqual(h.auth.getState().user.permissions, [])
  assert.deepEqual(h.store.getState().commonModuleIds, ['system-user', 'contacts'])
  h.api.getAuthorizedMenuTree = async () => {
    throw new Error('offline')
  }
  await h.store.getState().load({ force: true })
  assert.equal(h.store.getState().loaded, true)
  assert.equal(h.store.getState().menus.length, 2)
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
  h.auth.setState({
    user: { ...h.auth.getState().user, accessPath: ['/system/user', '/contacts'] },
  })
  const calls = []
  const pending = deferred()
  const navigation = loadTs('src/pages/apps/navigation.ts', {
    '@tarojs/taro': { showModal: async () => {} },
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
  const user = { id: 1, accessPath: ['/system/user'], permissions: ['system:user:list'] }
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
    '@/api': { authApi: api, menuApi: { getAuthorizedMenuTree: async () => [menu()] } },
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
  assert.deepEqual(modules.getState().commonModuleIds, ['system-user'])
})

test('placeholder favorites persist and clicking opens a modal without navigation', async () => {
  const h = harness()
  h.api.getAuthorizedMenuTree = async () => [
    menu({ id: 8, name: '角色管理', path: '/system/role' }),
  ]
  await h.store.getState().load()
  assert.deepEqual(h.store.getState().commonModuleIds, ['menu-8'])
  h.store.getState().setCommonModules(['menu-8'])
  h.store.getState().reset()
  await h.store.getState().load()
  assert.deepEqual(h.store.getState().commonModuleIds, ['menu-8'])
  const modals = []
  const navigation = loadTs('src/pages/apps/navigation.ts', {
    '@tarojs/taro': { showModal: async (options) => modals.push(options) },
    '@/stores/auth': { useAuthStore: h.auth },
    '@/stores/modules': { useModuleStore: h.store },
    '@/utils/router': {
      navigateTo: () => {
        throw new Error('Placeholder must never navigate')
      },
    },
  })
  await navigation.openWorkbenchApp('menu-8')
  assert.equal(modals[0].title, '角色管理')
  assert.match(modals[0].content, /建设中/)
  assert.equal(modals[0].showCancel, false)
})
