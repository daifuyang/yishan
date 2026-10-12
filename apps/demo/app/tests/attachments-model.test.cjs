const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTs } = require('./helpers/load-ts.cjs')

const model = () => loadTs('src/pages/system/attachments/model.ts', {})

const TREE = [
  { id: 1, name: '营销素材', kind: 'all', status: '1', sort_order: 0, children: [
    { id: 2, name: '首页素材', kind: 'image', status: '1', sort_order: 0, children: [] },
    { id: 3, name: '活动海报', kind: 'all', status: '1', sort_order: 1, children: [
      { id: 4, name: '双十一', kind: 'all', status: '0', sort_order: 0 },
    ] },
  ] },
  { id: 5, name: '短视频', kind: 'video', status: '1', sort_order: 1 },
]

test('筛选映射：空值不进查询，folderId 0 表示全部', () => {
  const m = model()
  assert.deepEqual(m.readAttachmentFilters({}), { folderId: 0, kind: '', status: '' })
  assert.deepEqual(m.readAttachmentFilters({ folderId: '3', kind: 'bad', status: '2' }), { folderId: 3, kind: '', status: '' })
  assert.deepEqual(m.buildAttachmentQuery(2, 20, '  banner ', { folderId: 0, kind: '', status: '' }), { page: 2, pageSize: 20, keyword: 'banner' })
  assert.deepEqual(m.buildAttachmentQuery(1, 20, '', { folderId: 3, kind: 'image', status: '0' }), { page: 1, pageSize: 20, folderId: 3, kind: 'image', status: '0' })
})

test('文件大小格式化', () => {
  const m = model()
  assert.equal(m.formatSize(0), '0 B')
  assert.equal(m.formatSize(512), '512 B')
  assert.equal(m.formatSize(88064), '86 KB')
  assert.equal(m.formatSize(1258291), '1.2 MB')
  assert.equal(m.formatSize(19293798), '18.4 MB')
  assert.equal(m.formatSize(2147483648), '2 GB')
})

test('按 MIME 或扩展名推断类型', () => {
  const m = model()
  const f = (name, mimeType = 'application/octet-stream') => m.kindOfFile({ path: name, name, size: 1, mimeType })
  assert.equal(f('a.PNG'), 'image')
  assert.equal(f('x', 'image/webp'), 'image')
  assert.equal(f('b.mov'), 'video')
  assert.equal(f('c.m4a'), 'audio')
  assert.equal(f('d.pdf'), 'other')
})

test('分组树查询：路径、名称、子树', () => {
  const m = model()
  assert.equal(m.findFolder(TREE, 4).name, '双十一')
  assert.deepEqual(m.folderPath(TREE, 4).map((x) => x.id), [1, 3, 4])
  assert.deepEqual(m.folderPath(TREE, 99), [])
  assert.equal(m.folderLabel(TREE, 2, '未分组'), '首页素材')
  assert.equal(m.folderLabel(TREE, 0, '未分组'), '未分组')
  assert.equal(m.folderLabel(TREE, undefined, '全部分组'), '全部分组')
  assert.deepEqual([...m.subtreeIds(TREE, 1)].sort(), [1, 2, 3, 4])
  assert.deepEqual([...m.subtreeIds(TREE, 5)], [5])
})

test('编辑素材 payload 只有三个键，未分组为 null，名称必填', () => {
  const m = model()
  const payload = m.attachmentEditPayload('  banner.png ', 0, '1')
  assert.deepEqual(Object.keys(payload).sort(), ['folderId', 'name', 'status'])
  assert.deepEqual(payload, { name: 'banner.png', folderId: null, status: '1' })
  assert.deepEqual(m.attachmentEditPayload('a', 3, '0'), { name: 'a', folderId: 3, status: '0' })
  assert.throws(() => m.attachmentEditPayload('  ', 0, '1'), /请输入素材名称/)
})

test('分组 payload：名称必填、排序非负整数、备注去空白', () => {
  const m = model()
  const base = { name: ' 首页 ', parentId: 1, kind: 'image', status: '1', sort: '2', remark: ' 备注 ' }
  assert.deepEqual(m.folderPayload(base), { name: '首页', parentId: 1, kind: 'image', status: '1', sort_order: 2, remark: '备注' })
  assert.throws(() => m.folderPayload({ ...base, name: ' ' }), /请输入分组名称/)
  for (const sort of ['', '-1', '1.5', 'abc']) assert.throws(() => m.folderPayload({ ...base, sort }), /排序/)
})

test('导入链接解析：1–20 个 http(s) 链接', () => {
  const m = model()
  assert.deepEqual(m.parseImportLinks(' https://a.test/1.png \n\n http://b.test/2.jpg '), ['https://a.test/1.png', 'http://b.test/2.jpg'])
  assert.throws(() => m.parseImportLinks('   '), /请输入/)
  assert.throws(() => m.parseImportLinks('ftp://x/1.png'), /HTTP/)
  assert.throws(() => m.parseImportLinks(Array.from({ length: 21 }, (_, i) => `https://a.test/${i}.png`).join('\n')), /20/)
})

test('媒体库源码不使用 Array.prototype.at（小程序 ES2017 无 polyfill）', () => {
  const fs = require('node:fs')
  const path = require('node:path')
  const root = path.resolve(__dirname, '../src')
  const files = [path.join(root, 'utils/picker.ts')]
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (/\.tsx?$/.test(entry.name)) files.push(full)
    }
  }
  walk(path.join(root, 'pages/system/attachments'))
  const offenders = files.filter((file) => fs.readFileSync(file, 'utf8').includes('.at('))
  assert.deepEqual(offenders.map((file) => path.relative(root, file)), [])
})
