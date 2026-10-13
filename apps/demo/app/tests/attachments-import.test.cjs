const assert = require('node:assert/strict')
const test = require('node:test')
const { mountPage } = require('./helpers/mount-page.cjs')

function mount({ router = { folderId: '7' }, importImages } = {}) {
  const calls = { imports: [], back: 0, toasts: 0 }
  let version = 1
  const page = mountPage('src/pages/system/attachments/import/index.tsx', {
    '@tarojs/components': { Text: 'Text' },
    '@tarojs/taro': { showToast() { calls.toasts++ }, setNavigationBarTitle() {} },
    '@/api/admin/attachments': { importImages: importImages || (async (urls, folderId) => { calls.imports.push({ urls, folderId }); return [] }) },
    '@/api/client': { getSessionVersion: () => version },
    '@/components/management': Object.fromEntries(['FormContent', 'FormError', 'FormField', 'FormSection', 'FormSubmitBar', 'ManagementPage', 'ManagementPageHeader', 'TextAreaField'].map((k) => [k, k])),
    '@/hooks': { useCanWrite: () => true },
    '@/utils/auth-guard': { useRequireAuth: () => ({ ready: true, allowed: true }), canWriteModuleNow: () => true },
    '@/utils/router': { navigateBack: () => calls.back++ },
    '../../_shared/AdminUI': { withAccountScope: (c) => c, errorMessage: (e) => e.message },
  }, { router })
  return { page, calls, bump: () => version++ }
}

test('导入到路由携带的分组并返回', async () => {
  const { page, calls } = mount()
  page.one('TextAreaField').props.onChange('https://a.test/1.png\nhttps://a.test/2.png')
  page.one('FormSubmitBar').props.onSubmit()
  await page.settle()
  assert.deepEqual(calls.imports, [{ urls: ['https://a.test/1.png', 'https://a.test/2.png'], folderId: 7 }])
  assert.equal(calls.back, 1)
})

test('未指定分组时不传 folderId', async () => {
  const { page, calls } = mount({ router: {} })
  page.one('TextAreaField').props.onChange('https://a.test/1.png')
  page.one('FormSubmitBar').props.onSubmit()
  await page.settle()
  assert.equal(calls.imports[0].folderId, undefined)
})

test('非法链接就地报错，不发请求；占位文案不重复写提示', async () => {
  const { page, calls } = mount()
  assert.equal(page.one('TextAreaField').props.placeholder, '每行一个 HTTP/HTTPS 图片链接，最多 20 个')
  page.one('TextAreaField').props.onChange('ftp://x/1.png')
  page.one('FormSubmitBar').props.onSubmit()
  await page.settle()
  assert.deepEqual(calls.imports, [])
  assert.match(page.text(), /HTTP/)
})

test('导入失败保留输入且不返回', async () => {
  const { page, calls } = mount({ importImages: async () => { throw new Error('链接无法访问') } })
  page.one('TextAreaField').props.onChange('https://a.test/1.png')
  page.one('FormSubmitBar').props.onSubmit()
  await page.settle()
  assert.equal(page.one('TextAreaField').props.value, 'https://a.test/1.png')
  assert.match(page.text(), /链接无法访问/)
  assert.equal(calls.back, 0)
})

test('分组标题与字段标签不重复「图片链接」', () => {
  const { page } = mount()
  const titles = page.all('FormSection').map((s) => s.props.title)
  const labels = page.all('FormField').map((f) => f.props.label)
  assert.deepEqual(labels, ['图片链接'])
  assert.equal(page.one('FormField').props.stacked, true)
  assert.ok(!titles.includes('图片链接'))
})

test('导入期间会话切换：不提示、不返回', async () => {
  let resolve
  const ctx = mount({ importImages: () => new Promise((r) => { resolve = r }) })
  ctx.page.one('TextAreaField').props.onChange('https://a.test/1.png')
  ctx.page.one('FormSubmitBar').props.onSubmit()
  await ctx.page.flush()
  ctx.bump()
  resolve([])
  await ctx.page.settle()
  assert.equal(ctx.calls.back, 0)
  assert.equal(ctx.calls.toasts, 0)
})
