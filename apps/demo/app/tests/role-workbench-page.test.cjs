const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTs } = require('./helpers/load-ts.cjs')

const scssMock = () => new Proxy({}, { get: (_, key) => (key === '__esModule' ? false : key) })

/** 工作台：分组（type 0）下挂入口（type 1）。 */
const APP_MENUS = [
  {
    id: 500,
    name: '常用',
    type: 0,
    status: '1',
    children: [
      { id: 501, name: '通讯录', type: 1, status: '1', page: 'pages/contacts/index' },
      { id: 502, name: '审批', type: 1, status: '0', page: 'pages/approval/index' },
    ],
  },
  {
    id: 600,
    name: '系统',
    type: 0,
    status: '0',
    children: [{ id: 601, name: '用户管理', type: 1, status: '1', page: 'pages/system/user/index' }],
  },
]

function seedRole() {
  return {
    id: 7,
    name: '测试角色',
    menuIds: [1, 11],
    permissionCodes: ['system:user:read', 'system:user:create'],
    appMenuIds: [500, 501],
  }
}

/** 内存后端：与 RoleService.updateRole 相同的局部更新语义——缺省字段不改。 */
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

  const Page = loadTs('src/pages/system/role/workbench/index.tsx', {
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
    '@/api/admin/appMenu': { getAdminAppMenuTree: async () => structuredClone(APP_MENUS) },
    '@/api/client': { getSessionVersion: () => 1 },
    '@/components/management': {
      Checkbox: 'Checkbox',
      FormSubmitBar: 'FSB',
      ManagementPage: 'MP',
      ManagementPageHeader: 'MPH',
      ManagementStates: 'MS',
    },
    '@/hooks': { useCanWrite: () => canWrite },
    '@/utils/auth-guard': {
      useRequireAuth: () => ({ ready: true, allowed: true }),
      canWriteModuleNow: () => canWrite,
    },
    '@/utils/router': { navigateBack: () => back.push(true) },
    '@/utils/account-scope': { withAccountScope: (Page) => Page },
    '../permissions/permissions.module.scss': scssMock(),
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
    assert.ok(node, `缺少入口行 ${name}`)
    node.props.onClick()
  }
  function submitBar(tree) {
    return find(tree, (n) => n.type === 'FSB')[0]
  }
  function texts(tree) {
    return find(tree, (n) => n.type === 'Text').map((n) => [].concat(n.props.children).join(''))
  }
  async function save() {
    const tree = await settle()
    submitBar(tree).props.onSubmit()
    await settle()
  }
  return { settle, click, submitBar, texts, save, toasts, back }
}

const sortedIds = (list) => [...list].sort((a, b) => a - b)

test('保存工作台授权只提交 appMenuIds，且补全所属分组 id', async () => {
  const backend = fakeBackend()
  const page = mount({ backend })
  page.click(await page.settle(), '用户管理')
  await page.save()

  assert.equal(backend.updates.length, 1)
  assert.deepEqual(Object.keys(backend.updates[0].data), ['appMenuIds'])
  const saved = backend.snapshot()
  assert.deepEqual(sortedIds(saved.appMenuIds), [500, 501, 600, 601])
  assert.equal(page.toasts.at(-1).title, '权限已保存')
})

test('工作台授权不影响菜单与功能授权；取消最后一个入口时分组一并移除', async () => {
  const backend = fakeBackend()
  const page = mount({ backend })
  page.click(await page.settle(), '通讯录')
  await page.save()

  const saved = backend.snapshot()
  const seed = seedRole()
  assert.deepEqual(saved.appMenuIds, [])
  assert.deepEqual(saved.menuIds, seed.menuIds)
  assert.deepEqual(saved.permissionCodes, seed.permissionCodes)
})

test('初始勾选只取入口，禁用项带「（已禁用）」后缀，底部计数只数入口', async () => {
  const page = mount({ backend: fakeBackend() })
  const shown = page.texts(await page.settle())
  assert.ok(shown.includes('已选 1 个入口'))
  assert.ok(shown.includes('审批（已禁用）'))
  assert.ok(shown.includes('系统（已禁用）'))
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
  page.click(await page.settle(), '用户管理')
  await page.save()

  assert.equal(backend.updates.length, 1)
  assert.deepEqual(backend.snapshot(), seedRole())
  assert.equal(page.toasts.at(-1).title, '网络异常')
  assert.equal(page.back.length, 0)
})

test('工作台授权页已注册路由、页面与模块权限，详情页与编辑页有入口', () => {
  const fs = require('node:fs')
  const path = require('node:path')
  const src = (file) => fs.readFileSync(path.resolve(__dirname, '../src', file), 'utf8')
  assert.match(src('constants/routes.ts'), /roleWorkbench: 'pages\/system\/role\/workbench\/index'/)
  assert.match(src('constants/page-config.ts'), /'pages\/system\/role\/workbench\/index'/)
  assert.match(
    src('modules/registry.ts'),
    /'pages\/system\/role\/workbench\/index': \{\s*moduleId: 'system-role',\s*permissions: \['system:role:update', 'system:role:grant'\],/,
  )
  assert.match(src('pages/system/role/detail/index.tsx'), /SYSTEM_PAGES\.roleWorkbench/)
  assert.match(src('pages/system/role/form/index.tsx'), /SYSTEM_PAGES\.roleWorkbench/)
})

test('工作台授权摘要只数入口，拿不到工作台树时退化为不带数字的文案', () => {
  const { appMenuEntrySummary } = loadTs('src/pages/system/role/permissions.ts')
  assert.equal(appMenuEntrySummary([500, 501, 600, 601], APP_MENUS), '2 个入口')
  assert.equal(appMenuEntrySummary([], APP_MENUS), '0 个入口')
  assert.equal(appMenuEntrySummary([500, 501], null), '已配置')
  assert.equal(appMenuEntrySummary(undefined, null), '未配置')
})
