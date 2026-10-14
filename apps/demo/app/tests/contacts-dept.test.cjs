const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTs } = require('./helpers/load-ts.cjs')
const { mountPage } = require('./helpers/mount-page.cjs')

function renderDepartment(name) {
  const titles = []
  const Page = loadTs('src/pages/contacts/dept/index.tsx', {
    react: {
      useState: (initial) => [initial, () => {}],
      useEffect: (effect) => effect(),
    },
    '@tarojs/components': { View: 'view', Text: 'text' },
    '@tarojs/taro': {
      useRouter: () => ({ params: { id: '1', name } }),
      setNavigationBarTitle: ({ title }) => titles.push(title),
    },
    '@/components/atoms': { Avatar: 'avatar', AppText: 'app-text', Tag: 'Tag' },
    '@/components/feedback': { StateView: 'StateView' },
    '@/components/molecules': Object.fromEntries(
      ['ListItem', 'SectionHeader'].map((k) => [k, k]),
    ),
    '@/components/management': Object.fromEntries(
      [
        'ManagementCell',
        'ManagementList',
        'ManagementPage',
        'ManagementPageHeader',
        'ManagementStates',
      ].map((k) => [k, k]),
    ),
    '@/components/layout': { PageContainer: 'page-container' },
    '@/api': { contactsApi: { getDeptUsers: async () => [] } },
    '@/utils/auth-guard': { useRequireAuth: () => ({ ready: true, allowed: true }) },
    '@/utils/account-scope': { withAccountScope: (c) => c, errorMessage: (e) => e.message },
    './index.module.scss': {},
  }).default
  const tree = Page()
  return { heading: tree.props.children[0].props.title, title: titles[0] }
}

test('department detail decodes the route name for its heading and navigation title', () => {
  const result = renderDepartment('%E4%B8%8A%E6%B5%B7%E6%80%BB%E5%85%AC%E5%8F%B8')
  assert.equal(result.heading, '上海总公司')
  assert.equal(result.title, '上海总公司成员')
})

test('department detail accepts plain names, missing names and malformed percent escapes', () => {
  for (const [input, expected] of [
    ['研发部', '研发部'],
    [undefined, '部门'],
    ['', '部门'],
    ['销售100%', '销售100%'],
    ['%E4%B8', '%E4%B8'],
    ['研发%26支持%2B服务', '研发&支持+服务'],
  ]) {
    const result = renderDepartment(input)
    assert.equal(result.heading, expected)
    assert.equal(result.title, `${expected}成员`)
  }
})

// ---- 通讯录部门树 ----

const TREE = [
  {
    id: 1,
    name: '上海总公司',
    type: 0,
    children: [
      {
        id: 11,
        name: '研发部门',
        type: 0,
        children: [{ id: 111, name: '前端组', type: 0, children: null }],
      },
      { id: 12, name: '市场部门', type: 0, children: null },
    ],
  },
  { id: 2, name: '北京分公司', type: 0, children: null },
]

const scss = new Proxy({}, { get: (_, key) => (key === '__esModule' ? false : key) })

function mountIndex() {
  const calls = { tree: 0, nav: [] }
  const page = mountPage('src/pages/contacts/index/index.tsx', {
    '@tarojs/components': { View: 'View', Text: 'Text' },
    '@tarojs/taro': { useDidShow: () => {}, useRouter: () => ({ params: {} }) },
    '@/components/atoms': { AppText: 'AppText', Tag: 'Tag' },
    '@/components/feedback': { StateView: 'StateView' },
    '@/components/layout': { PageContainer: 'page-container' },
    '@/components/molecules': Object.fromEntries(
      ['ListItem', 'SectionHeader'].map((k) => [k, k]),
    ),
    '@/components/management': Object.fromEntries(
      [
        'ManagementCell',
        'ManagementList',
        'ManagementPage',
        'ManagementPageHeader',
        'ManagementStates',
        'ManagementTreeCell',
      ].map((k) => [k, k]),
    ),
    '@/api': {
      contactsApi: {
        getDeptTree: async () => {
          calls.tree++
          return TREE
        },
      },
    },
    '@/utils/auth-guard': { useRequireAuth: () => ({ ready: true, allowed: true }) },
    '@/utils/account-scope': { withAccountScope: (c) => c, errorMessage: (e) => e.message },
    '@/utils/router': { navigateTo: (u) => calls.nav.push(u) },
    '@/constants/routes': { SECONDARY_PAGES: { contactsDept: 'pages/contacts/dept/index' } },
    './index.module.scss': scss,
  })
  return { page, calls }
}

test('通讯录部门树：初始仅展示根层；首屏只请求一次', async () => {
  const { page, calls } = mountIndex()
  await page.settle()
  assert.deepEqual(
    page.all('ManagementTreeCell').map((c) => c.props.title),
    ['上海总公司', '北京分公司'],
  )
  assert.equal(calls.tree, 1)
})

test('通讯录部门树：展开父级才出现子级；点击叶子跳转到成员页', async () => {
  const { page, calls } = mountIndex()
  await page.settle()
  let rows = page.all('ManagementTreeCell')
  assert.deepEqual(
    rows.map((c) => c.props.title),
    ['上海总公司', '北京分公司'],
  )
  // 展开上海总公司，研发部门出现；前端组仍隐藏
  rows[0].props.onToggle()
  rows = page.all('ManagementTreeCell')
  assert.deepEqual(
    rows.map((c) => c.props.title),
    ['上海总公司', '研发部门', '市场部门', '北京分公司'],
  )
  assert.equal(rows[1].props.depth, 1)
  assert.equal(rows[1].props.hasChildren, true)
  // 展开研发部门，前端组出现
  rows[1].props.onToggle()
  rows = page.all('ManagementTreeCell')
  assert.deepEqual(
    rows.map((c) => c.props.title),
    ['上海总公司', '研发部门', '前端组', '市场部门', '北京分公司'],
  )
  assert.equal(rows[2].props.depth, 2)
  // 点击叶子跳转
  rows[2].props.onClick()
  assert.deepEqual(calls.nav, ['/pages/contacts/dept/index?id=111&name=%E5%89%8D%E7%AB%AF%E7%BB%84'])
})

test('通讯录部门树：点击行导航到详情页；点击箭头只切换展开态', async () => {
  const { page, calls } = mountIndex()
  await page.settle()
  const root = page.all('ManagementTreeCell').find((c) => c.props.title === '上海总公司')
  root.props.onClick()
  assert.deepEqual(calls.nav, [
    '/pages/contacts/dept/index?id=1&name=%E4%B8%8A%E6%B5%B7%E6%80%BB%E5%85%AC%E5%8F%B8',
  ])
  // 重新挂载避免上文点击带来的导航计数干扰
  const fresh = mountIndex()
  await fresh.page.settle()
  const freshRoot = fresh.page.all('ManagementTreeCell').find((c) => c.props.title === '上海总公司')
  freshRoot.props.onToggle()
  assert.equal(fresh.page.all('ManagementTreeCell').some((c) => c.props.title === '研发部门'), true)
  assert.deepEqual(fresh.calls.nav, [])
})
