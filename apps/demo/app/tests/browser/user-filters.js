async (page) => {
  const origin = 'http://127.0.0.1:21003'
  const queries = []
  const user = {
    id: 2,
    username: 'wang_demo',
    realName: '王磊',
    phone: '13800136721',
    status: '1',
    gender: '0',
    loginCount: 1,
  }
  const permissions = ['system:user:list', 'app:menu:authorized-tree']
  const menus = [
    {
      id: 1,
      name: '系统管理',
      type: 0,
      status: '1',
      moduleId: 'core',
      children: [
        {
          id: 2,
          parentId: 1,
          name: '用户管理',
          type: 1,
          status: '1',
          moduleId: 'core',
          page: 'pages/system/user/index',
        },
      ],
    },
  ]
  await page.unroute('**/api/**')
  await page.route('**/api/**', async (route) => {
    const rawUrl = route.request().url()
    const url = {
      pathname: rawUrl.split('?')[0],
      searchParams: (rawUrl.split('?')[1] || '')
        .split('&')
        .filter(Boolean)
        .map((part) => part.split('=').map(decodeURIComponent)),
    }
    let data = []
    if (url.pathname.endsWith('/auth/me')) data = user
    else if (url.pathname.endsWith('/auth/capabilities'))
      data = { permissions, enabledModuleIds: [] }
    else if (url.pathname.endsWith('/menus/authorized')) data = menus
    else if (/\/admin\/users\/?$/.test(url.pathname)) {
      queries.push(Object.fromEntries(url.searchParams))
      data = [user]
    }
    await route.fulfill({
      json: {
        success: true,
        code: 200,
        data,
        pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
      },
    })
  })
  await page.goto(origin)
  await page.evaluate((value) => {
    localStorage.setItem('yishan:app:accessToken', JSON.stringify({ data: 'fixture-token' }))
    localStorage.setItem('yishan:app:user', JSON.stringify({ data: value }))
  }, user)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${origin}/#/pages/system/user/index`)
  await page.reload()
  await page.getByText('王磊', { exact: true }).waitFor()
  await page.getByLabel('全部状态', { exact: true }).click()
  const statusSheet = page.locator('[class*="sheet"]').filter({ hasText: '用户状态' })
  await statusSheet.waitFor()
  const statusBox = await statusSheet.boundingBox()
  if (Math.abs(statusBox.y + statusBox.height - 844) > 1) throw new Error('Status sheet is not bottom anchored')
  await page.getByText('锁定', { exact: true }).click()
  await page.waitForRequest((req) => req.url().includes('status=2'))
  await page.getByLabel('最近创建', { exact: true }).click()
  await page.getByText('排序方式', { exact: true }).waitFor()
  await page.getByText('最近登录', { exact: true }).click()
  await page.waitForRequest((req) => req.url().includes('sortBy=lastLoginTime'))
  await page.getByLabel('筛选', { exact: true }).click()
  await page.getByText('近7天', { exact: true }).click()
  const before = queries.length
  await page.getByLabel('关闭筛选用户', { exact: true }).click()
  await page.waitForTimeout(400)
  if (queries.length !== before) throw new Error('Cancelled date draft triggered a request')
  await page.getByLabel('筛选', { exact: true }).click()
  await page.getByText('近7天', { exact: true }).click()
  await page.getByText('确定', { exact: true }).click()
  await page.waitForResponse((response) => response.url().includes('startTime='))
  if (!queries.at(-1).endTime || queries.at(-1).status !== '2')
    throw new Error('Combined filters missing: ' + JSON.stringify(queries))
  const alignment = await page.evaluate(() => {
    const row = [...document.querySelectorAll('[class]')].find((el) =>
      el.getAttribute('class').includes('row__tag'),
    )
    const arrow = row.parentElement.querySelector('[class*="row__arrow"]')
    const tagBox = row.getBoundingClientRect()
    const arrowBox = arrow.getBoundingClientRect()
    return Math.abs(tagBox.y + tagBox.height / 2 - arrowBox.y - arrowBox.height / 2)
  })
  if (alignment > 1) throw new Error(`Tag/arrow center mismatch ${alignment}`)
  await page.screenshot({ path: '.playwright-cli/user-filters-preview.png' })
  await page.setViewportSize({ width: 320, height: 740 })
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1))
    throw new Error('320px overflow')
  await page.getByLabel('筛选 · 1', { exact: true }).click()
  await page.getByText('重置', { exact: true }).click()
  await page.getByText('自定义', { exact: true }).click()
  await page.getByText('确定', { exact: true }).click()
  await page.getByText('请选择开始和结束日期', { exact: true }).waitFor()
  await page.screenshot({ path: '.playwright-cli/user-filters-sheet.png' })
  await page.getByText('重置', { exact: true }).click()
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes('sortBy=lastLoginTime') && !response.url().includes('startTime='),
    ),
    page.getByText('确定', { exact: true }).click(),
  ])
  if (queries.at(-1).startTime) throw new Error('Reset dates did not clear the request range')
  return { queries: queries.length, alignment, lastQuery: queries.at(-1) }
}

