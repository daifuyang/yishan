const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const { loadTs, deferred, appRoot } = require('./helpers/load-ts.cjs')

// 与 login-log-management.test.cjs 的 system 详情用例同源的最小渲染器：
// 只实现页面真正用到的 hooks，组件名以字符串占位，便于断言 props。
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
  const Page = loadTs(entry, { react, 'react/jsx-runtime': jsx, '@tarojs/components': components, '@/components/management': components, '@/components/atoms': components, '@/components/feedback': components, '@/components/molecules': components, '@/utils/account-scope': { withAccountScope: page => page, errorMessage: e => e.message }, './index.module.scss': {}, ...mocks }).default
  return { render() { si = ri = ei = 0; tree = Page(); while (effects.length) {
      effects.shift()()
    }
    return tree
  }, states, dispose() { cleanups.forEach((fn) => { fn?.() }) } }
}

function all(tree) { if (!tree || typeof tree !== 'object') return []; if (Array.isArray(tree)) return tree.flatMap(all); return [tree, ...all(tree.props?.children)] }
function nodesOf(tree, type) { return all(tree).filter(node => node.type === type) }

const flush = () => new Promise(resolve => setImmediate(resolve))

const ENTRY = 'src/pages/profile/login-log/detail/index.tsx'
const LOG = { id: 7, username: 'me', status: '1', createdAt: '2026-10-12T12:00:00.000Z', updatedAt: '2026-10-12T12:00:00.000Z', ipAddress: '1.1.1.1', message: '登录成功', userAgent: 'Mozilla/5.0' }

// 个人详情页从 `@/api` 的 userApi 取记录，mock 键必须跟着页面 import 走。
function detailHarness(options = {}) {
  const calls = []
  const auth = options.auth ?? { ready: true, allowed: true }
  const session = { version: 1 }
  const mount = harness(ENTRY, {
    '@tarojs/taro': {
      useRouter: () => ({ params: { id: options.id ?? '7' } }),
      useDidHide() {},
      useDidShow() {},
    },
    '@/api': {
      userApi: {
        getMyLoginLog: async (id) => {
          calls.push(id)
          return options.fetch ? options.fetch(id, calls.length) : LOG
        },
      },
    },
    '@/api/client': { getSessionVersion: () => session.version },
    '@/utils/auth-guard': { useRequireAuth: () => auth },
    '@/utils/format': { formatDateTime: value => value },
  })
  return { mount, calls, session, auth }
}

test('profile log detail fetches the record by id and keeps the header, hero and fields', async () => {
  const h = detailHarness()
  h.mount.render()
  await flush()
  const tree = h.mount.render()
  assert.deepEqual(h.calls, [7])
  assert.equal(h.mount.states[0].username, 'me')
  const view = nodesOf(tree, 'StateView')[0]
  assert.equal(view.props.kind, 'ready')
  assert.equal(view.props.text, undefined)
  const hero = nodesOf(tree, 'DetailHero')[0]
  assert.equal(hero.props.glyph, 'shield')
  assert.equal(hero.props.title, '登录记录')
  assert.equal(hero.props.tag.props.variant, 'success')
  assert.equal(hero.props.glyphColor, 'var(--color-text-secondary)')
  assert.equal(hero.props.subtitle, LOG.createdAt)
  assert.deepEqual(nodesOf(tree, 'DetailRow').map(row => row.props.label), [
    '账号', '状态', '提示信息', 'IP地址', '客户端', '日志 ID', '创建时间', '更新时间',
  ])
  // 头部保持无条件渲染（system 详情页是 H5-only，这里不是）
  const headers = nodesOf(tree, 'ManagementPageHeader')
  assert.equal(headers.length, 1)
  assert.equal(headers[0].props.title, '登录详情')
  assert.equal(headers[0].props.showBack, false)
})

test('profile log detail rejects a missing or invalid id without requesting', async () => {
  const h = detailHarness({ id: 'invalid' })
  h.mount.render()
  await flush()
  let tree = h.mount.render()
  const view = nodesOf(tree, 'StateView')[0]
  assert.equal(view.props.kind, 'error')
  assert.match(view.props.text, /ID/)
  assert.equal(typeof view.props.onRetry, 'function')
  assert.deepEqual(h.calls, [])
  assert.equal(nodesOf(tree, 'DetailHero').length, 0)
  h.auth.allowed = false
  tree = h.mount.render()
  assert.equal(nodesOf(tree, 'DetailHero').length, 0)
  assert.equal(nodesOf(tree, 'StateView').length, 0)
})

test('profile log detail exposes a retry that recovers after a failed request', async () => {
  let attempt = 0
  const h = detailHarness({ fetch: async () => { attempt += 1; if (attempt === 1) throw new Error('网络异常'); return LOG } })
  h.mount.render()
  await flush()
  let tree = h.mount.render()
  let view = nodesOf(tree, 'StateView')[0]
  assert.equal(view.props.kind, 'error')
  assert.equal(view.props.text, '网络异常')
  assert.equal(nodesOf(tree, 'DetailHero').length, 0)
  view.props.onRetry()
  await flush()
  tree = h.mount.render()
  view = nodesOf(tree, 'StateView')[0]
  assert.equal(view.props.kind, 'ready')
  assert.equal(nodesOf(tree, 'DetailHero').length, 1)
  assert.deepEqual(h.calls, [7, 7])
})

test('profile log detail drops a response that lands after the account changes', async () => {
  const pending = deferred()
  const h = detailHarness({ fetch: () => pending.promise })
  h.mount.render()
  h.session.version = 2
  pending.resolve({ ...LOG, username: 'old account' })
  await flush()
  assert.equal(h.mount.states[0], null)
  const tree = h.mount.render()
  assert.equal(nodesOf(tree, 'DetailHero').length, 0)
  assert.equal(nodesOf(tree, 'StateView')[0].props.kind, 'loading')
  h.mount.dispose()
})

test('profile log detail can only render a record that came from the API, never from the removed handoff', async () => {
  // 请求一直挂着：页面若还有内存兜底，这里就会出现 hero。
  const pending = deferred()
  const h = detailHarness({ fetch: () => pending.promise })
  const tree = h.mount.render()
  await flush()
  assert.deepEqual(h.calls, [7])
  assert.equal(h.mount.states[0], null)
  assert.equal(nodesOf(tree, 'DetailHero').length, 0)
  assert.equal(nodesOf(h.mount.render(), 'DetailHero').length, 0)
  const detail = fs.readFileSync(path.join(appRoot, ENTRY), 'utf8')
  assert.doesNotMatch(detail, /handoff/)
  assert.doesNotMatch(detail, /recallLoginLog|rememberLoginLog/)
  assert.equal(fs.existsSync(path.join(appRoot, 'src/pages/profile/login-log/handoff.ts')), false)
})
