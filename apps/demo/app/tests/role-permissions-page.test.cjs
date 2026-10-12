const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTs } = require('./helpers/load-ts.cjs')

const scssMock = () => new Proxy({}, { get: (_, key) => (key === '__esModule' ? false : key) })

const MENUS = [
  {
    id: 1,
    name: '系统管理',
    type: 0,
    parentId: 0,
    children: [
      {
        id: 11,
        name: '用户管理',
        type: 1,
        parentId: 1,
        path: '/system/user',
        children: [{ id: 111, name: '新增用户', type: 2, parentId: 11 }],
      },
      { id: 12, name: '角色管理', type: 1, parentId: 1, path: '/system/role' },
    ],
  },
]

/** 同时拥有菜单、功能、工作台授权的测试角色。 */
function seedRole() {
  return {
    id: 7,
    name: '测试角色',
    menuIds: [1, 11],
    permissionCodes: ['system:user:read', 'system:user:create'],
    appMenuIds: [500, 501],
  }
}

/**
 * 内存后端：与 RoleService.updateRole 相同的局部更新语义——缺省字段不改。
 * 写入时先整体校验再提交，失败不改动已有数据。
 */
function fakeBackend({ failUpdate = false } = {}) {
  let role = seedRole()
  const updates = []
  return {
    updates,
    snapshot: () => structuredClone(role),
    api: {
      getAdminRole: async (id) => {
        assert.equal(id, role.id)
        return structuredClone(role)
      },
      updateAdminRole: async (id, data) => {
        updates.push({ id, data: structuredClone(data) })
        if (failUpdate) throw new Error('网络异常')
        const next = { ...role }
        for (const key of ['menuIds', 'permissionCodes', 'appMenuIds']) {
          if (data[key] !== undefined) next[key] = [...data[key]]
        }
        role = next
        return structuredClone(role)
      },
    },
  }
}

function mount({ backend, canWrite = true } = {}) {
  const toasts = []
  const back = []
  const states = []
  const refs = []
  const effects = []
  let stateIndex = 0
  let refIndex = 0
  let effectIndex = 0

  const Page = loadTs('src/pages/system/role/permissions/index.tsx', {
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
      useRef(initial) {
        const index = refIndex++
        if (!(index in refs)) refs[index] = { current: initial }
        return refs[index]
      },
      useEffect(effect, deps) {
        const index = effectIndex++
        const prev = effects[index]
        if (!prev || deps.some((value, i) => value !== prev.deps[i])) {
          effects[index] = { deps, effect, pending: true }
        }
      },
      useMemo: (fn) => fn(),
    },
    '@tarojs/components': { View: 'View', Text: 'Text' },
    '@tarojs/taro': {
      useRouter: () => ({ params: { id: '7' } }),
      showToast: (options) => toasts.push(options),
    },
    '@/api/admin/role': backend.api,
    '@/api/admin/menu': { getAdminMenuTree: async () => structuredClone(MENUS) },
    '@/api/client': { getSessionVersion: () => 1 },
    '@/components/management': {
      Checkbox: 'Checkbox',
      FormSubmitBar: 'FSB',
      ManagementFilterBar: 'MFB',
      ManagementPage: 'MP',
      ManagementSearchBar: 'MSB',
      ManagementStates: 'MS',
    },
    '@/components/molecules': { PageHeader: 'PH' },
    '@/hooks': { useCanWrite: () => canWrite },
    '@/utils/auth-guard': {
      useRequireAuth: () => ({ ready: true, allowed: true }),
      canWriteModuleNow: () => canWrite,
    },
    '@/utils/router': { navigateBack: () => back.push(true) },
    '../../_shared/AdminUI': { withAccountScope: (Page) => Page },
    './permissions.module.scss': scssMock(),
  }).default

  function render() {
    stateIndex = 0
    refIndex = 0
    effectIndex = 0
    return Page()
  }
  async function settle() {
    for (let i = 0; i < 4; i++) {
      render()
      for (const entry of effects) {
        if (entry?.pending) {
          entry.pending = false
          entry.effect()
        }
      }
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
  function click(tree, name) {
    const node = find(tree, (n) => n.props?.['aria-label'] === name)[0]
    assert.ok(node, `缺少权限行 ${name}`)
    node.props.onClick()
  }
  function submitBar(tree) {
    return find(tree, (n) => n.type === 'FSB')[0]
  }
  return { settle, click, submitBar, toasts, back }
}

test('保存菜单授权只提交 menuIds，功能与工作台授权保持不变', async () => {
  const backend = fakeBackend()
  const page = mount({ backend })
  let tree = await page.settle()
  page.click(tree, '角色管理')
  tree = await page.settle()
  page.submitBar(tree).props.onSubmit()
  await page.settle()

  assert.equal(backend.updates.length, 1)
  assert.deepEqual(Object.keys(backend.updates[0].data), ['menuIds'])

  const saved = await backend.api.getAdminRole(7)
  const seed = seedRole()
  assert.deepEqual([...saved.menuIds].sort((a, b) => a - b), [1, 11, 12])
  assert.deepEqual(saved.permissionCodes, seed.permissionCodes)
  assert.deepEqual(saved.appMenuIds, seed.appMenuIds)
  assert.equal(page.toasts.at(-1).title, '权限已保存')
})

test('取消菜单授权同样不影响功能与工作台授权', async () => {
  const backend = fakeBackend()
  const page = mount({ backend })
  let tree = await page.settle()
  page.click(tree, '用户管理')
  tree = await page.settle()
  page.submitBar(tree).props.onSubmit()
  await page.settle()

  const saved = backend.snapshot()
  const seed = seedRole()
  assert.deepEqual(saved.menuIds, [1])
  assert.deepEqual(saved.permissionCodes, seed.permissionCodes)
  assert.deepEqual(saved.appMenuIds, seed.appMenuIds)
})

test('无写权限时不显示保存按钮且不会提交', async () => {
  const backend = fakeBackend()
  const page = mount({ backend, canWrite: false })
  const tree = await page.settle()
  assert.equal(page.submitBar(tree), undefined)
  assert.deepEqual(backend.updates, [])
  assert.deepEqual(backend.snapshot(), seedRole())
})

test('保存失败时提示错误、不返回上一页且已有授权不被破坏', async () => {
  const backend = fakeBackend({ failUpdate: true })
  const page = mount({ backend })
  let tree = await page.settle()
  page.click(tree, '角色管理')
  tree = await page.settle()
  page.submitBar(tree).props.onSubmit()
  await page.settle()

  assert.equal(backend.updates.length, 1)
  assert.deepEqual(backend.snapshot(), seedRole())
  assert.equal(page.toasts.at(-1).title, '网络异常')
  assert.equal(page.back.length, 0)
})
