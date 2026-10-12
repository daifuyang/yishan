const assert = require('node:assert/strict')
const test = require('node:test')
const { mountPage } = require('./helpers/mount-page.cjs')

const ITEM = { id: 9, name: 'banner.png', originalName: 'IMG.png', kind: 'image', folderId: 7, status: '1', metadata: { alt: 'x' } }
const FOLDERS = [{ id: 7, name: '首页素材', status: '1', children: [] }]
const scss = new Proxy({}, { get: (_, k) => (k === '__esModule' ? false : k) })
const LIST = 'system:attachment:list'

function mount({ permissions = [LIST, 'system:attachment:update'], update, folders } = {}) {
  const calls = { updates: [], back: 0 }
  let version = 1
  const page = mountPage('src/pages/system/attachments/form/index.tsx', {
    '@tarojs/components': { View: 'View', Text: 'Text' },
    '@tarojs/taro': { showToast() {}, setNavigationBarTitle() {} },
    '@/api/admin/attachments': {
      getAttachment: async () => ITEM,
      getFolderTree: folders || (async () => FOLDERS),
      updateAttachment: update || (async (id, data) => { calls.updates.push({ id, data }); return ITEM }),
    },
    '@/api/client': { getSessionVersion: () => version },
    '@/components/feedback': { StateView: 'StateView' },
    '@/components/management': Object.fromEntries(['EnumField', 'FormContent', 'FormError', 'FormField', 'FormSection', 'FormSubmitBar', 'ManagementPage', 'TextField'].map((k) => [k, k])),
    '@/components/molecules': { PageHeader: 'PageHeader' },
    '@/hooks': { useCanWrite: (...c) => c.every((x) => permissions.includes(x)) },
    '@/utils/auth-guard': {
      useRequireAuth: () => ({ ready: true, allowed: true }),
      canWriteModuleNow: (_, r) => r.every((x) => permissions.includes(x)),
    },
    '@/utils/router': { navigateBack: () => calls.back++ },
    '../../_shared/AdminUI': { withAccountScope: (c) => c, errorMessage: (e) => e.message },
    '../FolderTreeSheet': { FolderTreeSheet: 'FolderTreeSheet' },
    './index.module.scss': scss,
  }, { router: { id: '9' } })
  return { page, calls, bump: () => version++ }
}

test('加载后回填；保存只提交 name/folderId/status，不含 metadata', async () => {
  const { page, calls } = mount()
  await page.settle()
  assert.equal(page.one('TextField').props.value, 'banner.png')
  page.one('TextField').props.onChange(' 新名称 ')
  page.one('FolderTreeSheet').props.onSelect(0)
  page.one('EnumField').props.onChange('0')
  page.one('FormSubmitBar').props.onSubmit()
  await page.settle()
  assert.equal(calls.updates.length, 1)
  assert.deepEqual(Object.keys(calls.updates[0].data).sort(), ['folderId', 'name', 'status'])
  assert.deepEqual(calls.updates[0].data, { name: '新名称', folderId: null, status: '0' })
  assert.equal(calls.back, 1)
})

test('分组行显示当前分组名并可打开选择面板', async () => {
  const { page } = mount()
  await page.settle()
  const row = page.all('FormField').find((f) => f.props.label === '分组')
  assert.equal(row.props.arrow, true)
  assert.match(JSON.stringify(row.props.children), /首页素材/)
  row.props.onArrowClick()
  page.rerender()
  assert.equal(page.one('FolderTreeSheet').props.open, true)
  assert.equal(page.one('FolderTreeSheet').props.rootLabel, '未分组')
})

test('名称为空就地报错不提交', async () => {
  const { page, calls } = mount()
  await page.settle()
  page.one('TextField').props.onChange('  ')
  page.one('FormSubmitBar').props.onSubmit()
  await page.settle()
  assert.equal(calls.updates.length, 0)
  assert.match(page.text(), /请输入素材名称/)
})

test('保存失败保留输入且不返回', async () => {
  const { page, calls } = mount({ update: async () => { throw new Error('名称重复') } })
  await page.settle()
  page.one('TextField').props.onChange('x')
  page.one('FormSubmitBar').props.onSubmit()
  await page.settle()
  assert.equal(page.one('TextField').props.value, 'x')
  assert.match(page.text(), /名称重复/)
  assert.equal(calls.back, 0)
})

test('无 update 权限不显示提交栏', async () => {
  const { page } = mount({ permissions: [LIST] })
  await page.settle()
  assert.equal(page.one('FormSubmitBar'), undefined)
  // 表单本身照常渲染并回填，只是整体禁用
  assert.equal(page.one('TextField').props.value, 'banner.png')
  assert.equal(page.one('TextField').props.disabled, true)
  assert.equal(page.one('EnumField').props.disabled, true)
})

test('分组树加载失败：分组行提示失败且不能打开面板，保存仍提交原分组', async () => {
  const { page, calls } = mount({ folders: async () => { throw new Error('网络错误') } })
  await page.settle()
  const row = page.all('FormField').find((f) => f.props.label === '分组')
  assert.match(JSON.stringify(row.props.children), /分组加载失败/)
  assert.doesNotMatch(JSON.stringify(row.props.children), /未分组/)
  row.props.onArrowClick()
  row.props.children.props.onClick()
  page.rerender()
  assert.equal(page.one('FolderTreeSheet').props.open, false)
  page.one('FormSubmitBar').props.onSubmit()
  await page.settle()
  assert.equal(calls.updates.length, 1)
  assert.deepEqual(calls.updates[0].data, { name: 'banner.png', folderId: 7, status: '1' })
  assert.equal(calls.back, 1)
})

test('保存期间会话切换：不返回', async () => {
  let resolve
  const ctx = mount({ update: () => new Promise((r) => { resolve = r }) })
  await ctx.page.settle()
  ctx.page.one('FormSubmitBar').props.onSubmit()
  ctx.bump()
  resolve({})
  await ctx.page.settle()
  assert.equal(ctx.calls.back, 0)
})
