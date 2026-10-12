const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTs } = require('./helpers/load-ts.cjs')

const scss = new Proxy({}, { get: (_, k) => (k === '__esModule' ? false : k) })
const flat = (v) => !v || typeof v !== 'object' ? [] : Array.isArray(v) ? v.flatMap(flat) : [v, ...flat(v.props?.children)]

test('LineIcon 提供 video 与 music', () => {
  const src = require('node:fs').readFileSync(require('node:path').resolve(__dirname, '../src/components/management/LineIcon.tsx'), 'utf8')
  assert.match(src, /\n\s+video:/)
  assert.match(src, /\n\s+music:/)
})

test('ManagementCell 的 thumb 渲染方形缩略图并以图标兜底', () => {
  const { ManagementCell } = loadTs('src/components/management/ManagementList.tsx', {
    '@tarojs/components': { View: 'View', Text: 'Text', Image: 'Image' },
    '@/components/atoms': { AppText: 'AppText', Avatar: 'Avatar' },
    '@/components/feedback': { StateView: 'StateView' },
    './LineIcon': { LineIcon: 'LineIcon' },
    './ManagementList.module.scss': scss,
  })
  const withSrc = flat(ManagementCell({ title: 'a.png', thumb: { src: 'https://x/a.png', glyph: 'image' } }))
  const image = withSrc.find((n) => n.type === 'Image')
  assert.equal(image.props.src, 'https://x/a.png')
  assert.equal(image.props.mode, 'aspectFill')
  assert.ok(withSrc.some((n) => n.type === 'LineIcon' && n.props.name === 'image'), '图片下层保留图标兜底')
  const noSrc = flat(ManagementCell({ title: 'b.mp4', thumb: { glyph: 'video' } }))
  assert.equal(noSrc.find((n) => n.type === 'Image'), undefined)
  assert.ok(noSrc.some((n) => n.className === 'row__thumb' || n.props?.className === 'row__thumb'))
  assert.equal(flat(ManagementCell({ title: 'c', thumb: { glyph: 'file' }, avatar: { name: 'x' } })).find((n) => n.type === 'Avatar'), undefined)
})

test('SelectionFooter 支持自定义确认文案与危险样式，默认仍是「确定」', () => {
  const { SelectionFooter } = loadTs('src/components/management/SelectionFooter.tsx', {
    react: { useState: (v) => [v, () => {}] },
    '@tarojs/components': { View: 'View', Text: 'Text' },
    './LineIcon': { LineIcon: 'LineIcon' },
    './SelectionFooter.module.scss': scss,
  })
  const base = { count: 2, unit: '个素材', items: [], onCancel() {}, onConfirm() {} }
  const danger = flat(SelectionFooter({ ...base, confirmLabel: '删除', confirmDanger: true }))
  const btn = danger.find((n) => n.props?.['aria-label'] === '删除')
  assert.ok(btn)
  assert.match(btn.props.className, /action--danger/)
  assert.ok(flat(SelectionFooter(base)).find((n) => n.props?.['aria-label'] === '确定'))
})

test('H5 chooseFiles 在同一调用栈内创建并点击 input（不被浏览器拦截）', async () => {
  const clicks = []
  let input
  global.document = {
    createElement: (tag) => {
      input = { tag, style: {}, files: [], click() { clicks.push(tag) }, set onchange(fn) { this._change = fn }, set oncancel(fn) { this._cancel = fn } }
      return input
    },
    body: { appendChild() {}, removeChild() {} },
  }
  global.URL = { createObjectURL: (f) => `blob:${f.name}` }
  const { chooseFiles } = loadTs('src/pages/system/attachments/chooseFiles.h5.ts', {})
  const pending = chooseFiles()
  assert.deepEqual(clicks, ['input'], 'click 必须同步发生')
  assert.equal(input.type, 'file')
  assert.equal(input.multiple, true)
  input.files = [{ name: 'a.pdf', size: 3, type: 'application/pdf' }]
  input._change()
  assert.deepEqual(await pending, [{ path: 'blob:a.pdf', name: 'a.pdf', size: 3, mimeType: 'application/pdf' }])
  delete global.document
  delete global.URL
})

test('小程序 chooseFiles 用户取消返回空数组', async () => {
  const { chooseFiles } = loadTs('src/pages/system/attachments/chooseFiles.ts', {
    '@tarojs/taro': { chooseMessageFile: async () => { throw { errMsg: 'chooseMessageFile:fail cancel' } } },
  })
  assert.deepEqual(await chooseFiles(), [])
})
