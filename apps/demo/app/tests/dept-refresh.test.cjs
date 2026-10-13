const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTs } = require('./helpers/load-ts.cjs')

test('department detail pull-down refresh reloads detail and members without duplicating child refresh', async () => {
  let cursor = 0
  const state = []
  const effects = []
  const refreshHandlers = []
  const calls = { detail: 0, members: 0, childRefresh: 0 }
  const react = {
    useState(initial) {
      const i = cursor++
      state[i] ??= { value: initial }
      return [state[i].value, (next) => { state[i].value = typeof next === 'function' ? next(state[i].value) : next }]
    },
    useRef(initial) { const i = cursor++; state[i] ??= { current: initial }; return state[i] },
    useEffect(fn, deps) {
      const i = cursor++
      if (!state[i] || !deps.every((value, index) => Object.is(value, state[i].deps[index]))) {
        state[i]?.cleanup?.()
        state[i] = { deps }
        effects.push(() => { state[i].cleanup = fn() })
      }
    },
  }
  const page = loadTs('src/pages/system/dept/detail/index.tsx', {
    react,
    '@tarojs/taro': { useRouter: () => ({ params: { id: '5' } }), useDidShow() {}, useDidHide() {}, usePullDownRefresh: (fn) => refreshHandlers.push(fn) },
    '@/components/atoms': { Tag: 'Tag' },
    '@/components/feedback': { StateView: 'StateView' },
    '@/components/management': Object.fromEntries(['ActionSheet', 'BottomActionBar', 'DetailContent', 'DetailHero', 'DetailRow', 'DetailSection', 'ManagementCell', 'ManagementList', 'ManagementListFooter', 'ManagementPage', 'ManagementPageHeader'].map((name) => [name, name])),
    '@/constants/routes': { SYSTEM_PAGES: {} },
    '@/hooks': {
      confirmAction() {}, useCanWrite: () => true,
      useListPagination: () => ({ list: [], total: 0, refresh: () => { calls.childRefresh++ } }),
    },
    '@/utils/auth-guard': { useRequireAuth: () => ({ ready: true, allowed: true }), useCurrentModuleAccess: () => () => true },
    '@/utils/format': { formatDateTime: (value) => value },
    '@/utils/router': {},
    '@/api/admin/dept': { getAdminDept: async () => { calls.detail++; return {id: 5, name: '部门', status: '1'} } },
    '@/api/contacts': { getDeptUsers: async () => { calls.members++; return [] } },
    '../../_shared/AdminUI': { errorMessage: (error) => error.message, withAccountScope: (value) => value },
  }).default
  function render() {
    cursor = 0
    refreshHandlers.length = 0
    page()
    effects.splice(0).forEach((fn) => {
      fn()
    })
  }
  render()
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(refreshHandlers.length, 1)
  await refreshHandlers[0]()
  render()
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(calls.detail, 2)
  assert.equal(calls.members, 2)
  assert.equal(calls.childRefresh, 0, 'pagination hook already refreshes children on the same pull-down event')
})
