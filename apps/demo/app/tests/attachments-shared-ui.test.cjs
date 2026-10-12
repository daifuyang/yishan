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

/** cancelEvent=false 模拟不支持 input cancel 事件的旧浏览器：input 上没有 oncancel 属性 */
function mockH5Dom({ cancelEvent = true } = {}) {
  const env = { clicks: [], removed: [], listeners: {}, input: undefined }
  global.document = {
    createElement: (tag) => {
      env.input = { tag, style: {}, files: [], click() { env.clicks.push(tag) }, set onchange(fn) { this._change = fn } }
      if (cancelEvent)
        Object.defineProperty(env.input, 'oncancel', { set(fn) { this._cancel = fn }, configurable: true })
      return env.input
    },
    body: { appendChild() {}, removeChild(node) { env.removed.push(node) } },
  }
  global.window = {
    addEventListener: (type, fn) => { env.listeners[type] = fn },
    removeEventListener: (type, fn) => { if (env.listeners[type] === fn) delete env.listeners[type] },
  }
  global.URL = { createObjectURL: (f) => `blob:${f.name}` }
  return env
}

function cleanupH5Dom() {
  delete global.document
  delete global.window
  delete global.URL
}

const loadH5 = () => loadTs('src/pages/system/attachments/chooseFiles.h5.ts', {})

test('H5 chooseFiles 在同一调用栈内创建并点击 input（不被浏览器拦截）', async () => {
  try {
    const env = mockH5Dom()
    const { chooseFiles } = loadH5()
    const pending = chooseFiles()
    assert.deepEqual(env.clicks, ['input'], 'click 必须同步发生')
    const { input } = env
    assert.equal(input.type, 'file')
    assert.equal(input.multiple, true)
    input.files = [{ name: 'a.pdf', size: 3, type: 'application/pdf' }]
    input._change()
    assert.deepEqual(await pending, [{ path: 'blob:a.pdf', name: 'a.pdf', size: 3, mimeType: 'application/pdf' }])
    assert.deepEqual(env.removed, [input])
    assert.equal(env.listeners.focus, undefined, '落地后移除 focus 监听')
  } finally {
    cleanupH5Dom()
  }
})

test('H5 chooseFiles 取消时返回空数组并移除 input', async () => {
  try {
    const env = mockH5Dom()
    const { chooseFiles } = loadH5()
    const pending = chooseFiles()
    env.input._cancel()
    assert.deepEqual(await pending, [])
    assert.deepEqual(env.removed, [env.input])
    assert.equal(env.listeners.focus, undefined)
  } finally {
    cleanupH5Dom()
  }
})

test('H5 chooseFiles 不支持 cancel 事件时靠窗口 focus 兜底落地，且只落地一次', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  try {
    const env = mockH5Dom({ cancelEvent: false })
    const { chooseFiles } = loadH5()
    let resolved = 0
    const pending = chooseFiles().then((files) => {
      resolved += 1
      return files
    })
    assert.equal(typeof env.listeners.focus, 'function', 'click 之后监听窗口 focus')
    env.listeners.focus()
    t.mock.timers.tick(999)
    assert.deepEqual(env.removed, [], '等待期内不提前落地，给迟到的 change 留时间')
    t.mock.timers.tick(1)
    assert.deepEqual(await pending, [])
    assert.deepEqual(env.removed, [env.input])
    env.input.files = [{ name: 'late.pdf', size: 1, type: 'application/pdf' }]
    env.input._change()
    env.input.oncancel?.()
    await Promise.resolve()
    assert.equal(resolved, 1)
    assert.deepEqual(env.removed, [env.input], '不重复移除 input')
  } finally {
    cleanupH5Dom()
  }
})

test('H5 chooseFiles 支持 cancel 事件时不注册 focus 兜底，窗口回焦不会丢掉选择', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  try {
    const env = mockH5Dom()
    const { chooseFiles } = loadH5()
    let result
    const pending = chooseFiles().then((files) => {
      result = files
      return files
    })
    assert.equal(env.listeners.focus, undefined, '浏览器有 cancel 事件就不监听 focus')
    env.listeners.focus?.()
    t.mock.timers.tick(5000)
    await Promise.resolve()
    assert.equal(result, undefined, '回焦后不落地为空数组')
    assert.deepEqual(env.removed, [])
    env.input.files = [{ name: 'slow.pdf', size: 2, type: 'application/pdf' }]
    env.input._change()
    assert.deepEqual(await pending, [{ path: 'blob:slow.pdf', name: 'slow.pdf', size: 2, mimeType: 'application/pdf' }])
  } finally {
    cleanupH5Dom()
  }
})

test('小程序 chooseFiles 用户取消返回空数组', async () => {
  const { chooseFiles } = loadTs('src/pages/system/attachments/chooseFiles.ts', {
    '@tarojs/taro': { chooseMessageFile: async () => { throw { errMsg: 'chooseMessageFile:fail cancel' } } },
  })
  assert.deepEqual(await chooseFiles(), [])
})
