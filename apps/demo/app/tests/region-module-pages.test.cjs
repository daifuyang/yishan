const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTs } = require('./helpers/load-ts.cjs')
function mount(entry, api, options = {}) {
  const reachBottom = []
  let cursor = 0,
    effects = [],
    session = 1,
    show
  const slots = []
  const names = [
    'ManagementPage',
    'ManagementPageHeader',
    'ManagementFilterBar',
    'ManagementSearchBar',
    'ManagementList',
    'ManagementCell',
    'ManagementStates',
    'ManagementListFooter',
    'Breadcrumbs',
    'Tag',
    'DetailContent',
    'DetailHero',
    'DetailSection',
    'DetailRow',
    'BottomActionBar',
  ]
  const page = loadTs(`src/pages/system/${entry}/index.tsx`, {
    react: {
      useState(initial) {
        const i = cursor++
        if (!(i in slots)) slots[i] = initial
        return [
          slots[i],
          (value) => (slots[i] = typeof value === 'function' ? value(slots[i]) : value),
        ]
      },
      useRef(initial) {
        const i = cursor++
        slots[i] ||= { current: initial }
        return slots[i]
      },
      useEffect(effect, deps) {
        const i = cursor++
        if (!slots[i] || deps.some((d, n) => d !== slots[i][n])) {
          slots[i] = deps
          effects.push(effect)
        }
      },
    },
    '@tarojs/components': { Text: 'Text', View: 'View' },
    '@tarojs/taro': {
      useRouter: () => ({ params: { id: 'demo' } }),
      useDidShow: (fn) => (show = fn),
      useDidHide: () => {},
      usePullDownRefresh: () => {},
      useReachBottom: (fn) => { reachBottom.push(fn) },
      stopPullDownRefresh: async () => {},
      showToast: async () => {},
    },
    '@/api/admin/region': api,
    '@/api/admin/moduleManagement': api,
    '@/api/client': { getSessionVersion: () => session },
    '@/components/management': Object.fromEntries(names.map((n) => [n, n])),
    '@/components/atoms': { Tag: 'Tag' },
    '@/components/feedback': { StateView: 'StateView' },
    '@/utils/auth-guard': {
      useRequireAuth: () => ({ ready: true, allowed: true }),
      canWriteModuleNow: () => options.write !== false,
    },
    '@/hooks': {
      useCanWrite: () => options.write !== false,
      confirmAction: options.confirm || (async () => true),
    },
    '@/constants/routes': {
      SYSTEM_PAGES: { moduleDetail: 'pages/system/module-management/detail/index' },
    },
    '@/utils/router': { navigateTo: options.navigate || (() => {}) },
    '@/utils/account-scope': { withAccountScope: (x) => x, errorMessage: (e) => e.message },
    './index.module.scss': {},
  }).default
  function nodes(t) {
    if (!t || typeof t !== 'object') return []
    if (Array.isArray(t)) return t.flatMap(nodes)
    return [t, ...nodes(t.props?.children)]
  }
  const render = () => {
    cursor = 0
    return nodes(page())
  }
  const settle = async () => {
    render()
    const jobs = effects
    effects = []
    jobs.forEach((f) => {
      f()
    })
    await new Promise((r) => setImmediate(r))
    return render()
  }
  return {
    render,
    settle,
    invalidate: () => session++,
    show: () => show?.(),
    // 触底加载：与其它列表页一样由 useReachBottom 驱动，不再有手写「加载更多」按钮
    reachBottom: () => { for (const fn of reachBottom) fn(); },
  }
}
test('region browsing opens read-only leaf details and returns to ancestor', async () => {
  const h = mount('region', {
    getRegionTree: async () => [
      {
        code: 1,
        name: '省',
        level: 1,
        parentCode: 0,
        sortOrder: 0,
        children: [{ code: 2, name: '县', level: 3, parentCode: 1, sortOrder: 1 }],
      },
    ],
  })
  let t = await h.settle()
  t.find((n) => n.type === 'ManagementCell').props.onClick()
  t = h.render()
  t.find((n) => n.type === 'ManagementCell').props.onClick()
  t = h.render()
  assert.equal(t.find((n) => n.type === 'DetailRow' && n.props.label === '区划代码').props.value, 2)
  assert.equal(
    t.some((n) => n.type === 'BottomActionBar'),
    false,
  )
  const crumbs = t.find((n) => n.type === 'Breadcrumbs')
  crumbs.props.onNavigate(-1)
  assert.equal(h.render().find((n) => n.type === 'ManagementCell').props.title, '省')
})
test('module list opens independent detail without inline mutation', async () => {
  let path = ''
  const h = mount(
    'module-management',
    { listManagedModules: async () => ({ items: [{ id: 'demo', name: 'Demo', enabled: true }] }) },
    { navigate: (p) => (path = p) },
  )
  const t = await h.settle()
  t.find((n) => n.type === 'ManagementCell').props.onClick()
  assert.match(path, /detail\/index\?id=demo/)
})
test('module toggle failure keeps detail and account switch prevents write', async () => {
  let writes = 0
  const item = { id: 'demo', name: 'Demo', enabled: true, mounted: true, version: '1' }
  const h = mount('module-management/detail', {
    listManagedModules: async () => ({ items: [item] }),
    toggleModule: async () => {
      writes++
      throw Error('失败')
    },
  })
  let t = await h.settle()
  await t.find((n) => n.type === 'BottomActionBar').props.actions[0].onClick()
  t = h.render()
  assert.equal(t.find((n) => n.type === 'DetailHero').props.title, 'Demo')
  assert.equal(t.find((n) => n.type === 'BottomActionBar').props.actions[0].label, '停用模块')
  assert.equal(writes, 1)
  const h2 = mount(
    'module-management/detail',
    { listManagedModules: async () => ({ items: [item] }), toggleModule: async () => writes++ },
    {
      confirm: async () => {
        h2.invalidate()
        return true
      },
    },
  )
  t = await h2.settle()
  await t.find((n) => n.type === 'BottomActionBar').props.actions[0].onClick()
  assert.equal(writes, 1)
})

test('region search keeps all results accessible through load more', async () => {
  const h = mount('region', {
    getRegionTree: async () =>
      Array.from({ length: 151 }, (_, i) => ({
        code: i + 1,
        name: `地区${i}`,
        level: 1,
        parentCode: 0,
        sortOrder: i,
      })),
  })
  let tree = await h.settle()
  tree.find((n) => n.type === 'ManagementSearchBar').props.onChange('地区')
  tree = h.render()
  assert.equal(tree.filter((n) => n.type === 'ManagementCell').length, 50)
  h.reachBottom()
  tree = h.render()
  h.reachBottom()
  tree = h.render()
  h.reachBottom()
  tree = h.render()
  assert.equal(h.render().filter((n) => n.type === 'ManagementCell').length, 151)
})
test('read-only module detail hides toggle and unavailable list explains capability', async () => {
  const h = mount(
    'module-management/detail',
    { listManagedModules: async () => ({ items: [{ id: 'demo', name: 'Demo', enabled: true }] }) },
    { write: false },
  )
  const tree = await h.settle()
  assert.equal(tree.find((n) => n.type === 'BottomActionBar').props.actions.length, 0)
  const missing = mount('module-management', {
    listManagedModules: async () => {
      throw Object.assign(new Error('Not found'), { httpStatus: 404 })
    },
  })
  assert.equal(
    (await missing.settle()).find((n) => n.type === 'ManagementStates').props.errorText,
    '当前服务器未开放模块管理',
  )
})
