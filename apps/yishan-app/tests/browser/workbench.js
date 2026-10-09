// Run against the built H5 at localhost:21803 with playwright-cli run-code --filename=...
async (page) => {
  const check = (ok, message) => {
    if (!ok) throw new Error(message)
  }
  const origin = 'http://127.0.0.1:21803'
  const url = `${origin}/#/pages/apps/index`
  const node = (id, name, path, type = 1, children = []) => ({
    id,
    name,
    path,
    type,
    status: '1',
    sort_order: id,
    hideInMenu: false,
    isExternalLink: false,
    keepAlive: false,
    children,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  })
  let userId = 1
  let permissions = ['system:user:list', 'app:contacts:dept-tree', 'app:menu:authorized-tree']
  let disabled = false
  let empty = false
  let fail = false
  const requests = []
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.unroute('**/api/**')
  await page.route('**/api/**', async (route) => {
    const path = route
      .request()
      .url()
      .replace(/^https?:\/\/[^/]+/, '')
      .split('?')[0]
    requests.push(path)
    if (fail && path.endsWith('/menus/authorized')) {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, code: 500, message: '测试网络异常', data: null }),
      })
      return
    }
    let data = []
    if (path.endsWith('/auth/me'))
      data = {
        id: userId,
        username: `test-${userId}`,
        realName: '测试用户',
        gender: '0',
        genderName: '未知',
        status: '1',
        statusName: '正常',
        loginCount: 1,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
        accessPath: ['/system/user', '/contacts'],
      }
    if (path.endsWith('/auth/capabilities'))
      data = { permissions, enabledModuleIds: ['demo', 'portal', 'shop'] }
    if (path.endsWith('/menus/authorized'))
      data = empty
        ? []
        : [
            node(10, '系统管理', '/system', 0, [
              node(11, '用户管理', '/system/user'),
              node(12, '字典管理', '/system/dict'),
            ]),
            {
              ...node(20, '企业协作', '/collaboration', 0, [node(21, '通讯录', '/contacts')]),
              status: disabled ? '0' : '1',
            },
            node(30, '未适配', '/not-built'),
            node(31, '操作', '/system/user', 2),
          ]
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        code: 200,
        message: 'OK',
        data,
        timestamp: '2026-01-01',
        pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 },
      }),
    })
  })
  await page.goto(url)
  await page.evaluate(() => {
    localStorage.clear()
    localStorage.setItem('yishan:app:accessToken', JSON.stringify({ data: 'test-only' }))
  })
  await page.reload()
  await page.getByText('全部应用', { exact: true }).waitFor()
  check(
    (await page.locator('[aria-label="用户管理"]').count()) === 2,
    'Admin must see user app in common and all sections',
  )
  check((await page.locator('[aria-label="通讯录"]').count()) === 2, 'Admin must see contacts')
  check(
    (await page.locator('[aria-label="字典管理"]').count()) === 2,
    'Unadapted menus must have icons in favorites and all apps',
  )
  check(
    (await page.locator('[aria-label="未适配"]').count()) === 2,
    'Unregistered menu must appear as a placeholder',
  )
  check((await page.locator('[aria-label="操作"]').count()) === 0, 'Buttons are not apps')
  await page.locator('[aria-label="字典管理"]').first().click()
  await page.getByText('移动端功能正在建设中，敬请期待。', { exact: true }).waitFor()
  check(page.url() === url, 'Placeholder must not navigate')
  await page.getByText('我知道了', { exact: true }).click()
  // Keep two favorites for the existing ordering/account regression scenarios.
  await page.getByText('编辑', { exact: true }).click()
  for (const name of ['字典管理', '未适配']) {
    await page
      .locator('[class*=apps__editRow]')
      .filter({ has: page.getByText(name, { exact: true }) })
      .getByText('移除', { exact: true })
      .click()
  }
  await page.getByText('完成', { exact: true }).click()

  await page.setViewportSize({ width: 320, height: 800 })
  await page.waitForFunction(
    () => parseFloat(getComputedStyle(document.documentElement).fontSize) <= 20,
  )
  const geometry = await page.evaluate(() => {
    const title = document.querySelector('[class*=apps__pageTitle]')
    const action = document.querySelector('[class*=apps__action]')
    return {
      width: document.documentElement.scrollWidth,
      viewport: innerWidth,
      titleHeight: title.getBoundingClientRect().height,
      actionWidth: action.getBoundingClientRect().width,
    }
  })
  check(geometry.width <= geometry.viewport, 'Small screen must not overflow horizontally')
  check(
    geometry.titleHeight < 40 && geometry.actionWidth < 80,
    'Taro default buttons must not squeeze titles',
  )

  const beforeSearch = requests.length
  await page.getByPlaceholder('搜索应用').fill('用 户')
  await page.getByText('搜索结果', { exact: true }).waitFor()
  check((await page.locator('[aria-label="用户管理"]').count()) === 1, 'Search must deduplicate')
  check((await page.locator('[aria-label="通讯录"]').count()) === 0, 'Search must filter locally')
  await page.getByPlaceholder('搜索应用').fill('不存在')
  await page.getByText('未找到相关应用', { exact: true }).waitFor()
  check(requests.length === beforeSearch, 'Search must not request APIs')
  await page.getByText('清空', { exact: true }).click()

  await page.getByText('编辑', { exact: true }).click()
  await page.getByText('下移', { exact: true }).first().click()
  check(
    (
      await page
        .locator('[class*=apps__editRow]')
        .filter({ has: page.getByText('移除', { exact: true }) })
        .locator('[class*=apps__editName]')
        .allTextContents()
    ).join(',') === '通讯录,用户管理',
    'Down operation must reorder',
  )
  await page.getByText('完成', { exact: true }).click()
  await page.reload()
  await page.getByText('全部应用', { exact: true }).waitFor()
  check(
    (
      await page
        .locator('[class*=apps__section]')
        .first()
        .locator('[class*=apps__label]')
        .allTextContents()
    ).join(',') === '通讯录,用户管理',
    'Saved order must survive reload',
  )
  await page.getByText('编辑', { exact: true }).click()
  await page.getByText('移除', { exact: true }).first().click()
  await page
    .locator('[class*=apps__editRow]')
    .filter({ has: page.getByText('通讯录', { exact: true }) })
    .getByText('添加', { exact: true })
    .click()
  check(
    (
      await page
        .locator('[class*=apps__editRow]')
        .filter({ has: page.getByText('移除', { exact: true }) })
        .locator('[class*=apps__editName]')
        .allTextContents()
    ).join(',') === '用户管理,通讯录',
    'Remove and add must append the selected app',
  )
  await page.getByText('移除', { exact: true }).first().click()
  await page.getByText('移除', { exact: true }).click()
  await page.getByText('完成', { exact: true }).click()
  await page.reload()
  await page.getByText('点击编辑，添加常用应用', { exact: true }).waitFor()
  check(
    (await page.locator('[aria-label="用户管理"]').count()) === 1,
    'Explicit empty favorites must not change all apps',
  )

  userId = 2
  await page.reload()
  await page.getByText('全部应用', { exact: true }).waitFor()
  check(
    (await page.locator('[aria-label="用户管理"]').count()) === 2,
    'New account must get its own defaults',
  )
  userId = 1
  await page.reload()
  await page.getByText('点击编辑，添加常用应用', { exact: true }).waitFor()

  await page.getByPlaceholder('搜索应用').fill('user')
  await page.locator('[aria-label="用户管理"]').click()
  await page.waitForURL('**/#/pages/system/user/index')
  // Let Taro finish its page transition before exercising the page's back control.
  await page.waitForTimeout(600)
  await page.getByText('‹', { exact: true }).click()
  await page.waitForTimeout(600)
  await page.getByPlaceholder('搜索应用').waitFor()
  check(
    (await page.getByPlaceholder('搜索应用').inputValue()) === 'user',
    'Returning must preserve search state',
  )
  await page.getByText('清空', { exact: true }).click()
  fail = true
  await page.getByText('刷新', { exact: true }).click()
  await page.getByText('刷新失败，请重试', { exact: true }).waitFor()
  check(
    (await page.locator('[aria-label="用户管理"]').count()) === 1,
    'Failed refresh must keep prior grid',
  )
  fail = false
  await page.getByText('重试', { exact: true }).click()
  await page.getByText('刷新失败，请重试', { exact: true }).waitFor({ state: 'hidden' })

  permissions = ['app:contacts:dept-tree', 'app:menu:authorized-tree']
  await page.getByText('刷新', { exact: true }).click()
  await page.getByText('刷新中', { exact: true }).waitFor({ state: 'hidden' })
  await page.getByPlaceholder('搜索应用').fill('user')
  check(
    (await page.locator('[aria-label="用户管理"]').count()) === 1,
    'Preview does not add permission filtering',
  )
  await page.locator('[aria-label="用户管理"]').click()
  await page.getByText('应用已不可用或访问权限已变更', { exact: true }).waitFor()
  check(page.url() === url, 'Existing business pages retain access checks')
  await page.getByText('清空', { exact: true }).click()
  disabled = true
  await page.getByText('刷新', { exact: true }).click()
  await page.locator('[aria-label="通讯录"]').waitFor({ state: 'hidden' })
  empty = true
  await page.getByText('刷新', { exact: true }).click()
  await page.getByText('暂无可用应用', { exact: true }).waitFor()
  const beforeDirect = requests.filter((path) => path === '/api/v1/admin/users').length
  await page.goto(`${origin}/#/pages/system/user/index`)
  await page.getByText('无权访问', { exact: true }).waitFor()
  check(
    requests.filter((path) => path === '/api/v1/admin/users').length === beforeDirect,
    'Unauthorized deep link must not fetch users',
  )
  check(errors.length === 0, `Browser errors: ${errors.join('; ')}`)
  return {
    passed: [
      'admin catalog',
      'placeholder icons and modal',
      '320px layout',
      'local search',
      'favorites add/remove/order/reload',
      'account isolation',
      'navigation and return',
      'refresh retry',
      'preview with revoked permission and disabled menu',
      'deep-link denial',
    ],
    apiFixtures: true,
  }
}
