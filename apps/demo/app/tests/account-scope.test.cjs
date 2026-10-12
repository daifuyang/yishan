const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTs } = require('./helpers/load-ts.cjs')

test('management page identity changes for account switch but not access-token refresh', () => {
  let state = { user: { id: 1 }, token: 'old' }
  const { withAccountScope } = loadTs('src/pages/system/_shared/AdminUI.tsx', {
    '@tarojs/components': {}, '@/components/molecules': {}, '@/components/layout': {}, '@/utils/router': {}, './admin.scss': {},
    '@/stores/auth': { useAuthStore: (selector) => selector(state) },
  })
  const Page = () => null
  const Scoped = withAccountScope(Page)
  assert.equal(Scoped().key, '1')
  state.token = 'renewed'
  assert.equal(Scoped().key, '1')
  state = { user: { id: 2 }, token: 'other' }
  assert.equal(Scoped().key, '2')
  state = { user: undefined, token: null }
  assert.equal(Scoped().key, 'signed-out')
})

test('live module access rejects revoked permissions, session changes and unmounted callbacks', () => {
  let version = 0
  let cleanup
  const auth = { bootstrapped: true, token: 'old', enabledModuleIds: [], user: { id: 1, permissions: ['system:user:list', 'system:user:update'] } }
  const moduleState = { loaded: true, menus: [{ id: 1, type: 0, status: '1', name: '系统', children: [{ id: 2, type: 1, status: '1', name: '用户', page: 'pages/system/user/index' }] }] }
  const { useCurrentModuleAccess } = loadTs('src/utils/auth-guard.ts', {
    react: { useRef: (current) => ({ current }), useEffect: (effect) => { cleanup = effect() } },
    '@tarojs/taro': {}, './router': {},
    '@/api/client': { getSessionVersion: () => version },
    '@/stores/auth': { useAuthStore: { getState: () => auth } },
    '@/stores/modules': { useModuleStore: { getState: () => moduleState } },
  })
  const current = useCurrentModuleAccess('system-user')
  assert.equal(current(['system:user:update']), true)
  auth.token = 'renewed'
  assert.equal(current(['system:user:update']), true)
  auth.user.permissions = ['system:user:list']
  assert.equal(current(['system:user:update']), false)
  auth.user.permissions.push('system:user:update')
  version++
  assert.equal(current(['system:user:update']), false)
  version--
  cleanup()
  assert.equal(current(['system:user:update']), false)
})
