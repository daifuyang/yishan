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

// ---- profile 登录日志列表：与 system 列表同形，但状态 / 排序 / 时间范围在客户端完成 ----

function nodesOf(tree, type) { return all(tree).filter(node => node.type === type) }

function logRow(id, status, createdAt, ipAddress) {
  return { id, username: 'me', status, createdAt, updatedAt: createdAt, ipAddress }
}

// parseDateBoundary 按本地时区取日界，用本地日中午的瞬时值可让日期断言与时区无关。
function localNoon(year, month, day) {
  return new Date(year, month - 1, day, 12).toISOString()
}

function profileHarness(options = {}) {
  const navigate = [], queries = [], calls = { hook: null, auth: null, loads: [] }
  // pages 表达「服务端一次只给一页」：只有一页时就是已经到底，多页时 loadMore 才有效。
  const pages = options.pages ?? [options.records ?? []]
  const records = pages[0]
  let cursor = 0
  const listState = {
    list: records, total: 0, page: 1, loading: false, refreshing: false, loadingMore: false,
    finished: pages.length <= 1, error: null, keyword: '', filters: {},
    setKeyword() {}, setFilters() {}, refresh: async () => {}, reset: async () => {},
    // 按真实 hook 的语义推进：把下一页并进 list，最后一页之后置 finished。
    loadMore: async () => {
      calls.loads.push(listState.page)
      const next = pages[cursor + 1]
      if (!next) return
      cursor += 1
      listState.list = listState.list.concat(next)
      listState.page = cursor + 1
      listState.finished = cursor + 1 >= pages.length
    },
  }
  const mount = harness('src/pages/profile/login-log/index.tsx', {
    '@tarojs/taro': { useDidHide() {} },
    '@/components/atoms': { Tag: 'Tag' },
    '@/api': { userApi: { getMyLoginLogs: async (params) => { queries.push(params); return records } } },
    '@/hooks': { useListPagination: (o) => { calls.hook = o; return listState } },
    '@/utils/auth-guard': { useRequireAuth: (o) => { calls.auth = o; return options.auth ?? { ready: true, allowed: true } } },
    '@/utils/router': { navigateTo: (url) => navigate.push(url) },
  })
  return { mount, navigate, queries, listState, calls }
}

// 应用一次「登录状态」筛选：打开面板 → 选中 → 重渲染，返回选中后的那棵树。
function pickStatus(h, key) {
  let tree = h.mount.render()
  nodesOf(tree, 'ManagementFilterTriggers')[0].props.onPanelChange('status')
  tree = h.mount.render()
  nodesOf(tree, 'BottomSelectSheet')[0].props.onSelect(key)
  return h.mount.render()
}

// 续拉靠「渲染 → effect → setState → 再渲染」推进；测试里手动把这几轮跑完。
function settle(h, limit = 10) {
  let tree = h.mount.render()
  for (let round = 0; round < limit; round += 1) {
    const loads = h.calls.loads.length
    tree = h.mount.render()
    if (h.calls.loads.length === loads) break
  }
  return tree
}

test('profile 登录日志列表不再把记录交接到详情页', () => {
  const fs = require('node:fs')
  const path = require('node:path')
  const { appRoot } = require('./helpers/load-ts.cjs')
  const source = fs.readFileSync(path.join(appRoot, 'src/pages/profile/login-log/index.tsx'), 'utf8')
  // 只针对 import 说明符：裸词 handoff 会被无关注释或路径误伤
  assert.doesNotMatch(source, /from\s+['"][^'"]*handoff['"]/)
  assert.doesNotMatch(source, /rememberLoginLog/)
  assert.match(source, /withAccountScope/)
})

test('profile 登录日志列表用 useListPagination 拉取，接口只收 page/pageSize，点行只带 id', async () => {
  const records = [logRow(2, '0', '2026-10-12T12:00:00.000Z', '2.2.2.2'), logRow(1, '1', '2026-10-01T12:00:00.000Z', '1.1.1.1')]
  const h = profileHarness({ records })
  const tree = h.mount.render()
  assert.equal(h.calls.hook.enabled, true)
  assert.equal(h.calls.hook.pageSize, 10)
  assert.equal(typeof h.calls.hook.fetcher, 'function')
  // fetcher 即使收到 keyword / filters 也不透传给接口
  const result = await h.calls.hook.fetcher({ page: 1, pageSize: 10, keyword: 'abc', filters: { status: '0' } })
  assert.deepEqual(h.queries, [{ page: 1, pageSize: 10 }])
  assert.deepEqual(result.list, records)
  assert.equal(result.total, 2)
  const cells = nodesOf(tree, 'ManagementCell')
  assert.equal(cells.length, 2)
  cells[0].props.onClick()
  assert.deepEqual(h.navigate, ['/pages/profile/login-log/detail/index?id=2'])
})

test('profile 登录日志列表满页时把分页标成未结束', async () => {
  const records = Array.from({ length: 10 }, (_, index) => logRow(index + 1, '1', '2026-10-12T12:00:00.000Z', '1.1.1.1'))
  const h = profileHarness({ records })
  h.mount.render()
  const result = await h.calls.hook.fetcher({ page: 1, pageSize: 10, keyword: '', filters: {} })
  assert.equal(result.list.length, 10)
  assert.ok(result.total > 10)
})

test('profile 登录日志列表按状态客户端筛选', () => {
  const h = profileHarness({ records: [logRow(3, '1', '2026-10-12T12:00:00.000Z', '1.1.1.1'), logRow(2, '0', '2026-10-01T12:00:00.000Z', '2.2.2.2')] })
  let tree = h.mount.render()
  assert.equal(nodesOf(tree, 'ManagementCell').length, 2)
  const triggers = nodesOf(tree, 'ManagementFilterTriggers')[0]
  assert.deepEqual(triggers.props.triggers.map(trigger => trigger.key), ['status', 'sort', 'dates'])
  triggers.props.onPanelChange('status')
  tree = h.mount.render()
  const sheet = nodesOf(tree, 'BottomSelectSheet')[0]
  assert.equal(sheet.props.title, '登录状态')
  sheet.props.onSelect('0')
  tree = h.mount.render()
  const cells = nodesOf(tree, 'ManagementCell')
  assert.equal(cells.length, 1)
  assert.equal(cells[0].props.description, '2.2.2.2')
  assert.equal(cells[0].props.tag.props.variant, 'danger')
})

test('profile 登录日志列表按登录时间客户端排序', () => {
  const h = profileHarness({ records: [logRow(3, '1', '2026-10-12T12:00:00.000Z', '1.1.1.1'), logRow(2, '0', '2026-10-01T12:00:00.000Z', '2.2.2.2')] })
  let tree = h.mount.render()
  assert.equal(nodesOf(tree, 'ManagementCell')[0].props.description, '1.1.1.1')
  nodesOf(tree, 'ManagementFilterTriggers')[0].props.onPanelChange('sort')
  tree = h.mount.render()
  const sheet = nodesOf(tree, 'BottomSelectSheet')[0]
  assert.equal(sheet.props.title, '排序方式')
  sheet.props.onSelect('asc')
  tree = h.mount.render()
  assert.equal(nodesOf(tree, 'ManagementCell')[0].props.description, '2.2.2.2')
})

test('profile 登录日志列表按时间范围客户端筛选，底部只报已显示条数', () => {
  const h = profileHarness({ records: [logRow(3, '1', localNoon(2026, 10, 12), '1.1.1.1'), logRow(2, '0', localNoon(2026, 9, 1), '2.2.2.2')] })
  let tree = h.mount.render()
  // 接口不给总数：底部只说明「当前显示」，不得出现「共 / 总数 / 已加载」这类会被读成服务端统计的措辞
  const footer = nodesOf(tree, 'ManagementListFooter')[0].props.summary
  assert.match(footer, /^当前显示 \d+ 条$/)
  assert.doesNotMatch(footer, /共|总数|已加载/)
  assert.equal(nodesOf(tree, 'DateRangeSheet').length, 0)
  nodesOf(tree, 'ManagementFilterTriggers')[0].props.onPanelChange('dates')
  tree = h.mount.render()
  const sheet = nodesOf(tree, 'DateRangeSheet')[0]
  sheet.props.onConfirm({ startDate: '2026-10-12', endDate: '2026-10-12' })
  tree = h.mount.render()
  const cells = nodesOf(tree, 'ManagementCell')
  assert.equal(cells.length, 1)
  assert.equal(cells[0].props.description, '1.1.1.1')
  assert.equal(nodesOf(tree, 'ManagementListFooter')[0].props.summary, '当前显示 1 条')
  const summary = nodesOf(tree, 'ManagementFilterSummary')[0]
  assert.match(summary.props.children.join(''), /2026-10-12/)
  summary.props.onClear()
  tree = h.mount.render()
  assert.equal(nodesOf(tree, 'ManagementCell').length, 2)
})

// ---- 筛选只作用于已加载的记录：首屏整页不匹配时要自己续拉，否则空态就是在替服务端下结论 ----

test('profile 登录日志列表筛选为空时继续翻页，直到匹配项出现', () => {
  // 服务端一次只给一页：第一页满页且整页不匹配，匹配项落在第二页。
  // 空态只有 220px、页面不滚动，useReachBottom 永远不会触发，只能由页面自己续拉。
  const pages = [
    Array.from({ length: 10 }, (_, index) => logRow(index + 1, '1', localNoon(2026, 10, 12), '1.1.1.1')),
    [logRow(99, '0', localNoon(2026, 10, 1), '9.9.9.9')],
  ]
  const h = profileHarness({ pages })
  const seeking = pickStatus(h, '0')
  // 还在翻页时不能先说「未找到符合条件的登录日志」
  assert.equal(nodesOf(seeking, 'ManagementStates')[0].props.kind, 'loading')
  const tree = settle(h)
  assert.deepEqual(h.calls.loads, [1], '续拉到第二页找到匹配项后应停下')
  const cells = nodesOf(tree, 'ManagementCell')
  assert.equal(cells.length, 1)
  assert.equal(cells[0].props.description, '9.9.9.9')
  assert.equal(nodesOf(tree, 'ManagementStates')[0].props.kind, 'ready')
})

test('profile 登录日志列表筛选一个都不匹配时续拉到数据用完就停', () => {
  const noMatch = (page) => Array.from({ length: 10 }, (_, index) => logRow(page * 10 + index + 1, '1', localNoon(2026, 10, 12), '1.1.1.1'))
  const pages = [noMatch(0), noMatch(1), [logRow(30, '1', localNoon(2026, 10, 12), '1.1.1.1')]]
  const h = profileHarness({ pages })
  pickStatus(h, '0')
  const tree = settle(h)
  assert.deepEqual(h.calls.loads, [1, 2], '数据用完（短页）后不再续拉')
  assert.equal(nodesOf(tree, 'ManagementCell').length, 0)
  const states = nodesOf(tree, 'ManagementStates')[0]
  assert.equal(states.props.kind, 'empty')
  assert.equal(states.props.emptyText, '未找到符合条件的登录日志')
})

test('profile 登录日志列表的续拉封顶，不会变成无限请求', () => {
  // 12 页全不匹配：续拉必须停在固定上限，而不是把服务端一直拉下去。
  const pages = Array.from({ length: 12 }, (_, page) =>
    Array.from({ length: 10 }, (_, index) => logRow(page * 10 + index + 1, '1', localNoon(2026, 10, 12), '1.1.1.1')),
  )
  const h = profileHarness({ pages })
  pickStatus(h, '0')
  const tree = settle(h, 20)
  assert.deepEqual(h.calls.loads, [1, 2, 3, 4, 5], '封顶 5 页')
  assert.equal(nodesOf(tree, 'ManagementCell').length, 0)
  // 已加载的记录非空、只是筛选没命中：底部不能谎称没有更多，要留出「上拉加载更多」的手动出口
  assert.equal(nodesOf(tree, 'ManagementListFooter')[0].props.empty, false)
  // 上限用尽后不再显示骨架（否则用户永远停在「加载中」）
  assert.equal(nodesOf(tree, 'ManagementStates')[0].props.kind, 'empty')
})

test('profile 登录日志列表换筛选后重新计数续拉', () => {
  // 前 6 页都不匹配「登录时间 = 2026-09-01」，续拉会把配额用完；
  // 换成「状态 = 失败」（匹配项在第 7 页）后必须重新获得配额，否则永远拉不到。
  const dated = (page) => Array.from({ length: 10 }, (_, index) => logRow(page * 10 + index + 1, '1', localNoon(2026, 10, 12), '1.1.1.1'))
  const pages = [dated(0), dated(1), dated(2), dated(3), dated(4), dated(5), [logRow(99, '0', localNoon(2026, 10, 1), '9.9.9.9')]]
  const h = profileHarness({ pages })
  let tree = h.mount.render()
  nodesOf(tree, 'ManagementFilterTriggers')[0].props.onPanelChange('dates')
  tree = h.mount.render()
  nodesOf(tree, 'DateRangeSheet')[0].props.onConfirm({ startDate: '2026-09-01', endDate: '2026-09-01' })
  tree = settle(h)
  assert.deepEqual(h.calls.loads, [1, 2, 3, 4, 5], '时间筛选先耗尽续拉配额')
  assert.equal(nodesOf(tree, 'ManagementStates')[0].props.kind, 'empty')
  nodesOf(tree, 'ManagementFilterSummary')[0].props.onClear()
  tree = pickStatus(h, '0')
  tree = settle(h)
  const cells = nodesOf(tree, 'ManagementCell')
  assert.equal(cells.length, 1)
  assert.equal(cells[0].props.description, '9.9.9.9')
})

test('profile 登录日志列表失败时给出可重试错误态', () => {
  const h = profileHarness({ records: [] })
  h.listState.error = '网络异常'
  const tree = h.mount.render()
  const states = nodesOf(tree, 'ManagementStates')[0]
  assert.equal(states.props.kind, 'error')
  assert.equal(states.props.errorText, '网络异常')
  assert.equal(states.props.onRetry, h.listState.refresh)
})

test('profile 登录日志列表加载更多失败时不再谎报已显示条数', () => {
  // 加载更多失败的真实状态：useListPagination 的 catch 只置 error、不清空已加载的 list，
  // ManagementStates 以错误态顶替列表。footer 挂在它外面，此刻必须与 kind 同源地收起计数。
  const records = Array.from({ length: 10 }, (_, index) => logRow(index + 1, '1', localNoon(2026, 10, 12), '1.1.1.1'))
  const h = profileHarness({ records })
  let tree = h.mount.render()
  assert.equal(nodesOf(tree, 'ManagementListFooter')[0].props.summary, '当前显示 10 条')
  h.listState.error = '加载失败，请重试'
  tree = h.mount.render()
  assert.equal(nodesOf(tree, 'ManagementStates')[0].props.kind, 'error')
  assert.equal(nodesOf(tree, 'ManagementListFooter')[0].props.summary, undefined)
})

test('profile 登录日志列表保留原权限守卫且不传 moduleId', () => {
  const h = profileHarness({ records: [logRow(1, '1', '2026-10-12T12:00:00.000Z', '1.1.1.1')], auth: { ready: true, allowed: false } })
  const tree = h.mount.render()
  assert.equal(h.calls.auth, undefined)
  assert.equal(h.calls.hook.enabled, false)
  assert.equal(nodesOf(tree, 'ManagementFilterBar').length, 0)
  assert.equal(nodesOf(tree, 'ManagementCell').length, 0)
})
