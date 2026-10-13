const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTs } = require('./helpers/load-ts.cjs')

const registry = loadTs('src/modules/registry.ts')

const app = (menuId, id = `app-${menuId}`) => ({ id, name: id, icon: 'X', menuId, entry: `pages/${id}/index` })
const groups = [
  { id: 'group-1', name: 'A', apps: [app(11), app(12), app(13)] },
  { id: 'group-2', name: 'B', apps: [app(21), app(22)] },
]

test('getHomeApps puts pinned first, fills with ranked and skips ids without a usable page', () => {
  const result = registry.getHomeApps(groups, { pinned: [22, 404], ranked: [13, 11, 405, 12, 21] })
  assert.deepEqual(result.map((a) => a.menuId), [22, 13, 11, 12, 21])
})

test('getHomeApps truncates to the limit and never repeats an app', () => {
  const result = registry.getHomeApps(groups, { pinned: [11, 11], ranked: [11, 12, 13] }, 2)
  assert.deepEqual(result.map((a) => a.menuId), [11, 12])
  assert.equal(registry.MAX_HOME_APPS, 8)
})

test('getHomeApps falls back to workbench order when the home list is unavailable', () => {
  assert.deepEqual(registry.getHomeApps(groups, null, 3).map((a) => a.menuId), [11, 12, 13])
})

const fs = require('node:fs')
const path = require('node:path')
const { appRoot } = require('./helpers/load-ts.cjs')

const model = loadTs('src/pages/apps/pinned/model.ts', {
  '@/modules/registry': { MAX_HOME_APPS: 8 },
})

test('togglePin adds at the end, removes in place and refuses past the limit', () => {
  assert.deepEqual(model.togglePin([1, 2], 3), [1, 2, 3])
  assert.deepEqual(model.togglePin([1, 2, 3], 2), [1, 3])
  assert.deepEqual(model.togglePin([1, 2], 3, 2), [1, 2])
  assert.deepEqual(model.togglePin([1, 2], 2, 2), [1], 'removing still works when full')
})

test('movePin swaps neighbours and ignores moves past either end', () => {
  assert.deepEqual(model.movePin([1, 2, 3], 1, -1), [2, 1, 3])
  assert.deepEqual(model.movePin([1, 2, 3], 1, 1), [1, 3, 2])
  assert.deepEqual(model.movePin([1, 2, 3], 0, -1), [1, 2, 3])
  assert.deepEqual(model.movePin([1, 2, 3], 2, 1), [1, 2, 3])
})

const scss = new Proxy({}, { get: (_, k) => (k === '__esModule' ? false : k) })
const flat = (v) => (!v || typeof v !== 'object' ? [] : Array.isArray(v) ? v.flatMap(flat) : [v, ...flat(v.props?.children)])

test('ManagementCell renders a leading node and a disabled row ignores taps', () => {
  const { ManagementCell } = loadTs('src/components/management/ManagementList.tsx', {
    react: { useState: (v) => [v, () => {}], useMemo: (fn) => fn() },
    '@tarojs/components': { View: 'View', Text: 'Text', Image: 'Image' },
    '@/components/atoms': { AppText: 'AppText', Avatar: 'Avatar' },
    '@/components/feedback': { StateView: 'StateView' },
    './LineIcon': { LineIcon: 'LineIcon' },
    './ManagementList.module.scss': scss,
  })
  const onClick = () => {}
  const enabled = ManagementCell({ title: '用户', leading: { type: 'AppIcon', props: {} }, onClick })
  assert.ok(flat(enabled).some((n) => n.type === 'AppIcon'))
  assert.equal(enabled.props.onClick, onClick)
  const disabled = ManagementCell({ title: '用户', disabled: true, onClick })
  assert.equal(disabled.props.onClick, undefined)
  assert.equal(disabled.props.hoverClass, undefined)
  assert.match(disabled.props.className, /rowDisabled/)
})

test('编辑页只用现成管理组件并完成路由登记', () => {
  const page = fs.readFileSync(path.join(appRoot, 'src/pages/apps/pinned/index.tsx'), 'utf8')
  for (const name of ['ManagementPageHeader', 'ManagementSearchBar', 'DetailSection', 'ManagementCell', 'Checkbox', 'ActionSheet', 'FormSubmitBar', 'ManagementStates']) {
    assert.match(page, new RegExp(`<${name}\\b`), name)
  }
  assert.doesNotMatch(page, /<Checkbox[^>]*onClick/, 'Checkbox 不拦截点击，由整行切换')
  assert.match(page, /export default withAccountScope\(/)
  const config = fs.readFileSync(path.join(appRoot, 'src/pages/apps/pinned/index.config.ts'), 'utf8')
  assert.match(config, /navigationStyle: 'custom'/)
  const pages = fs.readFileSync(path.join(appRoot, 'src/constants/page-config.ts'), 'utf8')
  assert.match(pages, /'pages\/apps\/pinned\/index'/)
})

const { mountPage } = require('./helpers/mount-page.cjs')

// 草稿里可能残留已不可见的 id（如进入页面后的强制刷新撤销了授权），所有操作必须落在可见列表上
function mountEditPage({ pinned, max = 8 }) {
  const state = {
    menus: [{ id: 'group-1', name: 'A', apps: [app(11), app(12), app(13)] }],
    home: { pinned, ranked: [] },
    loaded: true,
    error: null,
  }
  const saved = []
  const useModuleStore = (select) => select(state)
  useModuleStore.getState = () => ({
    ...state,
    load: async () => {},
    savePins: async (ids) => {
      saved.push(ids)
    },
  })
  const page = mountPage('src/pages/apps/pinned/index.tsx', {
    '@tarojs/taro': { showToast: () => {} },
    '@/components/ApplicationIcon': { ApplicationIcon: 'ApplicationIcon' },
    '@/components/management': Object.fromEntries(
      [
        'ActionSheet',
        'Checkbox',
        'DetailContent',
        'DetailSection',
        'FormSubmitBar',
        'ManagementCell',
        'ManagementFilterBar',
        'ManagementPage',
        'ManagementPageHeader',
        'ManagementSearchBar',
        'ManagementStates',
      ].map((name) => [name, name]),
    ),
    '@/modules/registry': { MAX_HOME_APPS: max, getWorkbenchGroups: (menus) => menus },
    '@/pages/system/_shared/AdminUI': { withAccountScope: (Page) => Page },
    '@/stores/auth': { useAuthStore: (select) => select({ user: { permissions: [] }, enabledModuleIds: [] }) },
    '@/stores/modules': { useModuleStore },
    '@/utils/auth-guard': { useRequireAuth: () => ({ ready: true, allowed: true }) },
    '@/utils/router': { navigateBack: async () => {} },
  })
  const hide = (menuId) => {
    state.menus = state.menus.map((group) => ({ ...group, apps: group.apps.filter((a) => a.menuId !== menuId) }))
    page.rerender()
  }
  const pinnedCells = () => page.all('ManagementCell').filter((n) => !n.props.tag)
  const pickerCell = (menuId) =>
    page.all('ManagementCell').find((n) => n.props.tag && n.props.title === `app-${menuId}`)
  const save = async () => {
    await page.one('FormSubmitBar').props.onSubmit()
    await new Promise(setImmediate)
    return saved.at(-1)
  }
  return { page, hide, pinnedCells, pickerCell, save }
}

test('编辑页的上移作用于可见的已固定项，忽略已不可见的草稿 id', async () => {
  const edit = mountEditPage({ pinned: [11, 12, 13] })
  edit.hide(12)
  assert.deepEqual(edit.pinnedCells().map((n) => n.props.title), ['app-11', 'app-13'])
  edit.pinnedCells()[1].props.onClick()
  edit.page.one('ActionSheet').props.items.find((item) => item.key === 'up').onClick()
  assert.deepEqual(edit.pinnedCells().map((n) => n.props.title), ['app-13', 'app-11'])
  assert.deepEqual(await edit.save(), [13, 11])
})

test('编辑页的上限按可见项计算，不可见的草稿 id 不会让可勾选的行失效', async () => {
  const edit = mountEditPage({ pinned: [11, 12], max: 2 })
  edit.hide(12)
  const row = edit.pickerCell(13)
  assert.equal(row.props.disabled, false)
  row.props.onClick()
  assert.equal(edit.pickerCell(13).props.tag.props.checked, true)
  assert.deepEqual(await edit.save(), [11, 13])
})
