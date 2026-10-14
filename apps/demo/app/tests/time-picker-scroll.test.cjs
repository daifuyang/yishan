const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTs } = require('./helpers/load-ts.cjs')

test('H5 time picker prevents background gestures and restores styles and scroll once', () => {
  const previous = { document: global.document, window: global.window }
  function element(initial) {
    let attribute = initial
    return {
      style: {},
      getAttribute: () => attribute,
      setAttribute: (_name, value) => { attribute = value },
      removeAttribute: () => { attribute = null },
    }
  }
  const html = element(null)
  const body = element('color: red;')
  const page = element('overflow-y: auto;')
  const listeners = new Map()
  const restored = []
  global.document = {
    documentElement: html, body, querySelectorAll: () => [page],
    addEventListener: (name, handler, options) => {
      assert.equal(options.passive, false)
      listeners.set(name, handler)
    },
    removeEventListener: (name, handler) => {
      assert.equal(listeners.get(name), handler)
      listeners.delete(name)
    },
  }
  global.window = { scrollX: 0, scrollY: 240, scrollTo: (...position) => restored.push(position) }
  try {
    const { lockTimePickerScroll } = loadTs('src/components/management/timePickerScroll.h5.ts')
    const release = lockTimePickerScroll()
    assert.equal(body.style.position, 'fixed')
    assert.equal(body.style.top, '-240px')
    assert.equal(page.style.overflow, 'hidden')
    let prevented = false
    listeners.get('touchmove')({ cancelable: true, preventDefault: () => { prevented = true } })
    assert.equal(prevented, true)
    release()
    release()
    assert.equal(listeners.size, 0)
    assert.equal(html.getAttribute('style'), null)
    assert.equal(body.getAttribute('style'), 'color: red;')
    assert.equal(page.getAttribute('style'), 'overflow-y: auto;')
    assert.deepEqual(restored, [[0, 240]])
  } finally {
    if (previous.document === undefined) delete global.document
    else global.document = previous.document
    if (previous.window === undefined) delete global.window
    else global.window = previous.window
  }
})
