// Run with playwright-cli open --mobile against H5 to also cover Taro's mobile image source picker.
async (page) => {
  const origin = 'http://127.0.0.1:21003'
  const check = (ok, message) => { if (!ok) throw Error(message) }
  const errors = []
  const writes = []
  const user = { id: 901, username: 'polish-fixture', realName: '体验验收', status: '1', gender: '0' }
  const position = { id: 101, name: '销售经理', status: '1', sort_order: 1, description: '负责销售团队' }
  const permissions = ['app:menu:authorized-tree', 'system:position:list', 'system:position:update', 'system:position:delete', 'system:option:list', 'system:option:update', 'system:attachment:create']
  const menus = [{ id: 1, name: '系统管理', type: 0, status: '1', moduleId: 'core', children: [
    { id: 2, parentId: 1, name: '岗位管理', type: 1, status: '1', moduleId: 'core', page: 'pages/system/position/index' },
    { id: 3, parentId: 1, name: '站点配置', type: 1, status: '1', moduleId: 'core', page: 'pages/system/site/index' },
  ] }]
  const pngPath = 'apps/demo/app/src/assets/brand/logo.png'
  page.on('pageerror', error => errors.push(error.message))
  await page.unroute('**/api/**')
  await page.route('**/api/**', async route => {
    const request = route.request()
    const path = request.url().replace(/^https?:\/\/[^/]+/, '').split('?')[0].replace(/\/$/, '')
    if (request.method() !== 'GET') writes.push(path)
    let data = []
    if (path.endsWith('/auth/me')) data = user
    else if (path.endsWith('/auth/capabilities')) data = { permissions, enabledModuleIds: [] }
    else if (path.endsWith('/menus/authorized')) data = menus
    else if (path.endsWith('/menus/home')) data = { pinned: [], ranked: [] }
    else if (path.endsWith('/positions/101')) data = position
    else if (path.endsWith('/options/basicConfig')) data = JSON.stringify({ siteName: '测试站点', siteLogo: '' })
    else if (path.endsWith('/attachments')) data = [{ id: 1, originalName: 'logo.png', url: '/fixture/logo.png', kind: 'image', storage: 'local' }]
    await route.fulfill({ json: { success: true, code: 200, data, pagination: { page: 1, total: 0, pageSize: 20 } } })
  })
  await page.route('**/fixture/logo.png', route => route.fulfill({ contentType: 'image/png', path: pngPath }))
  await page.addInitScript(() => localStorage.setItem('yishan:app:accessToken', JSON.stringify({ data: 'polish-fixture-only' })))
  await page.setViewportSize({ width: 375, height: 812 })
  const goto = async path => { await page.goto(`${origin}/#/${path}`); await page.waitForLoadState('networkidle') }
  await goto('pages/index/index')
  await page.reload()
  await page.waitForLoadState('networkidle')
  await page.getByText('常用应用', { exact: true }).waitFor()

  for (const mode of ['light', 'dark']) {
    await goto('pages/apps/index')
    await page.evaluate(value => localStorage.setItem('yishan:app:theme', JSON.stringify({ data: value })), mode)
    await page.reload()
    await page.waitForLoadState('networkidle')
    await goto('pages/apps/index')
    await page.waitForFunction(value => document.documentElement.dataset.theme === value, mode)
    await page.getByText('系统管理', { exact: true }).waitFor()
    const searchGap = await page.evaluate(() => {
      const search = document.querySelector('[class*="ManagementSearch-module__search___"]')
      const card = document.querySelector('[class*="apps__section___"]')
      return card.getBoundingClientRect().top - search.getBoundingClientRect().bottom
    })
    check(Math.abs(searchGap - 16) < 1, `${mode}: search/card gap must be 16px without double spacing`)
    await page.screenshot({ path: `.playwright-cli/polish-workbench-${mode}.png`, fullPage: true })

    await goto('pages/mine/index')
    await page.getByText('个人资料', { exact: true }).waitFor()
    const rows = await page.locator('[class*="ManagementList-module__row___"]').filter({ visible: true }).evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().height))
    check(rows.length === 5 && rows.every(height => height >= 44 && height <= 60), `${mode}: settings rows should stay compact and tappable`)
    await page.screenshot({ path: `.playwright-cli/polish-mine-${mode}.png`, fullPage: true })

    await goto('pages/system/position/form/index?id=101')
    const area = page.locator('textarea')
    await area.waitFor()
    const styles = await area.evaluate(node => ({
      bg: getComputedStyle(node).backgroundColor,
      color: getComputedStyle(node).color,
      hostColor: getComputedStyle(node.parentElement).color,
      height: node.getBoundingClientRect().height,
    }))
    check(styles.bg === 'rgba(0, 0, 0, 0)' && styles.color === styles.hostColor && styles.height >= 72, `${mode}: native textarea must follow the themed field and use its full area`)
    await area.fill('第一行说明\n第二行说明\n第三行说明')
    check((await area.inputValue()).includes('第三行说明'), `${mode}: multiline input remains editable`)
    await page.screenshot({ path: `.playwright-cli/polish-form-${mode}.png`, fullPage: true })

    await goto('pages/system/position/detail/index?id=101')
    await page.getByLabel('更多', { exact: true }).click()
    const action = page.getByLabel('删除岗位', { exact: true })
    await action.waitFor()
    const sheetStyle = await action.evaluate(node => ({ justify: getComputedStyle(node).justifyContent, font: parseFloat(getComputedStyle(node).fontSize), color: getComputedStyle(node).color }))
    check(sheetStyle.justify === 'center' && sheetStyle.font === 17, `${mode}: ActionSheet actions use WeUI alignment and typography`)
    await page.evaluate(() => document.documentElement.style.setProperty('--safe-area-bottom', '34px'))
    const cancel = page.getByLabel('取消', { exact: true })
    check(await cancel.evaluate(node => parseFloat(getComputedStyle(node).paddingBottom) >= 46), `${mode}: cancel area consumes the bottom safe area`)
    await page.screenshot({ path: `.playwright-cli/polish-actionsheet-${mode}.png`, fullPage: true })
    await cancel.click()
    await action.waitFor({ state: 'hidden' })
    await page.evaluate(() => document.documentElement.style.removeProperty('--safe-area-bottom'))
  }

  await goto('pages/system/site/basic/index')
  // 自动提供隔离测试图片，保留 Taro chooseImage -> upload 的完整调用链。
  await page.evaluate(async () => {
    const image = await fetch('/fixture/logo.png').then(response => response.arrayBuffer())
    const originalClick = HTMLInputElement.prototype.click
    HTMLInputElement.prototype.click = function () {
      if (this.type !== 'file') return originalClick.call(this)
      HTMLInputElement.prototype.click = originalClick
      const transfer = new DataTransfer()
      transfer.items.add(new File([image], 'logo.png', { type: 'image/png' }))
      this.files = transfer.files
      this.dispatchEvent(new Event('change'))
    }
  })
  await page.getByText('点击上传', { exact: true }).click()
  check((await page.locator('[class*="ActionBar-module__sheet___"]').count()) === 0, 'Logo selection must open directly without an ActionSheet')
  check((await page.locator('.taro__actionSheet, .taro-actionsheet__cell').count()) === 0, 'Logo must skip the mobile camera/album source sheet')
  await page.getByText('移除 Logo', { exact: true }).waitFor()
  check(writes.filter(path => path.endsWith('/attachments')).length === 1, 'Logo uploads exactly once')
  await page.getByText('移除 Logo', { exact: true }).click()
  await page.getByText('点击上传', { exact: true }).waitFor()

  await goto('pages/mine/index')
  await page.locator('#app').getByText('退出登录', { exact: true }).click()
  await page.getByText('确定要退出当前账号吗？', { exact: true }).filter({ visible: true }).waitFor()
  check((await page.locator('[class*="ActionBar-module__sheet___"]').count()) === 0, 'Logout must open the confirmation directly')
  await page.getByText('取消', { exact: true }).filter({ visible: true }).click()
  await page.getByText('确定要退出当前账号吗？', { exact: true }).filter({ visible: true }).waitFor({ state: 'hidden' })
  check(writes.filter(path => path.endsWith('/auth/logout')).length === 0, 'Cancel keeps the session')
  await page.locator('#app').getByText('退出登录', { exact: true }).click()
  await page.getByText('退出', { exact: true }).filter({ visible: true }).click()
  await page.waitForURL('**/#/pages/login/index')
  check(writes.filter(path => path.endsWith('/auth/logout')).length === 1, 'Confirmed logout runs once')
  check(await page.evaluate(() => localStorage.getItem('yishan:app:accessToken') === null), 'Confirmed logout clears the scoped session')
  check(errors.length === 0, errors.join('; '))
  return { themes: ['light', 'dark'], checks: ['search spacing', 'compact settings', 'multiline input', 'WeUI ActionSheet and safe area', 'direct logo upload/removal', 'direct logout/cancel'], fixtureWrites: writes.length, errors }
}
