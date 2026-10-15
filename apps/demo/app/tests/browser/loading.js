// Run against H5 at localhost:21003 with playwright-cli run-code --filename=...
async (page) => {
  const origin = 'http://127.0.0.1:21003'
  const check = (ok, message) => { if (!ok) throw new Error(message) }
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  let authGate
  let menuGate
  await page.unroute('**/api/**')
  await page.route('**/api/**', async route => {
    const path = route.request().url().split('?')[0]
    let data = []
    if (path.endsWith('/auth/me')) {
      await authGate
      data = { id: 901, username: 'loading-fixture', realName: '测试用户', status: '1' }
    } else if (path.endsWith('/auth/capabilities')) {
      data = { permissions: ['app:menu:authorized-tree', 'system:position:list'], enabledModuleIds: [] }
    } else if (path.endsWith('/menus/authorized')) {
      await menuGate
      data = [{ id: 1, name: '系统管理', type: 0, status: '1', moduleId: 'core', children: [
        { id: 2, parentId: 1, name: '岗位管理', type: 1, status: '1', moduleId: 'core', page: 'pages/system/position/index' },
      ] }]
    } else if (path.endsWith('/menus/home')) data = { pinned: [], ranked: [] }
    await route.fulfill({ json: { success: true, code: 200, data } })
  })
  await page.addInitScript(() => {
    localStorage.setItem('yishan:app:accessToken', JSON.stringify({ data: 'loading-fixture' }))
    localStorage.removeItem('yishan:app:theme')
  })
  await page.setViewportSize({ width: 375, height: 812 })
  for (const mode of ['light', 'dark']) {
    let releaseAuth
    let releaseMenus
    authGate = new Promise(resolve => { releaseAuth = resolve })
    menuGate = new Promise(resolve => { releaseMenus = resolve })
    await page.emulateMedia({ colorScheme: mode })
    try {
      await page.goto(`${origin}/?loading-fixture=${mode}-${Date.now()}#/pages/apps/index`)
      const loading = page.locator('[class*="Loading-module__loading___"]')
      await loading.waitFor()
      const geometry = await loading.evaluate(el => {
        const box = el.getBoundingClientRect()
        const content = el.closest('.taro_page').getBoundingClientRect()
        const text = el.lastElementChild.getBoundingClientRect()
        const spinner = el.firstElementChild.getBoundingClientRect()
        return {
          direction: getComputedStyle(el).flexDirection,
          centerX: box.x + box.width / 2,
          centerY: box.y + box.height / 2,
          contentCenterY: content.y + content.height / 2,
          textTop: text.top,
          spinnerBottom: spinner.bottom,
          color: getComputedStyle(el.firstElementChild).color,
          textColor: getComputedStyle(el.lastElementChild).color,
        }
      })
      check(geometry.direction === 'column', `${mode}: loading icon and text must be vertical`)
      check(geometry.textTop > geometry.spinnerBottom, `${mode}: loading text belongs below the spinner`)
      check(geometry.color === geometry.textColor, `${mode}: spinner follows the themed text color`)
      check(Math.abs(geometry.centerX - 187.5) < 1, `${mode}: loading must be horizontally centered`)
      check(Math.abs(geometry.centerY - geometry.contentCenterY) < 1, `${mode}: startup loading must center in the page above the tabbar`)
      check(await page.locator('.weui-tabbar__label', { hasText: '我的' }).isVisible(), 'Loading keeps tab navigation visible')
      check(await page.locator('.weui-mask, .weui-mask_transparent, .weui-toast').count() === 0, 'Page loading must not create a toast or mask')
      await page.screenshot({ path: `.playwright-cli/loading-startup-${mode}.png` })

      await page.evaluate(() => {
        document.documentElement.style.setProperty('--safe-area-top', '47px')
        document.documentElement.style.setProperty('--safe-area-bottom', '34px')
      })
      const safeArea = await loading.evaluate(el => {
        const box = el.getBoundingClientRect()
        const content = el.closest('.taro_page')
        const bounds = content.getBoundingClientRect()
        const top = parseFloat(getComputedStyle(content).paddingTop)
        return {
          center: box.y + box.height / 2,
          expected: bounds.y + top + (bounds.height - top) / 2,
          overflow: content.scrollHeight > content.clientHeight + 1,
        }
      })
      check(Math.abs(safeArea.center - safeArea.expected) < 1 && !safeArea.overflow, 'Startup loading must respect both safe areas without overflowing')
      await page.evaluate(() => {
        document.documentElement.style.removeProperty('--safe-area-top')
        document.documentElement.style.removeProperty('--safe-area-bottom')
      })
      await page.emulateMedia({ reducedMotion: 'reduce' })
      check(await loading.locator('[class*="loading__spinner"]').evaluate(el => getComputedStyle(el).animationName) === 'none', 'Loading respects reduced motion')
      await page.emulateMedia({ reducedMotion: 'no-preference' })

      releaseAuth()
      const grid = page.getByLabel('应用加载中', { exact: true })
      await grid.waitFor()
      const tiles = await grid.locator('[class*="apps__skeletonIcon"]').evaluateAll(nodes => nodes.map(el => el.getBoundingClientRect().toJSON()))
      check(tiles.length === 8, 'Workbench skeleton represents two rows of applications')
      check(tiles.slice(0, 4).every(tile => Math.abs(tile.top - tiles[0].top) < 1) && tiles[4].top > tiles[0].top, 'Workbench skeleton uses four columns')
      check(await page.locator('[class*="ManagementList-module__skeleton___"]').count() === 0, 'Workbench must not show a list skeleton')
      check(await page.getByPlaceholder('搜索应用').isVisible(), 'Workbench search stays visible while applications load')
      await page.screenshot({ path: `.playwright-cli/loading-workbench-${mode}.png` })
      releaseMenus()
      await page.getByText('岗位管理', { exact: true }).waitFor()
      await grid.waitFor({ state: 'hidden' })
      await loading.waitFor({ state: 'hidden' })
    } finally {
      releaseAuth()
      releaseMenus()
    }
  }
  check(errors.length === 0, errors.join('; '))
  return { themes: ['light', 'dark'], checks: ['vertical loading', 'page centering and safe areas', 'no blocking toast', 'reduced motion', 'application grid skeleton', 'loaded content'], errors }
}
