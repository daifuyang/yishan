// Run against a fresh build:h5 served at 21833: playwright-cli run-code --filename=tests/browser/theme.js
async (page) => {
  const origin = 'http://127.0.0.1:21833'
  const errors = []
  const checks = []
  const check = (value, message) => { if (!value) throw Error(message); checks.push(message) }
  page.on('pageerror', error => errors.push(error.message))
  await page.unroute('**/api/**')
  await page.route('**/api/**', async route => {
    const url = route.request().url().split('?')[0]
    let data = []
    if (url.endsWith('/auth/me')) data = { id: 900, username: 'theme-fixture', realName: '主题验收', status: '1' }
    else if (url.endsWith('/auth/capabilities')) data = { permissions: ['system:user:list', 'app:menu:authorized-tree'], enabledModuleIds: [] }
    else if (url.endsWith('/menus/authorized')) data = [{ id: 1, name: '系统管理', type: 0, status: '1', moduleId: 'core', children: [{ id: 2, parentId: 1, name: '用户管理', type: 1, status: '1', moduleId: 'core', page: 'pages/system/user/index' }] }]
    else if (url.endsWith('/menus/home')) data = { pinned: [], ranked: [] }
    await route.fulfill({ json: { success: true, code: 200, data, pagination: { page: 1, pageSize: 20, total: 0 } } })
  })
  await page.addInitScript(() => localStorage.setItem('yishan:app:accessToken', JSON.stringify({ data: 'local-theme-fixture' })))
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto(`${origin}/#/pages/system/user/index`)
  await page.evaluate(() => localStorage.removeItem('yishan:app:theme'))
  await page.reload()
  await page.getByText('全部状态', { exact: true }).waitFor()
  const appearance = () => page.evaluate(() => ({ mode: document.documentElement.dataset.themeMode, theme: document.documentElement.dataset.theme, bg: getComputedStyle(document.body).backgroundColor }))
  check((await appearance()).theme === 'dark', 'system resolves OS dark')
  await page.emulateMedia({ colorScheme: 'light' })
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'light')
  check((await appearance()).mode === 'system', 'system updates live without changing preference')

  async function restore(mode, os) {
    await page.evaluate(value => localStorage.setItem('yishan:app:theme', JSON.stringify({ data: value })), mode)
    await page.emulateMedia({ colorScheme: os })
    await page.reload()
    await page.getByText('全部状态', { exact: true }).waitFor()
  }
  await restore('light', 'dark')
  check((await appearance()).theme === 'light', 'manual light survives reload and overrides OS dark')
  await page.getByText('筛选', { exact: true }).click()
  await page.getByText('自定义', { exact: true }).click()
  await page.getByText('开始日期', { exact: true }).click()
  await page.locator('.weui-picker').waitFor()
  const picker = await page.locator('.weui-picker').evaluate(el => ({ bg: getComputedStyle(el).backgroundColor, foreground: getComputedStyle(el.querySelector('.weui-picker__item')).color, done: getComputedStyle(el.querySelector('.weui-btn_primary')).backgroundColor }))
  check(picker.bg === 'rgb(255, 255, 255)' && picker.foreground === 'rgb(29, 33, 41)', 'WeUI remains light with OS dark')
  check(picker.done === 'rgb(18, 100, 214)', 'WeUI filled confirmation uses solid primary')
  await page.locator('.weui-picker').getByRole('button', { name: '关闭', exact: true }).click()
  await page.locator('.weui-picker').waitFor({ state: 'detached' })
  await page.setViewportSize({ width: 390, height: 320 })
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--safe-area-top', '47px')
    document.documentElement.style.setProperty('--safe-area-bottom', '34px')
  })
  const footer = await page.locator('[class*="DateRangeSheet-module__footer"]').boundingBox()
  check(footer.y >= 47 && footer.y + footer.height <= 286, 'date sheet actions stay visible in small viewport with top/bottom insets')
  const closeTarget = await page.getByLabel('关闭筛选用户', { exact: true }).boundingBox()
  check(closeTarget.width >= 44 && closeTarget.height >= 44, 'sheet close target is at least 44 CSS pixels')
  await page.getByLabel('关闭筛选用户', { exact: true }).click()

  await page.setViewportSize({ width: 390, height: 844 })
  await restore('dark', 'light')
  check((await appearance()).theme === 'dark', 'manual dark survives reload and overrides OS light')
  await page.getByText('筛选', { exact: true }).click()
  await page.getByText('自定义', { exact: true }).click()
  await page.getByText('开始日期', { exact: true }).click()
  await page.locator('.weui-picker').waitFor()
  const darkPicker = await page.locator('.weui-picker').evaluate(el => ({ bg: getComputedStyle(el).backgroundColor, foreground: getComputedStyle(el.querySelector('.weui-picker__item')).color, done: getComputedStyle(el.querySelector('.weui-btn_primary')).backgroundColor }))
  check(darkPicker.bg === 'rgb(39, 43, 49)' && darkPicker.foreground === 'rgb(240, 241, 243)' && darkPicker.done === 'rgb(35, 107, 209)', 'WeUI follows manual dark with OS light')
  await page.locator('.weui-picker').getByRole('button', { name: '关闭', exact: true }).click()
  await page.locator('.weui-picker').waitFor({ state: 'detached' })
  await page.goto(`${origin}/#/pages/mine/index`)
  await page.getByText('退出登录', { exact: true }).click()
  await page.locator('[class*="sheet__item"]').getByText('退出登录', { exact: true }).click()
  await page.locator('.taro-modal__content').waitFor()
  check(await page.locator('.taro-modal__content').evaluate(el => getComputedStyle(el).backgroundColor === 'rgb(39, 43, 49)'), 'H5 Taro modal uses app dark surface')
  check(await page.locator('.taro-modal__text').evaluate(el => getComputedStyle(el).color === 'rgb(192, 197, 206)'), 'H5 Taro modal uses readable body text')
  await page.locator('.taro-model__cancel').click()
  await page.locator('.taro-modal__content').waitFor({ state: 'hidden' })
  check(errors.length === 0, `no browser runtime errors: ${errors.join('; ')}`)
  return { checks }
}
