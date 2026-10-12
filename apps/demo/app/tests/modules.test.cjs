const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTs, deferred } = require('./helpers/load-ts.cjs')
const registry = loadTs('src/modules/registry.ts')

const entry = (overrides = {}) => ({
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
const group = (children = [entry()], overrides = {}) => ({
  id: 10,
  type: 0,
  name: '企业管理',
  moduleId: 'core',
  sortOrder: 10,
  status: '1',
  children,
  ...overrides,
})

test('only implemented, registered pages intersect genuine user permissions', () => {
  const menus = [
    group([
      entry(),
      entry({ id: 2, page: 'pages/crm/customers/index' }),
      entry({ id: 3, page: 'pages/system/dept/index' }),
    ]),
  ]
  assert.deepEqual(registry.getAuthorizedMobileModules(menus), [])
  assert.deepEqual(registry.getAuthorizedMobileModules(menus, []), [])
  assert.deepEqual(
    registry.getAuthorizedMobileModules(menus, ['system:user:list']).map((module) => module.id),
    ['system-user'],
  )
  assert.equal(registry.getMobileModuleByPage(undefined), undefined)
  assert.equal(registry.getMobileModuleByPage('pages/unregistered/index'), undefined)
  assert.equal(registry.getMobileModuleByPage('/pages/system/user/index').id, 'system-user')
})

test('disabled entries and groups never surface; stray top-level entries are ignored', () => {
  const permissions = ['system:user:list']
  assert.deepEqual(
    registry.getAuthorizedMobileModules([group([entry({ status: '0' })])], permissions),
    [],
  )
  assert.deepEqual(
    registry.getAuthorizedMobileModules([group([entry()], { status: '0' })], permissions),
    [],
  )
  assert.deepEqual(
    registry.getAuthorizedMobileModules([entry({ parentId: undefined })], permissions),
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

test('deep links need current user permissions, workbench access, and the correct edit action', () => {
  const state = {
    bootstrapped: true,
    token: 'token',
    user: { id: 1, permissions: ['system:user:list'] },
    enabledModuleIds: [],
  }
  const menusState = { menus: [group()], loaded: true, error: null }
  const route = { path: '/pages/system/user/edit/index', params: { id: '7' } }
  const guard = loadTs('src/utils/auth-guard.ts', {
    '@/api/client': { getSessionVersion: () => 0 },
    react: { useEffect() {} },
    '@tarojs/taro': { useRouter: () => route },
    '@/stores/auth': { useAuthStore: (select) => select(state) },
    '@/stores/modules': { useModuleStore: (select) => select(menusState) },
    './router': { redirectToLogin() {} },
  })
  assert.equal(guard.useRequireAuth().denied, true)
  state.user.permissions.push('system:user:update')
  assert.equal(guard.useRequireAuth().allowed, true)
  route.params = {}
  assert.equal(guard.useRequireAuth().denied, true)
  state.user.permissions.push('system:user:create')
  assert.equal(guard.useRequireAuth().allowed, true)
  menusState.menus = []
  assert.equal(guard.useRequireAuth().denied, true)
  menusState.menus = [group()]
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
  pending.resolve([group()])
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
          return [group([entry()], { id: calls })]
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

test('home apps are dropped when the account changes', async () => {
  const auth = authStore({
    bootstrapped: true,
    token: 'one',
    user: { id: 1, permissions: ['system:user:list'] },
  })
  const modules = loadTs('src/stores/modules.ts', {
    '@/api': {
      menuApi: {
        getAuthorizedMenuTree: async () => [group()],
        getHomeApps: async () => ({ pinned: [1], ranked: [] }),
      },
    },
    './auth': { useAuthStore: auth },
  }).useModuleStore
  await modules.getState().load()
  assert.deepEqual(modules.getState().home, { pinned: [1], ranked: [] })
  auth.setState({ token: 'two', user: { id: 2, permissions: [] } })
  assert.equal(modules.getState().home, null)
})

test('base placeholder modules allow navigation to their registered entry', () => {
  const module = registry.getMobileModuleById('system-dept')
  assert.equal(
    registry.isMobileModuleAuthorized(
      module,
      [group([entry({ page: 'pages/system/dept/index' })])],
      ['system:department:list'],
      [],
    ),
    true,
  )
})
