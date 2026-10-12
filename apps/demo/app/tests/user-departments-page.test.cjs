const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTs } = require('./helpers/load-ts.cjs')

const scssMock = () => new Proxy({}, { get: (_, key) => (key === '__esModule' ? false : key) })

const deptTree = loadTs('src/components/management/deptTree.ts')

const TREE = [
  {
    id: 1,
    name: '上海总公司',
    children: [
      { id: 11, name: '研发部门', children: null },
      { id: 12, name: '市场部门', children: null },
    ],
  },
]

/**
 * JSX 的 <Foo /> 不会调用 Foo，只把它存成元素的 type。
 * 因此组件一律 mock 成不透明字符串，再通过元素的 props 驱动页面自己的接线；
 * 组件自身的渲染由 dept-tree / selection-footer 测试覆盖。
 * state 按调用序号持久化，每次 render 重置序号 —— 与 user-detail.test.cjs 同一手法。
 */
function mount({ params = {}, tree = TREE, draftIds, fetchTree } = {}) {
  const routes = []
  const back = []
  const wrote = []
  const drafted = new Map()
  if (draftIds) drafted.set('user-depts', [...draftIds])
  const states = []
  const effects = []
  let stateIndex = 0
  let effectIndex = 0
  const didShow = []

  const draftState = {
    readDraft: (k) => drafted.get(k) ?? [],
    writeDraft: (k, v) => wrote.push({ key: k, ids: v }),
  }

  const Page = loadTs('src/pages/system/user/departments/index.tsx', {
    react: {
      useState(initial) {
        const index = stateIndex++
        if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial
        return [
          states[index],
          (next) => {
            states[index] = typeof next === 'function' ? next(states[index]) : next
          },
        ]
      },
      useEffect(effect, deps) {
        const index = effectIndex++
        const prev = effects[index]
        if (!prev || deps.some((value, i) => value !== prev.deps[i])) {
          effects[index] = { deps, effect }
        }
      },
      useMemo: (fn) => fn(),
    },
    '@tarojs/components': { View: 'View', Text: 'Text', Input: 'Input' },
    '@tarojs/taro': {
      useRouter: () => ({ params }),
      useDidShow: (callback) => didShow.push(callback),
    },
    '@/components/management': {
      DepartmentTreeNavigator: 'NAV',
      SelectionFooter: 'FOOT',
      childOf: deptTree.childOf,
      findDeptPath: deptTree.findDeptPath,
      searchDepts: deptTree.searchDepts,
    },
    '@/components/feedback': { StateView: 'SV' },
    '@/stores/selectionDraft': {
      DRAFT_KEYS: { userDepts: 'user-depts', userRoles: 'user-roles' },
      useSelectionDraft: Object.assign(
        (selector) => selector(draftState),
        { getState: () => draftState },
      ),
    },
    '@/utils/auth-guard': {
      useRequireAuth: () => ({ ready: true, allowed: true }),
    },
    '@/utils/router': {
      navigateBack: () => back.push(true),
      navigateTo: (p) => routes.push(p),
    },
    '@/api': { adminDeptApi: { getAdminDeptTree: fetchTree || (async () => tree) } },
    './index.module.scss': scssMock(),
  }).default

  function render() {
    stateIndex = 0
    effectIndex = 0
    didShow.length = 0
    return Page()
  }
  async function settle() {
    for (let i = 0; i < 4; i++) {
      render()
      const pending = effects.splice(0)
      for (const { effect } of pending) effect()
      for (const cb of didShow.splice(0)) cb()
      await new Promise(setImmediate)
    }
    return render()
  }
  function find(tree, pred, out = []) {
    const walk = (node) => {
      if (Array.isArray(node)) return node.forEach(walk)
      if (!node || typeof node !== 'object') return
      if (pred(node)) out.push(node)
      walk(node.props?.children)
    }
    walk(tree)
    return out
  }
  function el(tree, type) {
    return find(tree, (n) => n.type === type)[0]
  }
  function text(tree) {
    if (typeof tree === 'string' || typeof tree === 'number') return String(tree)
    if (!tree) return ''
    if (Array.isArray(tree)) return tree.map(text).join('')
    return text(tree.props?.children)
  }
  return { render, settle, find, el, text, wrote, back, routes }
}

test('根层把整棵树交给导航器作为当前层节点', async () => {
  const page = mount()
  const tree = await page.settle()
  assert.deepEqual(page.el(tree, 'NAV').props.nodes.map((n) => n.name), ['上海总公司'])
  assert.deepEqual(page.el(tree, 'NAV').props.path, [])
})

test('进入一级后当前层变成其子节点并累积面包屑', async () => {
  const page = mount()
  let tree = await page.settle()
  const rootNode = page.el(tree, 'NAV').props.nodes[0]
  page.el(tree, 'NAV').props.onEnter(rootNode)
  tree = await page.settle()
  assert.deepEqual(page.el(tree, 'NAV').props.nodes.map((n) => n.name), ['研发部门', '市场部门'])
  assert.deepEqual(page.el(tree, 'NAV').props.path.map((p) => p.name), ['上海总公司'])
})

test('勾选后确定把选中写入草稿并返回', async () => {
  const page = mount()
  let tree = await page.settle()
  page.el(tree, 'NAV').props.onToggle(11)
  tree = await page.settle()
  page.el(tree, 'FOOT').props.onConfirm()
  assert.deepEqual(page.wrote, [{ key: 'user-depts', ids: [11] }])
  assert.equal(page.back.length, 1)
})

test('重复勾选同一项可取消', async () => {
  const page = mount()
  let tree = await page.settle()
  page.el(tree, 'NAV').props.onToggle(11)
  tree = await page.settle()
  page.el(tree, 'NAV').props.onToggle(11)
  tree = await page.settle()
  page.el(tree, 'FOOT').props.onConfirm()
  assert.deepEqual(page.wrote, [{ key: 'user-depts', ids: [] }])
})

test('readonly 模式确定时绝不写草稿（Review Focus #3）', async () => {
  const page = mount({ params: { mode: 'readonly' } })
  const tree = await page.settle()
  page.el(tree, 'FOOT').props.onConfirm()
  assert.deepEqual(page.wrote, [])
  assert.equal(page.back.length, 1)
})

test('readonly 模式把 readonly 传给导航器，checkbox 变为不可交互', async () => {
  const page = mount({ params: { mode: 'readonly' } })
  const tree = await page.settle()
  assert.equal(page.el(tree, 'NAV').props.readonly, true)
})

test('取消时既不写草稿也只返回一次', async () => {
  const page = mount()
  const tree = await page.settle()
  page.el(tree, 'FOOT').props.onCancel()
  assert.deepEqual(page.wrote, [])
  assert.equal(page.back.length, 1)
})

test('ids 查询参数作为无草稿时的初始选中', async () => {
  const page = mount({ params: { ids: '11,12' } })
  const tree = await page.settle()
  assert.equal(page.el(tree, 'FOOT').props.count, 2)
  page.el(tree, 'FOOT').props.onConfirm()
  assert.deepEqual(page.wrote[0].ids, [11, 12])
})

test('草稿优先于 ids 查询参数', async () => {
  const page = mount({ params: { ids: '11,12' }, draftIds: [99] })
  const tree = await page.settle()
  page.el(tree, 'FOOT').props.onConfirm()
  assert.deepEqual(page.wrote[0].ids, [99])
})

test('无任何初始选中时仍能正常渲染并确定空数组（新建用户场景）', async () => {
  const page = mount({ params: {} })
  const tree = await page.settle()
  assert.equal(page.el(tree, 'FOOT').props.count, 0)
  page.el(tree, 'FOOT').props.onConfirm()
  assert.deepEqual(page.wrote, [{ key: 'user-depts', ids: [] }])
})

test('ids 参数含非数字项时被忽略', async () => {
  const page = mount({ params: { ids: '11,,abc,12' } })
  const tree = await page.settle()
  page.el(tree, 'FOOT').props.onConfirm()
  assert.deepEqual(page.wrote[0].ids, [11, 12])
})

test('已选项按完整路径传给底栏，供跨分支消歧', async () => {
  const page = mount({ params: { ids: '11' } })
  const tree = await page.settle()
  assert.deepEqual(page.el(tree, 'FOOT').props.items, [
    { id: 11, label: '研发部门', path: ['上海总公司', '研发部门'] },
  ])
})

test('搜索后主体从导航器切换为扁平路径结果', async () => {
  const page = mount()
  let tree = await page.settle()
  page.find(tree, (n) => n.type === 'Input')[0].props.onInput({ detail: { value: '研发' } })
  tree = await page.settle()
  assert.equal(page.el(tree, 'NAV'), undefined)
  assert.equal(page.find(tree, (n) => n.props?.['aria-label'] === '搜索结果-研发部门').length, 1)
  assert.match(page.text(tree), /上海总公司 \/ 研发部门/)
})

test('点击搜索结果跳进该层级、清空关键词并高亮目标', async () => {
  const page = mount()
  let tree = await page.settle()
  page.find(tree, (n) => n.type === 'Input')[0].props.onInput({ detail: { value: '研发' } })
  tree = await page.settle()
  page.find(tree, (n) => n.props?.['aria-label'] === '搜索结果-研发部门')[0].props.onClick()
  tree = await page.settle()
  assert.equal(page.el(tree, 'NAV').props.path.map((p) => p.name).join('>'), '上海总公司>研发部门')
  assert.equal(page.el(tree, 'NAV').props.highlightId, 11)
  assert.equal(page.find(tree, (n) => n.type === 'Input')[0].props.value, '')
})

test('搜索无结果时展示空态', async () => {
  const page = mount()
  let tree = await page.settle()
  page.find(tree, (n) => n.type === 'Input')[0].props.onInput({ detail: { value: '不存在' } })
  tree = await page.settle()
  assert.match(page.text(tree), /没有匹配的部门/)
})

test('部门树为空时页面仍可确定空选择', async () => {
  const page = mount({ tree: [] })
  const tree = await page.settle()
  page.el(tree, 'FOOT').props.onConfirm()
  assert.deepEqual(page.wrote, [{ key: 'user-depts', ids: [] }])
})

test('加载失败后点击重试会重新拉取部门树，而不是卡在错误态', async () => {
  let attempts = 0
  const page = mount({
    fetchTree: async () => {
      attempts++
      if (attempts === 1) throw new Error('网络异常')
      return TREE
    },
  })
  const tree = await page.settle()
  const sv = page.el(tree, 'SV')
  assert.ok(sv.props.onRetry, 'StateView 应暴露重试回调')
  sv.props.onRetry()
  // 生产环境里 useDidShow 不会因为点重试而再次触发，
  // 因此重试必须由页面自身的 load 完成，而不是等下一次 onShow
  const after = page.render()
  await new Promise(setImmediate)
  assert.equal(attempts, 2, '点重试后必须真正重新发起请求')
  assert.ok(page.find(after, () => true).length > 0)
})
