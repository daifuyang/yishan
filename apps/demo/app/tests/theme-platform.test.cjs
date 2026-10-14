const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTs } = require('./helpers/load-ts.cjs')

test('WeChat templates receive page theme, custom top inset and exactly one bottom inset', async () => {
  const { applyWechatThemeAssets } = loadTs('config/theme-assets.ts')
  const asset = (value) => ({ source: () => value, size: () => value.length })
  const assets = {
    'pages/apps/index.wxml': asset(
      '<import src="../../base.wxml"/><template is="taro_tmpl" data="{{root:root}}" />',
    ),
    'pages/apps/index.json': asset('{"navigationStyle":"custom"}'),
    'pages/profile/edit/index.wxml': asset('<template is="taro_tmpl" data="{{root:root}}" />'),
    'pages/profile/edit/index.json': asset('{"navigationStyle":"default"}'),
    'base.wxml': asset('<template name="taro_tmpl"></template>'),
  }
  await applyWechatThemeAssets(assets)
  const tab = assets['pages/apps/index.wxml'].source()
  assert.match(tab, /page-meta page-style=/)
  assert.match(tab, /--safe-area-top:.*yishanSafeTop/)
  assert.match(tab, /--safe-area-bottom:0px/)
  const normal = assets['pages/profile/edit/index.wxml'].source()
  assert.match(normal, /--safe-area-top:0px/)
  assert.match(normal, /--safe-area-bottom:.*yishanSafeBottom/)
  assert.ok(assets['theme.json'])
  await applyWechatThemeAssets(assets)
  assert.equal(assets['pages/apps/index.wxml'].source(), tab)
})

test('WeChat theme bridge keeps original page lifecycle, updates retained pages and removes destroyed pages', () => {
  let hook
  let change
  let starts = 0
  let shows = 0
  let stops = 0
  const taro = {
    getWindowInfo: () => ({ screenHeight: 844, safeArea: { top: 47, bottom: 810 } }),
    getAppBaseInfo: () => ({ theme: 'light' }),
    onThemeChange: (callback) => {
      change = callback
    },
    offThemeChange: () => {
      stops++
    },
    getStorageSync: () => '',
    setStorageSync() {},
    setNavigationBarColor: async () => {},
    setBackgroundColor: async () => {},
    setTabBarStyle: async () => {},
  }
  const runtime = loadTs('src/theme/index.ts', {
    '@tarojs/taro': taro,
    './platform': loadTs('src/theme/platform.ts', {
      '@tarojs/taro': taro,
      '@tarojs/runtime': {
        hooks: {
          tap: (_name, callback) => {
            hook = callback
          },
        },
      },
    }),
  })
  runtime.installThemePages()
  const config = {
    onLoad() {
      starts++
      return 'loaded'
    },
    onShow() {
      shows++
    },
    onUnload() {},
  }
  hook(config)
  const updates = []
  const page = { ...config, setData: (data) => updates.push(data) }
  const stop = runtime.startAppTheme()
  assert.equal(page.onLoad(), 'loaded')
  page.onShow()
  assert.equal(starts, 1)
  assert.equal(shows, 1)
  assert.match(updates.at(-1).yishanThemeStyle, /--color-bg-base:/)
  assert.equal(updates.at(-1).yishanSafeTop, 47)
  assert.equal(updates.at(-1).yishanSafeBottom, 34)
  change({ theme: 'dark' })
  assert.equal(runtime.appTheme.getSnapshot().resolved, 'dark')
  const beforeUnload = updates.length
  page.onUnload()
  runtime.appTheme.setMode('light')
  assert.equal(updates.length, beforeUnload)
  stop()
  assert.equal(stops, 1)
})
