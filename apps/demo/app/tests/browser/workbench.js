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
            // 协同办公 must keep 用户管理 (also listed under 系统管理) so the cross-group dedup check stays
            // exercised and the group stays non-empty; 通讯录 only lives in 企业协作 so disabling that
            // group still hides it below.
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
  await page.evaluate(() => localStorage.removeItem('yishan:app:theme'))
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
  // 搜索框已改为复用共享 ManagementSearchBar：页面不再有私有的 apps__searchWrap，
  // 改为断言共享搜索框仍是它自己的 48px 高度（与列表行同高），布局塌陷依旧会被抓到。
  const sharedSearch = page.locator('[class*="ManagementSearch-module__search___"]').first()
  await sharedSearch.waitFor()
  // Taro 把 .search 的 height 从 48px 编译成 2.4rem —— 等根字号脚本把
  // documentElement.fontSize 改写到 375 视口下的目标值（20px）后再读，
  // 否则会在前一个 1280x720 的根字号（clamp 到 40px）下读到 96。
  await page.waitForFunction(
    () => Math.abs(parseFloat(getComputedStyle(document.documentElement).fontSize) - 20) < 0.5,
  )
  const searchBoxHeight = await sharedSearch.evaluate(el => el.getBoundingClientRect().height)
  check(Math.abs(searchBoxHeight - 48) < 1, 'Shared search bar must keep its 48px height')
  const visual = await page.evaluate(() => {
    // Sample the 系统管理 section: it is the only group with enough apps to wrap and vary colors.
    const section = [...document.querySelectorAll('[class*=apps__section]')].find(
      el => el.querySelector('[class*=apps__category]')?.textContent.trim() === '系统管理',
    )
    const grid = section.querySelector('[class*=apps__grid]')
    const items = [...grid.children].map(el => el.getBoundingClientRect())
    const icons = [...grid.querySelectorAll('[class*=index-module__tile___]')]
    const category = getComputedStyle(section.querySelector('[class*=apps__category]'))
    return {
      headerRemoved: !document.querySelector('[class*=apps__pageTitle]'),
      fourColumns: items.slice(0, 4).every(item => Math.abs(item.top - items[0].top) < 1) && items[4].top > items[0].top,
      iconSizes: icons.map(el => el.getBoundingClientRect().width),
      iconRadii: icons.map(el => parseFloat(getComputedStyle(el).borderRadius)),
      filledWhite: icons.every(el => {
        const glyph = el.firstElementChild
        const style = getComputedStyle(glyph)
        const svg = decodeURIComponent(style.maskImage)
        return style.backgroundColor === 'rgb(255, 255, 255)' && svg.startsWith('url(') && !svg.includes('stroke=')
      }),
      labelSize: parseFloat(getComputedStyle(grid.querySelector('[class*=apps__label]')).fontSize),
      cardRadius: parseFloat(getComputedStyle(grid.parentElement).borderRadius),
      colors: new Set(icons.map(el => getComputedStyle(el).backgroundColor)).size,
      titleSize: parseFloat(category.fontSize),
      titleWeight: category.fontWeight,
    }
  })
  check(visual.headerRemoved, 'H5 workbench must not duplicate the host navigation heading')
  check(visual.fourColumns, 'Grid must wrap after four apps')
  check(visual.iconSizes.every(size => Math.abs(size - 48) < 1), 'Icon bases must be 48px')
  check(visual.colors >= 5, 'Apps must have independent palette colors')
  check(visual.filledWhite, 'App glyphs must be white filled shapes')
  check(visual.iconRadii.every(radius => radius === 12), 'Icon bases use 12px radii')
  check(visual.labelSize === 14 && visual.cardRadius === 12, 'Labels and card corners follow mobile sizing')
  check(visual.titleSize >= 16 && visual.titleSize <= 18 && visual.titleWeight === '600', 'Categories use plain semibold headings')
  check(await page.locator('#taro-navigation-bar').isHidden(), 'Native title must not duplicate custom heading')
  check((await page.locator('.weui-tabbar__label').allTextContents()).join(',') === '首页,工作台,我的', 'Three native navigation tabs must remain')
  check((await page.locator('.weui-bar__item_on').innerText()) === '工作台', 'Workbench tab must be selected')
  await page.screenshot({ path: '.playwright-cli/workbench-375.png', fullPage: true })

  function luminance(color) {
    const [r, g, b] = color.match(/[\d.]+/g).slice(0, 3).map(Number)
      .map(value => value / 255)
      .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
    return r * 0.2126 + g * 0.7152 + b * 0.0722
  }
  function contrast(a, b) {
    const values = [luminance(a), luminance(b)].sort((x, y) => x - y)
    return (values[1] + 0.05) / (values[0] + 0.05)
  }
  for (const mode of ['dark', 'light']) {
    await page.emulateMedia({ colorScheme: mode })
    await page.waitForFunction(value => document.documentElement.dataset.theme === value, mode)
    const colors = await page.evaluate(() => {
      const surface = document.querySelector('[class*=apps__section]')
      return {
        page: getComputedStyle(document.querySelector('.page-container')).backgroundColor,
        body: getComputedStyle(document.body).backgroundColor,
        surface: getComputedStyle(surface).backgroundColor,
        title: getComputedStyle(surface.querySelector('[class*=apps__category]')).color,
        label: getComputedStyle(surface.querySelector('[class*=apps__label]')).color,
        shadow: getComputedStyle(surface).boxShadow,
      }
    })
    check(colors.page === colors.body, `${mode}: workbench uses the themed page background`)
    check(contrast(colors.title, colors.surface) >= 4.5, `${mode}: group headings remain readable`)
    check(contrast(colors.label, colors.surface) >= 4.5, `${mode}: application names remain readable`)
    check(colors.shadow === 'none', `${mode}: cards separate by surface color`)
    await page.screenshot({ path: `.playwright-cli/workbench-${mode}-375.png`, fullPage: true })
  }

  await page.setViewportSize({ width: 320, height: 800 })
  await page.waitForFunction(
    () => parseFloat(getComputedStyle(document.documentElement).fontSize) <= 20,
  )
  const geometry = await page.evaluate(() => {
    return {
      width: document.documentElement.scrollWidth,
      viewport: innerWidth,
    }
  })
  check(geometry.width <= geometry.viewport, 'Small screen must not overflow horizontally')

  // 几何：从 .page-container 出发逐段测间距，验证最近一轮的 16px 节奏。
  // Taro 的 postcss-pxtransform 把 CSS 变量里写的 `12px` / `16px` 编译成 `0.6rem` /
  // `0.8rem`，于是 `--space-3` / `--space-4` 也跟着 documentElement.fontSize
  // 走。Taro 把根字号钳在 [20, 40] 内：320 视口 → 20，390 → 20.8。所以本块
  // 用 `rem × rootFontSize` 表达设计意图，而不是写死 px。rows 1 / 2 是元素定位
  // 而不是 CSS 变量，确为 0px。仅在 ready 态断言（apps__section 已可见）；
  // 空 / 错误态由 StateView 渲染，没有 background，bar 与灰底相接 0px 是对的。
  const measure = async (width) => {
    await page.setViewportSize({ width, height: 844 })
    // 等 Taro 动态根字号脚本把 documentElement.fontSize 重写到当前视口的目标值。
    await page.waitForFunction(
      (w) => {
        const r = document.documentElement
        const expected = Math.max(20, Math.min(40, (20 * w) / 375))
        return Math.abs(parseFloat(getComputedStyle(r).fontSize) - expected) < 0.5
      },
      width,
    )
    const data = await page.evaluate(() => {
      const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize)
      const container = document.querySelector('.page-container')
      const headerTop = document.querySelector('[class*=apps__top]')
      const headerBox = document.querySelector('[class*=apps__header]')
      const filterBar = document.querySelector('[class*="ManagementSearch-module__filters___"]')
      const search = document.querySelector('[class*="ManagementSearch-module__search___"]')
      const cards = [...document.querySelectorAll('[class*=apps__section]')]
      const firstCard = cards[0]
      const lastCard = cards[cards.length - 1]
      const firstCategory = firstCard ? firstCard.querySelector('[class*=apps__category]') : null
      const secondCard = cards[1] || null
      const rect = (el) => (el ? el.getBoundingClientRect() : null)
      return {
        rootFontSize,
        container: rect(container),
        headerTop: rect(headerTop),
        headerBox: rect(headerBox),
        filterBar: rect(filterBar),
        search: rect(search),
        filterPaddingBottom: filterBar ? parseFloat(getComputedStyle(filterBar).paddingBottom) : null,
        firstCard: rect(firstCard),
        firstCategory: rect(firstCategory),
        secondCard: rect(secondCard),
        lastCard: rect(lastCard),
        cardCount: cards.length,
        containerPaddingBottom: container ? parseFloat(getComputedStyle(container).paddingBottom) : null,
      }
    })
    check(!data.headerTop && !data.headerBox, `[w=${width}] H5 workbench navigation must be absent`)
    check(
      data.filterBar && Math.abs(data.filterBar.top) < 1,
      `[w=${width}] Search section should begin at the page top`,
    )
    // row 3: bar white top → search box top = 0.6rem × 根字号（filter padding-top = --space-3）
    const space3 = 0.6 * data.rootFontSize
    check(
      data.filterPaddingBottom !== null && Math.abs(data.filterPaddingBottom - space3) < 0.5,
      `[w=${width}] Workbench search must keep its bottom padding`,
    )
    check(
      data.filterBar &&
        data.search &&
        Math.abs(data.search.top - data.filterBar.top - space3) < 0.5,
      `[w=${width}] Bar padding-top should be 0.6rem (${space3.toFixed(2)}px at root ${data.rootFontSize.toFixed(2)}); got ${data.filterBar && data.search ? (data.search.top - data.filterBar.top).toFixed(2) : '?'}px`,
    )
    // row 4: 搜索框高度 = 2.4rem × 根字号；左右各 0.8rem 边距（filter padding-left/right = --space-4）
    const space4 = 0.8 * data.rootFontSize
    const expectedSearchHeight = 2.4 * data.rootFontSize
    check(
      data.search && Math.abs(data.search.height - expectedSearchHeight) < 0.5,
      `[w=${width}] Search height should be 2.4rem (${expectedSearchHeight.toFixed(2)}px at root ${data.rootFontSize.toFixed(2)}); got ${data.search ? data.search.height.toFixed(2) : '?'}px`,
    )
    check(
      data.search &&
        data.filterBar &&
        Math.abs(data.search.left - data.filterBar.left - space4) < 0.5,
      `[w=${width}] Search box should sit 0.8rem (${space4.toFixed(2)}px at root ${data.rootFontSize.toFixed(2)}) from left edge; got ${data.search && data.filterBar ? data.search.left.toFixed(2) : '?'}px`,
    )
    check(
      data.search &&
        data.filterBar &&
        Math.abs(data.filterBar.right - data.search.right - space4) < 0.5,
      `[w=${width}] Search box should sit 0.8rem (${space4.toFixed(2)}px at root ${data.rootFontSize.toFixed(2)}) from right edge; got ${data.search && data.filterBar ? (data.filterBar.right - data.search.right).toFixed(2) : '?'}px`,
    )
    // 仅当 ready 态（cards 已可见）断言 row 5/6/7/8/9。
    if (data.firstCard && data.lastCard) {
      // row 5: bar white bottom → first card top = 0.8rem × 根字号（var(--space-4)）
      check(
        data.filterBar &&
          Math.abs(data.firstCard.top - data.filterBar.bottom - space4) < 0.5,
        `[w=${width}] Bar → first card should be 0.8rem (${space4.toFixed(2)}px at root ${data.rootFontSize.toFixed(2)}); got ${data.filterBar ? (data.firstCard.top - data.filterBar.bottom).toFixed(2) : '?'}px`,
      )
      // row 6: first card top → its category title = .8rem × 根字号（card padding-top）
      const expectedCategoryOffset = 0.8 * data.rootFontSize
      check(
        data.firstCategory &&
          Math.abs(data.firstCategory.top - data.firstCard.top - expectedCategoryOffset) < 0.5,
        `[w=${width}] Card top → category should be .8rem (${expectedCategoryOffset.toFixed(2)}px at root ${data.rootFontSize.toFixed(2)}); got ${data.firstCategory ? (data.firstCategory.top - data.firstCard.top).toFixed(2) : '?'}px`,
      )
      // row 7: card bottom → next card top = 0.8rem × 根字号（仅在两张及以上卡片时）
      if (data.secondCard) {
        check(
          Math.abs(data.secondCard.top - data.firstCard.bottom - space4) < 0.5,
          `[w=${width}] Card → next card should be 0.8rem (${space4.toFixed(2)}px at root ${data.rootFontSize.toFixed(2)}); got ${(data.secondCard.top - data.firstCard.bottom).toFixed(2)}px`,
        )
      }
      // row 8: last card bottom → end of page box = 1.6rem × 根字号（卡片 0.8rem margin-bottom + 容器 0.8rem padding-bottom）
      const expectedPageEnd = 1.6 * data.rootFontSize
      check(
        data.container &&
          Math.abs(data.container.bottom - data.lastCard.bottom - expectedPageEnd) < 0.5,
        `[w=${width}] Last card bottom → page bottom should be 1.6rem (${expectedPageEnd.toFixed(2)}px at root ${data.rootFontSize.toFixed(2)}); got ${data.container ? (data.container.bottom - data.lastCard.bottom).toFixed(2) : '?'}px`,
      )
      // row 9: effective page padding-bottom = 0.8rem × 根字号（apps 覆盖 PageContainer 的 tab-bar allowance）
      check(
        data.containerPaddingBottom !== null &&
          Math.abs(data.containerPaddingBottom - space4) < 0.5,
        `[w=${width}] Apps page padding-bottom should be 0.8rem (${space4.toFixed(2)}px at root ${data.rootFontSize.toFixed(2)}); got ${data.containerPaddingBottom}`,
      )
    }
    return data
  }
  await measure(320)
  await measure(390)

  await page.evaluate(() => document.documentElement.style.setProperty('--safe-area-top', '47px'))
  const safeTop = await page.evaluate(() => {
    const search = document.querySelector('[class*="ManagementSearch-module__search___"]')
    return search.getBoundingClientRect().top - 0.6 * parseFloat(getComputedStyle(document.documentElement).fontSize)
  })
  check(Math.abs(safeTop - 47) < 1, 'H5 search must consume the top safe area exactly once')
  await page.evaluate(() => document.documentElement.style.removeProperty('--safe-area-top'))

  const beforeSearch = requests.length
  await page.getByPlaceholder('搜索应用').fill('用 户')
  check((await page.locator('[aria-label="用户管理"]').count()) === 1, 'Search must deduplicate')
  check((await page.locator('[aria-label="通讯录"]').count()) === 0, 'Search must filter locally')
  await page.getByPlaceholder('搜索应用').fill('不存在')
  await page.getByText('未找到相关应用', { exact: true }).waitFor()
  check(requests.length === beforeSearch, 'Search must not request APIs')
  // 私有「清空」按钮已移除，清除入口由共享 ManagementSearchBar 提供
  await page.locator('[aria-label="清除搜索"]').click()

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
  // 宿主浏览器承载返回；等待 Taro 完成页面转场后使用浏览器历史返回。
  await page.waitForTimeout(600)
  await page.goBack()
  await page.waitForTimeout(600)
  await page.getByPlaceholder('搜索应用').waitFor()
  check(
    (await page.getByPlaceholder('搜索应用').inputValue()) === 'user',
    'Returning must preserve search state',
  )
  // 私有「清空」按钮已移除，清除入口由共享 ManagementSearchBar 提供
  await page.locator('[aria-label="清除搜索"]').click()
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
  // 私有「清空」按钮已移除，清除入口由共享 ManagementSearchBar 提供
  await page.locator('[aria-label="清除搜索"]').click()
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
