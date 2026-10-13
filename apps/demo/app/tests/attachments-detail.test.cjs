const assert = require('node:assert/strict')
const test = require('node:test')
const { mountPage } = require('./helpers/mount-page.cjs')

const IMAGE = { id: 9, name: 'banner.png', originalName: 'IMG.png', kind: 'image', size: 1258291, status: '1', storage: 'local', path: '/u/b.png', mimeType: 'image/png', width: 1920, height: 800, folderName: '首页素材', metadata: { alt: '首页' }, createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-02T00:00:00Z' }
const ALL = ['system:attachment:list', 'system:attachment:update', 'system:attachment:delete', 'system:option:list']
const scss = new Proxy({}, { get: (_, k) => (k === '__esModule' ? false : k) })

function mount({ item = IMAGE, permissions = ALL, confirm = true, session = { version: 1 }, onConfirm } = {}) {
  const calls = { deleted: [], copied: [], back: 0, navigate: [], preview: [], toasts: [] }
  const page = mountPage('src/pages/system/attachments/detail/index.tsx', {
    '@tarojs/components': { View: 'View', Text: 'Text', Image: 'Image', Video: 'Video' },
    '@tarojs/taro': {
      showToast: ({ title }) => calls.toasts.push(title),
      setClipboardData: async ({ data }) => calls.copied.push(data),
      previewImage: ({ current }) => calls.preview.push(current),
      createInnerAudioContext: () => ({ play() {}, stop() {}, destroy() {}, onError() {} }),
    },
    '@/api/admin/attachments': {
      getAttachment: async () => item,
      deleteAttachment: async (id) => calls.deleted.push(id),
      getCloudUploadConfig: async () => ({ provider: 'disabled' }),
      attachmentUrl: (x) => (x.path ? `https://api.test${x.path}` : ''),
    },
    '@/api/client': { getSessionVersion: () => session.version },
    '@/components/atoms': { Tag: 'Tag' },
    '@/components/feedback': { StateView: 'StateView' },
    '@/components/management': Object.fromEntries(['ActionSheet', 'BottomActionBar', 'DetailContent', 'DetailRow', 'DetailSection', 'LineIcon', 'ManagementPage', 'ManagementPageHeader'].map((k) => [k, k])),
    '@/constants/routes': { SYSTEM_PAGES: { attachmentForm: 'E' } },
    '@/hooks': { useCanWrite: (...c) => c.every((x) => permissions.includes(x)), confirmAction: async () => { onConfirm?.(); return confirm } },
    '@/utils/auth-guard': {
      useRequireAuth: () => ({ ready: true, allowed: true }),
      useCurrentModuleAccess: () => (r = []) => r.every((x) => permissions.includes(x)),
    },
    '@/utils/format': { formatDateTime: (v) => `T(${v})` },
    '@/utils/router': { navigateBack: () => calls.back++, navigateTo: (u) => calls.navigate.push(u) },
    '../../_shared/AdminUI': { withAccountScope: (c) => c, errorMessage: (e) => e.message },
    './index.module.scss': scss,
  }, { router: { id: '9' } })
  return { page, calls }
}
const rows = (page) => Object.fromEntries(page.all('DetailRow').map((r) => [r.props.label, r.props]))

test('图片详情：预览可点开大图，分组信息完整，只读行不带箭头', async () => {
  const { page, calls } = mount()
  await page.settle()
  const image = page.one('Image')
  assert.equal(image.props.src, 'https://api.test/u/b.png')
  image.props.onClick()
  assert.deepEqual(calls.preview, ['https://api.test/u/b.png'])
  const r = rows(page)
  assert.equal(r['分组'].value, '首页素材')
  assert.equal(r['类型'].value, '图片')
  assert.equal(r['大小'].value, '1.2 MB')
  assert.equal(r['尺寸'].value, '1920 × 800')
  assert.equal(r['分组'].showArrow, undefined)
  // 复制不是导航：有 onClick 的「文件链接」行必须显式关掉箭头，否则 DetailRow 默认会画 ›
  assert.equal(r['文件链接'].showArrow, false)
  assert.ok(page.all('DetailSection').some((s) => s.props.title === '扩展信息'))
})

test('点击文件链接行复制链接', async () => {
  const { page, calls } = mount()
  await page.settle()
  rows(page)['文件链接'].onClick()
  await page.settle()
  assert.deepEqual(calls.copied, ['https://api.test/u/b.png'])
})

test('无链接显示暂无可预览链接，且无复制链接操作', async () => {
  const { page } = mount({ item: { ...IMAGE, path: undefined, metadata: null } })
  await page.settle()
  assert.match(page.text(), /暂无可预览链接/)
  assert.equal(page.one('BottomActionBar').props.actions.some((a) => a.key === 'copy'), false)
  assert.equal(page.all('DetailSection').some((s) => s.props.title === '扩展信息'), false)
})

test('权限决定底部操作；编辑跳转编辑页', async () => {
  const ro = mount({ permissions: ['system:attachment:list'] })
  await ro.page.settle()
  assert.deepEqual(ro.page.one('BottomActionBar').props.actions.map((a) => a.key), ['copy'])
  const rw = mount()
  await rw.page.settle()
  const actions = rw.page.one('BottomActionBar').props.actions
  assert.deepEqual(actions.map((a) => a.key), ['edit', 'copy', 'more'])
  actions[0].onClick()
  assert.deepEqual(rw.calls.navigate, ['/E?id=9'])
})

test('删除：取消确认不发请求；确认后删除并返回', async () => {
  const no = mount({ confirm: false })
  await no.page.settle()
  no.page.one('BottomActionBar').props.actions.find((a) => a.key === 'more').onClick()
  no.page.rerender()
  no.page.one('ActionSheet').props.items.find((i) => i.key === 'delete').onClick()
  await no.page.settle()
  assert.deepEqual(no.calls.deleted, [])
  const yes = mount()
  await yes.page.settle()
  yes.page.one('BottomActionBar').props.actions.find((a) => a.key === 'more').onClick()
  yes.page.rerender()
  yes.page.one('ActionSheet').props.items.find((i) => i.key === 'delete').onClick()
  await yes.page.settle()
  assert.deepEqual(yes.calls.deleted, [9])
  assert.equal(yes.calls.back, 1)
})

test('确认删除期间切换账号：不发删除请求、不返回、不提示', async () => {
  const session = { version: 1 }
  const { page, calls } = mount({ session, onConfirm: () => session.version++ })
  await page.settle()
  page.one('BottomActionBar').props.actions.find((a) => a.key === 'more').onClick()
  page.rerender()
  page.one('ActionSheet').props.items.find((i) => i.key === 'delete').onClick()
  await page.settle()
  assert.deepEqual(calls.deleted, [])
  assert.equal(calls.back, 0)
  assert.deepEqual(calls.toasts, [])
})

test('复制链接期间切换账号：不提示已复制', async () => {
  const session = { version: 1 }
  const { page, calls } = mount({ session })
  await page.settle()
  rows(page)['文件链接'].onClick()
  session.version++
  await page.settle()
  assert.deepEqual(calls.copied, ['https://api.test/u/b.png'])
  assert.deepEqual(calls.toasts, [])
})

test('加载返回前切换账号：不回写旧账号的素材', async () => {
  const session = { version: 1 }
  const { page } = mount({ session })
  session.version++
  await page.settle()
  assert.notEqual(page.one('StateView').props.kind, 'ready')
  assert.equal(page.all('DetailRow').length, 0)
})

test('其他类型：预览区显示文件图标与原始文件名', async () => {
  const { page } = mount({ item: { ...IMAGE, kind: 'other', name: '合同', originalName: 'contract-v2.pdf', mimeType: 'application/pdf', path: '/u/c.pdf', width: undefined, height: undefined } })
  await page.settle()
  assert.equal(page.all('Image').length, 0)
  assert.ok(page.all('LineIcon').some((i) => i.props.name === 'file'))
  assert.ok(page.text().split('|').includes('contract-v2.pdf'))
})

test('图片加载失败：回退到占位提示，不留破图', async () => {
  const { page } = mount()
  await page.settle()
  page.one('Image').props.onError()
  await page.settle()
  assert.equal(page.one('Image'), undefined)
  assert.match(page.text(), /图片无法加载/)
  // 复制链接仍可用：链接本身存在，只是当前环境加载不到
  assert.ok(page.one('BottomActionBar').props.actions.some((a) => a.key === 'copy'))
})

test('视频播放失败：回退到占位提示', async () => {
  const { page } = mount({ item: { ...IMAGE, kind: 'video', path: '/u/v.mp4', mimeType: 'video/mp4' } })
  await page.settle()
  page.one('Video').props.onError()
  await page.settle()
  assert.equal(page.one('Video'), undefined)
  assert.match(page.text(), /视频无法播放/)
})
