const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTs, deferred } = require('./helpers/load-ts.cjs')

function harness(initial = []) {
  const calls = []
  let pages = initial
  const taro = {
    getCurrentPages: () => pages,
    reLaunch: async (options) => {
      calls.push(['reLaunch', options.url])
      pages = [{ route: options.url.slice(1) }]
    },
    switchTab: async (options) => {
      calls.push(['switchTab', options.url])
    },
    navigateTo: async (options) => {
      calls.push(['navigateTo', options.url])
    },
    navigateBack: async (options) => {
      calls.push(['navigateBack', options.delta])
    },
  }
  return { taro, calls, router: loadTs('src/utils/router.ts', { '@tarojs/taro': taro }) }
}
test('primary navigation always uses switchTab while secondary navigation pushes normally', async () => {
  const h = harness()
  await h.router.navigateTo('pages/apps/index')
  await h.router.navigateTo('/pages/settings/index')
  assert.deepEqual(h.calls, [
    ['switchTab', '/pages/apps/index'],
    ['navigateTo', '/pages/settings/index'],
  ])
})
test('session expiration clears the full stack and login restores a safe registered secondary destination', async () => {
  const h = harness([
    { route: 'pages/index/index' },
    { route: 'pages/profile/edit/index', options: { section: 'name' } },
  ])
  await h.router.redirectToLogin()
  assert.deepEqual(h.calls[0], ['reLaunch', '/pages/login/index'])
  await h.router.resumeAfterLogin()
  assert.deepEqual(h.calls.slice(1), [
    ['reLaunch', '/pages/index/index'],
    ['navigateTo', '/pages/profile/edit/index?section=name'],
  ])
})
test('concurrent login redirects coalesce and a direct login resumes home', async () => {
  const h = harness([{ route: 'pages/apps/index' }])
  const wait = deferred()
  h.taro.reLaunch = (options) => {
    h.calls.push(['reLaunch', options.url])
    return wait.promise
  }
  const one = h.router.redirectToLogin()
  const two = h.router.redirectToLogin()
  assert.equal(h.calls.length, 1)
  wait.resolve()
  await Promise.all([one, two])
})
test('back navigation from a direct deep link returns to home instead of failing', async () => {
  const h = harness([{ route: 'pages/settings/index' }])
  await h.router.navigateBack()
  assert.deepEqual(h.calls, [['reLaunch', '/pages/index/index']])
})

test('compiled app config registers exactly three native tabs and implemented entries', () => {
  global.defineAppConfig = (value) => value
  try {
    const config = loadTs('src/app.config.ts').default
    const modules = loadTs('src/modules/registry.ts').MOBILE_MODULES
    assert.deepEqual(
      config.tabBar.list.map((tab) => tab.text),
      ['首页', '工作台', '我的'],
    )
    assert.equal(new Set(config.tabBar.list.map((tab) => tab.pagePath)).size, 3)
    for (const tab of config.tabBar.list) assert.ok(config.pages.includes(tab.pagePath))
    for (const module of modules.filter((module) => module.implemented !== false))
      assert.ok(config.pages.includes(module.entry))
    assert.ok(!config.pages.includes('pages/customers/index'))
    assert.ok(!config.pages.includes('pages/crm/action/index'))
  } finally {
    delete global.defineAppConfig
  }
})
