// Run against the built H5 at localhost:21003 with playwright-cli run-code --filename=...
async (page) => {
  const check = (ok, message) => {
    if (!ok) throw new Error(message)
  }
  const origin = 'http://127.0.0.1:21003'
  // 工作台没有刷新按钮：回到 Tab 时 useDidShow 强制重新加载，与真实用户路径一致。
  const refreshWorkbench = async () => {
    await page.locator('.weui-tabbar__label', { hasText: '我的' }).click()
    await page.waitForTimeout(300)
    await page.locator('.weui-tabbar__label', { hasText: '工作台' }).click()
    await page.waitForLoadState('networkidle')
  }
  const url = `${origin}/#/pages/apps/index`
  const entry = (id, parentId, name, page) => ({
    id,
    parentId,
    type: 1,
    name,
    page,
    moduleId: 'core',
    sortOrder: id,
    status: '1',
    children: null,
  })
  const group = (id, name, children, status = '1') => ({
    id,
    type: 0,
    name,
    moduleId: 'core',
    sortOrder: id,
    status,
    children,
  })
  let userId = 1
  const initialPermissions = ['system:user:list', 'app:contacts:dept-tree', 'app:menu:authorized-tree',
    'system:role:list', 'system:department:list', 'system:position:list', 'system:menu:list',
    'system:app-menu:list', 'region:tree', 'system:option:list', 'system:storage:list',
    'system:attachment:list', 'system:login-log:list', 'demo:health:read', 'demo:todos:list', 'region:list']
  let permissions = initialPermissions
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
      }
    if (path.endsWith('/menus/home')) data = { pinned: [], ranked: [] }
    if (path.endsWith('/auth/capabilities'))
      data = { permissions, enabledModuleIds: ['demo', 'portal', 'shop'] }
    if (path.endsWith('/menus/authorized'))
      data = empty
        ? []
        : [
            // 通讯录 only lives in 企业协作 so disabling that group still hides it below.
            group(5, '协同办公', [entry(7, 5, '用户管理', 'pages/system/user/index')]),
            group(10, '系统管理', [
              entry(11, 10, '用户管理', 'pages/system/user/index'),
              entry(12, 10, '字典管理', 'pages/system/dict/index'),
              entry(13, 10, '角色管理', 'pages/system/role/index'),
              entry(14, 10, '岗位管理', 'pages/system/position/index'),
              entry(15, 10, '菜单管理', 'pages/system/menu/index'),
              entry(16, 10, '工作台管理', 'pages/system/app-menu/index'),
              entry(17, 10, '地区管理', 'pages/system/region/index'),
              entry(18, 10, '站点配置', 'pages/system/site/index'),
              entry(19, 10, '云存储', 'pages/system/storage/index'),
              entry(22, 10, '媒体库', 'pages/system/attachments/index'),
              entry(23, 10, '登录日志', 'pages/system/login-log/index'),
            ]),
            group(
              20,
              '企业协作',
              [entry(21, 20, '通讯录', 'pages/contacts/index/index')],
              disabled ? '0' : '1',
            ),
            group(40, '示例插件', [
              entry(41, 40, '健康检查', 'pages/demo/health/index'),
              entry(42, 40, 'Todo 示例', 'pages/demo/todos/index'),
              entry(43, 40, '省市级联', 'pages/demo/region/index'),
            ]),
            group(30, '未适配', [entry(31, 30, '未适配', 'pages/not-built/index')]),
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
  // Seed before the app evaluates its initial auth state, only once per browser session.
  await page.addInitScript(() => {
    if (location.protocol !== 'http:' || sessionStorage.getItem('workbench-fixture')) return
    localStorage.clear()
    localStorage.setItem('yishan:app:accessToken', JSON.stringify({ data: 'test-only' }))
    sessionStorage.setItem('workbench-fixture', 'seeded')
  })
  await page.goto(url)
  await page.reload()
  await page.waitForLoadState('networkidle')
  await page.goto(url)
  await page.getByText('系统管理', { exact: true }).waitFor()
  check((await page.getByText('协同办公', { exact: true }).count()) === 1, 'Server groups are shown as-is')
  check(
    (await page.locator('[aria-label="用户管理"]').count()) === 1,
    'Each authorized app appears once',
  )
  check((await page.locator('[aria-label="通讯录"]').count()) === 1, 'Admin must see contacts')
  check(
    (await page.locator('[aria-label="字典管理"]').count()) === 0,
    'Pages without the current user permission must be hidden',
  )
  check(
    (await page.locator('[aria-label="未适配"]').count()) === 0,
    'Unregistered pages must be hidden, not shown as placeholders',
  )
  check(
    (await page.getByText('移动端功能正在建设中，敬请期待。', { exact: true }).count()) === 0,
    'No under-construction placeholders',
  )

  await page.setViewportSize({ width: 375, height: 667 })
  await page.waitForFunction(() => Math.abs(document.querySelector('[class*=apps__searchWrap]').getBoundingClientRect().height - 44) < 1)
  const visual = await page.evaluate(() => {
    const title = document.querySelector('[class*=apps__pageTitle]').getBoundingClientRect()
    const grid = document.querySelector('[class*=apps__grid]')
    const items = [...grid.children].map(el => el.getBoundingClientRect())
    const icons = [...grid.querySelectorAll('[class*=apps__iconWrap]')]
    const category = getComputedStyle(document.querySelector('[class*=apps__category]'))
    return {
      centered: Math.abs(title.left + title.width / 2 - innerWidth / 2) < 1,
      fourColumns: items.slice(0, 4).every(item => Math.abs(item.top - items[0].top) < 1) && items[4].top > items[0].top,
      iconSizes: icons.map(el => el.getBoundingClientRect().width),
      iconRadii: icons.map(el => parseFloat(getComputedStyle(el).borderRadius)),
      filledWhite: icons.every(el => {
        const svg = decodeURIComponent(el.firstElementChild.style.backgroundImage)
        return svg.includes('fill="#FFFFFF"') && !svg.includes('stroke=')
      }),
      labelSize: parseFloat(getComputedStyle(grid.querySelector('[class*=apps__label]')).fontSize),
      cardRadius: parseFloat(getComputedStyle(grid.parentElement).borderRadius),
      colors: new Set(icons.map(el => getComputedStyle(el).backgroundColor)).size,
      titleSize: parseFloat(category.fontSize),
      titleWeight: category.fontWeight,
    }
  })
  check(visual.centered, 'Heading must be centered')
  check(visual.fourColumns, 'Grid must wrap after four apps')
  check(visual.iconSizes.every(size => Math.abs(size - 48) < 1), 'Icon bases must be 48px')
  check(visual.colors >= 5, 'Apps must have independent palette colors')
  check(visual.filledWhite, 'App glyphs must be white filled shapes')
  check(visual.iconRadii.every(radius => radius === 14), 'Icon bases use 14px radii')
  check(visual.labelSize === 14 && visual.cardRadius === 16, 'Labels and card corners follow mobile sizing')
  check(visual.titleSize >= 16 && visual.titleSize <= 18 && visual.titleWeight === '600', 'Categories use plain semibold headings')
  check(await page.locator('#taro-navigation-bar').isHidden(), 'Native title must not duplicate custom heading')
  check((await page.locator('.weui-tabbar__label').allTextContents()).join(',') === '首页,工作台,我的', 'Three native navigation tabs must remain')
  check((await page.locator('.weui-bar__item_on').innerText()) === '工作台', 'Workbench tab must be selected')
  await page.screenshot({ path: '.playwright-cli/workbench-375.png', fullPage: true })

  await page.setViewportSize({ width: 320, height: 800 })
  await page.waitForFunction(
    () => parseFloat(getComputedStyle(document.documentElement).fontSize) <= 20,
  )
  const geometry = await page.evaluate(() => {
    const title = document.querySelector('[class*=apps__pageTitle]')
    return {
      width: document.documentElement.scrollWidth,
      viewport: innerWidth,
      titleHeight: title.getBoundingClientRect().height,
    }
  })
  check(geometry.width <= geometry.viewport, 'Small screen must not overflow horizontally')
  check(
    geometry.titleHeight < 40,
    'Workbench title must stay on one line',
  )

  const beforeSearch = requests.length
  await page.getByPlaceholder('搜索应用').fill('用 户')
  check((await page.locator('[aria-label="用户管理"]').count()) === 1, 'Search must deduplicate')
  check((await page.locator('[aria-label="通讯录"]').count()) === 0, 'Search must filter locally')
  await page.getByPlaceholder('搜索应用').fill('不存在')
  await page.getByText('未找到相关应用', { exact: true }).waitFor()
  check(requests.length === beforeSearch, 'Search must not request APIs')
  await page.getByText('清空', { exact: true }).click()

  check((await page.getByText('常用应用', { exact: true }).count()) === 0, 'Workbench excludes favorites')
  check((await page.getByText('全部应用', { exact: true }).count()) === 0, 'Workbench excludes redundant title')
  userId = 2
  await page.reload()
  await page.getByText('系统管理', { exact: true }).waitFor()
  check((await page.locator('[aria-label="用户管理"]').count()) === 1, 'Account switch preserves authorized catalog')
  userId = 1
  await page.reload()
  await page.getByText('系统管理', { exact: true }).waitFor()

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
  await refreshWorkbench()
  await page.getByText('刷新失败，请重试', { exact: true }).waitFor()
  check(
    (await page.locator('[aria-label="用户管理"]').count()) === 1,
    'Failed refresh must keep prior grid',
  )
  fail = false
  await page.getByText('重试', { exact: true }).click()
  await page.getByText('刷新失败，请重试', { exact: true }).waitFor({ state: 'hidden' })

  permissions = ['app:contacts:dept-tree', 'app:menu:authorized-tree']
  await refreshWorkbench()
  await page.getByPlaceholder('搜索应用').fill('user')
  check(
    (await page.locator('[aria-label="用户管理"]').count()) === 0,
    'Entries without permission must be hidden',
  )
  await page.getByText('清空', { exact: true }).click()
  disabled = true
  await refreshWorkbench()
  await page.locator('[aria-label="通讯录"]').waitFor({ state: 'hidden' })
  empty = true
  await refreshWorkbench()
  await page.getByText('暂无可用应用', { exact: true }).waitFor()
  const beforeDirect = requests.filter((path) => path === '/api/v1/admin/users').length
  await page.goto(`${origin}/#/pages/system/user/index`)
  await page.reload()
  await page.waitForLoadState('networkidle')
  check((await page.locator('[class*=header__title]').count()) === 0, 'Unauthorized deep link must not render user management')
  check(
    requests.filter((path) => path === '/api/v1/admin/users').length === beforeDirect,
    'Unauthorized deep link must not fetch users',
  )
  check(errors.length === 0, `Browser errors: ${errors.join('; ')}`)
  return {
    passed: [
      'admin catalog',
      'unregistered entries hidden',
      '375px visual geometry and 320px layout',
      'local search',
      'application center without favorites',
      'account isolation',
      'navigation and return',
      'refresh retry',
      'revoked permission and disabled group',
      'deep-link denial',
    ],
    apiFixtures: true,
  }
}
