const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTs } = require('./helpers/load-ts.cjs')

const scssMock = () => new Proxy({}, { get: (_, key) => (key === '__esModule' ? false : key) })

const ROLES = [
  { id: 37, name: '管理员' },
  { id: 52, name: '审核员' },
  { id: 53, name: '访客' },
]

/**
 * JSX 的 <Foo /> 不会调用 Foo，只把它存成元素的 type。
 * 因此组件 mock 成不透明字符串，页面接线通过元素 props 驱动；
 * SelectionFooter 自身的渲染由 selection-footer.test.cjs 覆盖。
 */
function mount({ params = {}, roles = ROLES, draftIds } = {}) {
  const back = []
  const wrote = []
  const drafted = new Map()
  if (draftIds) drafted.set('user-roles', [...draftIds])
  const states = []
  const effects = []
  let stateIndex = 0
  let effectIndex = 0
  const didShow = []

  const draftState = {
    readDraft: (k) => drafted.get(k) ?? [],
    writeDraft: (k, v) => wrote.push({ key: k, ids: v }),
  }

  const Page = loadTs('src/pages/system/user/roles/index.tsx', {
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
    '@/components/management': { SelectionFooter: 'FOOT', ManagementFilterBar: 'FilterBar', ManagementSearchBar: 'SearchBar' },
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
    '@/utils/router': { navigateBack: () => back.push(true) },
    '@/api': {
      adminRoleApi: {
        listAdminRoles: async () => ({ data: roles, pagination: { totalPages: 1 } }),
      },
    },
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
  /** 角色行：aria-label 为「角色-<名称>」，点击切换选中 */
  function row(tree, name) {
    return find(tree, (n) => n.props?.['aria-label'] === `角色-${name}`)[0]
  }
  function click(tree, name) {
    const node = row(tree, name)
    assert.ok(node, `缺少角色行 ${name}`)
    node.props.onClick()
  }
  return { render, settle, find, el, text, row, click, wrote, back }
}

test('角色行按名称渲染并可点击', async () => {
  const page = mount()
  const tree = await page.settle()
  assert.ok(page.find(tree, (n) => n.props?.['aria-label'] === '角色-管理员').length)
  assert.ok(page.find(tree, (n) => n.props?.['aria-label'] === '角色-访客').length)
})

test('点击角色切换选中并可确定', async () => {
  const page = mount()
  let tree = await page.settle()
  page.click(tree, '审核员')
  tree = await page.settle()
  page.el(tree, 'FOOT').props.onConfirm()
  assert.deepEqual(page.wrote, [{ key: 'user-roles', ids: [52] }])
  assert.equal(page.back.length, 1)
})

test('重复点击同一角色可取消选中', async () => {
  const page = mount()
  let tree = await page.settle()
  page.click(tree, '审核员')
  tree = await page.settle()
  page.click(tree, '审核员')
  tree = await page.settle()
  page.el(tree, 'FOOT').props.onConfirm()
  assert.deepEqual(page.wrote, [{ key: 'user-roles', ids: [] }])
})

test('可多选多个角色', async () => {
  const page = mount()
  let tree = await page.settle()
  page.click(tree, '管理员')
  tree = await page.settle()
  page.click(tree, '访客')
  tree = await page.settle()
  page.el(tree, 'FOOT').props.onConfirm()
  assert.deepEqual(page.wrote[0].ids, [37, 53])
})

test('readonly 模式不写草稿', async () => {
  const page = mount({ params: { mode: 'readonly' } })
  const tree = await page.settle()
  page.el(tree, 'FOOT').props.onConfirm()
  assert.deepEqual(page.wrote, [])
  assert.equal(page.back.length, 1)
})

test('readonly 模式下角色行不可点击', async () => {
  const page = mount({ params: { mode: 'readonly' } })
  const tree = await page.settle()
  assert.equal(page.row(tree, '管理员').props.onClick, undefined)
})

test('草稿优先于 ids 参数', async () => {
  const page = mount({ params: { ids: '37' }, draftIds: [53] })
  const tree = await page.settle()
  page.el(tree, 'FOOT').props.onConfirm()
  assert.deepEqual(page.wrote[0].ids, [53])
})

test('ids 参数作为初始选中', async () => {
  const page = mount({ params: { ids: '37,52' } })
  const tree = await page.settle()
  assert.equal(page.el(tree, 'FOOT').props.count, 2)
  page.el(tree, 'FOOT').props.onConfirm()
  assert.deepEqual(page.wrote[0].ids, [37, 52])
})

test('已选角色按名称传给底栏', async () => {
  const page = mount({ params: { ids: '37' } })
  const tree = await page.settle()
  assert.deepEqual(page.el(tree, 'FOOT').props.items, [{ id: 37, label: '管理员', path: [] }])
})

test('搜索按名称过滤角色', async () => {
  const page = mount()
  let tree = await page.settle()
  page.find(tree, (n) => n.type === 'SearchBar')[0].props.onChange('审核')
  tree = await page.settle()
  assert.equal(page.row(tree, '管理员'), undefined)
  assert.ok(page.row(tree, '审核员'))
})

test('搜索无匹配时展示空态', async () => {
  const page = mount()
  let tree = await page.settle()
  page.find(tree, (n) => n.type === 'SearchBar')[0].props.onChange('不存在')
  tree = await page.settle()
  assert.match(page.text(tree), /没有匹配的角色/)
})

test('角色为空时展示空态', async () => {
  const page = mount({ roles: [] })
  const tree = await page.settle()
  assert.match(page.text(tree), /暂无可分配角色/)
})

test('取消时既不写草稿也只返回一次', async () => {
  const page = mount()
  const tree = await page.settle()
  page.el(tree, 'FOOT').props.onCancel()
  assert.deepEqual(page.wrote, [])
  assert.equal(page.back.length, 1)
})