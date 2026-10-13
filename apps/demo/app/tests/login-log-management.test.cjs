const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTs } = require('./helpers/load-ts.cjs')
test('login log query retains one-sided inclusive ranges, failed status and oldest ordering', () => {
  const { buildLoginLogQuery } = loadTs('src/pages/system/login-log/query.ts')
  const result = buildLoginLogQuery(2, 10, '127', { status: '0', sort: 'asc', startDate: '', endDate: '2026-10-11' })
  assert.equal(result.status, '0')
  assert.equal(result.sortOrder, 'asc')
  assert.equal(result.startTime, undefined)
  assert.equal(result.endTime, new Date('2026-10-11T23:59:59.999').toISOString())
  assert.equal(result.keyword, '127')
})
test('login log query rejects invalid and reverse date ranges', () => {
  const { buildLoginLogQuery } = loadTs('src/pages/system/login-log/query.ts')
  assert.throws(() => buildLoginLogQuery(1, 10, '', { startDate: '2026-02-30', endDate: '' }), /有效日期/)
  assert.throws(() => buildLoginLogQuery(1, 10, '', { startDate: '2026-10-12', endDate: '2026-10-11' }), /不能晚于/)
})

function harness(entry, mocks = {}) {
  const states = [], refs = [], effects = [], deps = [], cleanups = []
  let si = 0, ri = 0, ei = 0, tree
  const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: 'Fragment' }
  const react = {
    useState(initial) { const i = si++; if (!(i in states)) states[i] = initial; return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value }] },
    useRef(initial) { const i = ri++; if (!refs[i]) refs[i] = { current: initial }; return refs[i] },
    useEffect(fn, next) { const i = ei++; if (!deps[i] || next.some((v, j) => deps[i][j] !== v)) { deps[i] = next; effects.push(() => { cleanups[i]?.(); cleanups[i] = fn() }) } },
  }
  const components = new Proxy({}, { get: (_, key) => key })
  const Page = loadTs(entry, { react, 'react/jsx-runtime': jsx, '@tarojs/components': components, '@/components/management': components, '@/components/feedback': components, '@/components/molecules': components, '@/utils/account-scope': { withAccountScope: page => page, errorMessage: e => e.message }, './index.module.scss': {}, ...mocks }).default
  return { render() { si = ri = ei = 0; tree = Page(); while (effects.length) {
      effects.shift()()
    }
    return tree
  }, states, dispose() { cleanups.forEach((fn) => { fn?.() }) } }
}
function all(tree) { if (!tree || typeof tree !== 'object') return []; if (Array.isArray(tree)) return tree.flatMap(all); return [tree, ...all(tree.props?.children)] }
test('system log detail ignores late account response and exposes retry on failure', async () => {
  const { deferred } = require('./helpers/load-ts.cjs')
  const pending = deferred()
  let version = 1
  const auth = { ready: true, allowed: true }
  const mount = harness('src/pages/system/login-log/detail/index.tsx', {
    '@tarojs/taro': { useRouter: () => ({ params: { id: '7' } }), useDidHide() {}, useDidShow() {} },
    '@/api/admin/loginLog': { getAdminLoginLog: () => pending.promise },
    '@/api/client': { getSessionVersion: () => version },
    '@/utils/auth-guard': { useRequireAuth: () => auth },
    '@/utils/format': { formatDateTime: v => v },
  })
  mount.render(); version = 2; pending.resolve({ id: 7, username: 'old account' })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(mount.states[0], null)
  mount.dispose()
  const failure = harness('src/pages/system/login-log/detail/index.tsx', {
    '@tarojs/taro': { useRouter: () => ({ params: { id: 'invalid' } }), useDidHide() {}, useDidShow() {} },
    '@/api/admin/loginLog': { getAdminLoginLog: () => { throw new Error('must not request invalid id') } },
    '@/api/client': { getSessionVersion: () => 1 },
    '@/utils/auth-guard': { useRequireAuth: () => auth },
    '@/utils/format': { formatDateTime: v => v },
  })
  failure.render()
  const state = all(failure.render()).find(node => node.type === 'StateView')
  assert.equal(state.props.kind, 'error')
  assert.match(state.props.text, /ID/)
  assert.equal(typeof state.props.onRetry, 'function')
  auth.allowed = false
  assert.equal(all(failure.render()).some(node => node.type === 'DetailHero'), false)
})
