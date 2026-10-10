const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTs, deferred } = require('./helpers/load-ts.cjs')
const registry = loadTs('src/modules/registry.ts')
const node = (overrides = {}) => ({
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

test('only implemented, exact registered menu paths intersect genuine user permissions', () => {
  const menus = [
    node({ permissionCodes: ['system:user:list'] }),
    node({ id: 2, path: '/crm/customers' }),
    node({ id: 3, path: '/system/dept' }),
  ]
  assert.deepEqual(registry.getAuthorizedMobileModules(menus), [])
  assert.deepEqual(registry.getAuthorizedMobileModules(menus, []), [])
  assert.deepEqual(
    registry.getAuthorizedMobileModules(menus, ['system:user:list']).map((module) => module.id),
    ['system-user'],
  )
  assert.equal(registry.getMobileModule(node({ path: undefined })), undefined)
  assert.equal(
    registry.getMobileModule(node({ path: '/unregistered', name: '用户管理' })),
    undefined,
  )
})

test('menu labels and legacy permission associations cannot invent routes', () => {
  const routes = loadTs('src/constants/menu-routes.ts')
  assert.equal(
    routes.resolveMenuRoute(node({ path: undefined, perm: 'system:user:list' })).type,
    'none',
  )
  assert.equal(routes.resolveMenuRoute(node({ path: '/not-registered' })).type, 'none')
  assert.equal(routes.resolveMenuRoute(node()).url, '/pages/system/user/index')
})

test('disabled, hidden, external, or ancestor-denied menus never surface', () => {
  for (const override of [{ status: '0' }, { hideInMenu: true }, { isExternalLink: true }]) {
    assert.deepEqual(
      registry.getAuthorizedMobileModules([node(override)], ['system:user:list']),
      [],
    )
  }
  assert.deepEqual(
    registry.getAuthorizedMobileModules(
      [node({ id: 10, type: 0, status: '0', children: [node({ parentId: 10 })] })],
      ['system:user:list'],
    ),
    [],
  )
})

test('future business modules require active backend modules and every permission', () => {
  const module = {
    ...registry.getMobileModuleById('system-user'),
    backendModuleId: 'crm',
    permissions: ['one', 'two'],
  }
  assert.equal(registry.isModuleEnabled(module), false)
  assert.equal(registry.isModuleEnabled(module, []), false)
  assert.equal(registry.isModuleEnabled(module, ['crm']), true)
  assert.equal(registry.hasRequiredPermissions(module.permissions, ['one']), false)
  assert.equal(registry.hasRequiredPermissions(module.permissions, ['one', 'two']), true)
})

test('secondary routes resolve to a module and edit guards distinguish create/update', () => {
  assert.equal(
    registry.getModuleForPage('/pages/system/user/detail/index?id=1').module.id,
    'system-user',
  )
  assert.equal(registry.getModuleForPage('pages/system/user/edit/index').editUser, true)
  assert.equal(
    registry.getModuleForPage('pages/contacts/dept/index').permissions[0],
    'app:contacts:dept-users',
  )
})

test('deep links need current user permissions, menu access, and the correct edit action', () => {
  const state = {
    bootstrapped: true,
    token: 'token',
    user: { id: 1, accessPath: ['/system/user'], permissions: ['system:user:list'] },
    enabledModuleIds: [],
  }
  const route = { path: '/pages/system/user/edit/index', params: { id: '7' } }
  const guard = loadTs('src/utils/auth-guard.ts', {
    react: { useEffect() {} },
    '@tarojs/taro': { useRouter: () => route },
    '@/stores/auth': { useAuthStore: (select) => select(state) },
    '@/stores/modules': {
      useModuleStore: (select) => select({ menus: [node()], loaded: true, error: null }),
    },
    './router': { redirectToLogin() {} },
  })
  assert.equal(guard.useRequireAuth().denied, true)
  state.user.permissions.push('system:user:update')
  assert.equal(guard.useRequireAuth().allowed, true)
  route.params = {}
  assert.equal(guard.useRequireAuth().denied, true)
  state.user.permissions.push('system:user:create')
  assert.equal(guard.useRequireAuth().allowed, true)
  state.user.accessPath = []
  assert.equal(guard.useRequireAuth().denied, true)
  state.bootstrapped = false
  assert.equal(guard.useRequireAuth().ready, false)
  assert.equal(guard.useRequireAuth().allowed, false)
})

function authStore(initial) {
  let state = initial
  const subscribers = []
  return {
    getState: () => state,
    subscribe: (callback) => subscribers.push(callback),
    setState(patch) {
      const previous = state
      state = { ...state, ...patch }
      subscribers.forEach((callback) => {
        callback(state, previous)
      })
    },
  }
}

test('shared menu requests coalesce and stale user requests cannot repopulate menu state', async () => {
  const pending = deferred()
  let calls = 0
  const auth = authStore({
    bootstrapped: true,
    token: 'token',
    user: { id: 1, permissions: ['system:user:list'] },
  })
  const modules = loadTs('src/stores/modules.ts', {
    '@/config': { API_BASE_URL: 'https://api.example' },
    '@/api': {
      menuApi: {
        getAuthorizedMenuTree: () => {
          calls++
          return pending.promise
        },
      },
    },
    './auth': {
      useAuthStore: auth,
      loadIdentity: async () => ({ user: auth.getState().user, enabledModuleIds: [] }),
    },
    '@/utils/storage': { storage: { get: () => null, set() {} } },
  }).useModuleStore
  const first = modules.getState().load()
  const second = modules.getState().load()
  assert.equal(calls, 1)
  auth.setState({ token: null, user: null })
  pending.resolve([node()])
  await Promise.all([first, second])
  assert.deepEqual(modules.getState().menus, [])
  assert.equal(modules.getState().loaded, false)
})

test('menu cache is reused within expiry and force refresh replaces it', async () => {
  let calls = 0
  const auth = authStore({ bootstrapped: true, token: 'token', user: { id: 1, permissions: [] } })
  const modules = loadTs('src/stores/modules.ts', {
    '@/config': { API_BASE_URL: 'https://api.example' },
    '@/api': {
      authApi: {
        getCurrentUser: async () => auth.getState().user,
        getCapabilities: async () => ({ permissions: [], enabledModuleIds: [] }),
      },
      menuApi: {
        getAuthorizedMenuTree: async () => {
          calls++
          return [node({ id: calls })]
        },
      },
    },
    './auth': {
      useAuthStore: auth,
      loadIdentity: async () => ({ user: auth.getState().user, enabledModuleIds: [] }),
    },
    '@/utils/storage': { storage: { get: () => null, set() {} } },
  }).useModuleStore
  await modules.getState().load()
  await modules.getState().load()
  assert.equal(calls, 1)
  await modules.getState().load({ force: true })
  assert.equal(calls, 2)
  assert.equal(modules.getState().menus[0].id, 2)
})

test('common entries persist per user and never bleed into another account', async () => {
  const saved = new Map()
  const auth = authStore({
    bootstrapped: true,
    token: 'one',
    user: { id: 1, permissions: ['system:user:list'] },
  })
  const modules = loadTs('src/stores/modules.ts', {
    '@/config': { API_BASE_URL: 'https://api.example' },
    '@/api': { menuApi: { getAuthorizedMenuTree: async () => [node()] } },
    './auth': { useAuthStore: auth },
    '@/utils/storage': {
      storage: { get: (key) => saved.get(key), set: (key, value) => saved.set(key, value) },
    },
  }).useModuleStore
  await modules.getState().load()
  modules.getState().setCommonModules(['system-user'])
  assert.deepEqual(modules.getState().commonModuleIds, ['system-user'])
  auth.setState({ token: 'two', user: { id: 2, permissions: [] } })
  assert.deepEqual(modules.getState().commonModuleIds, [])
  auth.setState({ token: 'one', user: { id: 1, permissions: [] } })
  assert.deepEqual(modules.getState().commonModuleIds, ['system-user'])
})

test('placeholder modules deny direct access even with matching menu and permissions', () => {
  const module = registry.getMobileModuleById('system-dept')
  assert.equal(
    registry.isMobileModuleAuthorized(
      module,
      [node({ path: '/system/department' })],
      ['system:department:list'],
      [],
    ),
    false,
  )
})
