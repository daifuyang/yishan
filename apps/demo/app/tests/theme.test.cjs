const assert = require('node:assert/strict')
const test = require('node:test')
const path = require('node:path')
const { loadTs, appRoot } = require('./helpers/load-ts.cjs')
const fs = require('node:fs')

function fixture(saved = null) {
  const { createThemeController } = loadTs(
    path.resolve(appRoot, '../../..', 'packages/ui/mobile/theme/controller.ts'),
  )
  let system = 'light'
  let listener
  let removed = 0
  const writes = []
  const controller = createThemeController({
    storage: { get: () => saved, set: (value) => writes.push(value) },
    getSystemTheme: () => system,
    watchSystemTheme: (callback) => {
      listener = callback
      return () => {
        listener = undefined
        removed++
      }
    },
  })
  return {
    controller,
    writes,
    removed: () => removed,
    change(value) {
      system = value
      listener?.(value)
    },
  }
}

test('theme defaults to system, explicit modes override OS and returning to system reads the latest OS', () => {
  const f = fixture()
  const stop = f.controller.start()
  assert.deepEqual(f.controller.getSnapshot(), { mode: 'system', resolved: 'light' })
  f.change('dark')
  assert.equal(f.controller.getSnapshot().resolved, 'dark')
  f.controller.setMode('light')
  f.change('light')
  f.change('dark')
  assert.equal(f.controller.getSnapshot().resolved, 'light')
  f.controller.setMode('system')
  assert.equal(f.controller.getSnapshot().resolved, 'dark')
  assert.deepEqual(f.writes, ['light', 'system'])
  stop()
  stop()
  assert.equal(f.removed(), 1)
})

test('theme restores valid preferences, rejects invalid cache and isolates controllers', () => {
  const first = fixture('dark')
  const second = fixture('obsolete')
  first.controller.start()
  second.controller.start()
  assert.equal(first.controller.getSnapshot().mode, 'dark')
  assert.equal(second.controller.getSnapshot().mode, 'system')
  second.controller.setMode('light')
  assert.equal(first.controller.getSnapshot().resolved, 'dark')
  assert.throws(() => first.controller.setMode('invalid'), /theme/i)
})

test('theme notifications are stable, unsubscribe works and unavailable storage does not block switching', () => {
  const { createThemeController } = loadTs(
    path.resolve(appRoot, '../../..', 'packages/ui/mobile/theme/controller.ts'),
  )
  const controller = createThemeController({
    storage: {
      get() {
        throw Error('blocked')
      },
      set() {
        throw Error('full')
      },
    },
  })
  controller.start()
  const initial = controller.getSnapshot()
  let calls = 0
  const unsubscribe = controller.subscribe(() => calls++)
  controller.setMode('system')
  assert.equal(controller.getSnapshot(), initial)
  controller.setMode('dark')
  assert.equal(calls, 1)
  unsubscribe()
  controller.setMode('light')
  assert.equal(calls, 1)
})

test('both themes expose identical semantics and the generated CSS matches the runtime palette', () => {
  const { themeTokens } = loadTs(require.resolve('@yishan/ui/mobile/theme'))
  assert.deepEqual(Object.keys(themeTokens.light).sort(), Object.keys(themeTokens.dark).sort())
  const css = fs.readFileSync(
    path.resolve(appRoot, '../../../packages/ui/mobile/theme/colors.scss'),
    'utf8',
  )
  for (const theme of ['light', 'dark']) {
    const block = css.split(`@mixin theme-${theme} {`)[1]?.split('}')[0]
    assert.ok(block, theme)
    for (const [key, value] of Object.entries(themeTokens[theme]))
      assert.ok(block.includes(`--${key}: ${value};`), `${theme}:${key}`)
  }
})

test('theme selected before startup wins over stale cache even when persistence and OS subscription fail', () => {
  const { createThemeController } = loadTs(
    path.resolve(appRoot, '../../../packages/ui/mobile/theme/controller.ts'),
  )
  const controller = createThemeController({
    storage: {
      get: () => 'light',
      set() {
        throw Error('blocked')
      },
    },
    watchSystemTheme() {
      throw Error('unsupported')
    },
  })
  controller.setMode('dark')
  const stop = controller.start()
  assert.equal(controller.getSnapshot().resolved, 'dark')
  stop()
})

test('body text and filled primary/danger controls retain readable contrast on both themes', () => {
  const { themeTokens } = loadTs(require.resolve('@yishan/ui/mobile/theme'))
  function luminance(hex) {
    const channels = hex
      .slice(1)
      .match(/../g)
      .map((value) => parseInt(value, 16) / 255)
      .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
  }
  function contrast(a, b) {
    const values = [luminance(a), luminance(b)].sort((x, y) => x - y)
    return (values[1] + 0.05) / (values[0] + 0.05)
  }
  for (const colors of Object.values(themeTokens)) {
    for (const surface of ['color-bg-base', 'color-bg-surface', 'color-bg-elevated']) {
      for (const text of ['color-text-primary', 'color-text-secondary'])
        assert.ok(contrast(colors[text], colors[surface]) >= 4.5, `${text}/${surface}`)
    }
    for (const background of ['color-primary-solid', 'color-danger-solid'])
      assert.ok(contrast(colors['color-text-inverse'], colors[background]) >= 4.5, background)
  }
})

test('handwritten UI infrastructure has no color literals outside palette definitions', () => {
  function scan(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        scan(file)
        continue
      }
      if (!/\.(tsx?|s?css)$/.test(file) || /(?:palette.ts|tokens.scss|colors.scss)$/.test(file))
        continue
      const source = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '')
      assert.doesNotMatch(source, /#[\da-f]{3,8}\b|rgba?\(\s*\d/i, file)
      assert.doesNotMatch(source, /var\(--[^(),]*var\(/, `Malformed CSS variable in ${file}`)
    }
  }
  scan(path.resolve(appRoot, '../../../packages/ui/mobile'))
  scan(path.join(appRoot, 'src/components'))
})
