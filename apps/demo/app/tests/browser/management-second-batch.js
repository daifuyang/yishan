async (page) => {
  const origin = 'http://127.0.0.1:21813'
  const stamp = { createdAt: '2026-10-11T08:00:00Z', updatedAt: '2026-10-11T08:00:00Z' }
  const user = { id: 900, username: 'reviewer', realName: '验收用户', nickname: '测试昵称', email: 'reviewer@example.com', phone: '13800138000', gender: '1', genderName: '男', birthDate: '1990-01-01', status: '1', loginCount: 1, ...stamp }
  const log = { id: 501, userId: 900, username: 'reviewer', realName: '验收用户', status: '1', message: '登录成功', ipAddress: '127.0.0.1', userAgent: 'Browser QA / Windows', ...stamp }
  const managed = { id: 'demo', name: '示例模块', version: '1.0.0', enabled: true, mounted: true, routePrefix: '/api/v1/demo', tablePrefix: 'demo_' }
  const counties = Array.from({ length: 121 }, (_, index) => ({ code: 310100 + index, name: `测试县${index + 1}`, level: 3, parentCode: 3101, sortOrder: index, children: [] }))
  const regions = [{ code: 31, name: '上海市', level: 1, parentCode: 0, sortOrder: 1, children: [{ code: 3101, name: '市辖区', level: 2, parentCode: 31, sortOrder: 1, children: counties }] }]
  const permissions = ['system:login-log:list', 'region:tree', 'system:module-management:list', 'system:module-management:toggle', 'app:menu:authorized-tree']
  const menus = [{ id: 1, name: '系统管理', type: 0, status: '1', moduleId: 'core', children: ['login-log', 'region', 'module-management'].map((name, index) => ({ id: index + 10, parentId: 1, name, type: 1, status: '1', moduleId: 'core', page: `pages/system/${name}/index` })) }]
  const writes = []
  const queries = []
  const errors = []
  let failPassword = true
  page.on('pageerror', (error) => errors.push(error.message))
  await page.unroute('**/api/**')
  await page.route('**/api/**', async (route) => {
    const rawUrl = route.request().url()
    const path = rawUrl.split('?')[0].replace(/\/$/, '')
    const method = route.request().method()
    const body = method === 'GET' ? null : route.request().postDataJSON()
    if (method !== 'GET') writes.push({ path, method, body })
    else queries.push(rawUrl)
    let data = []
    if (path.endsWith('/auth/me')) data = user
    else if (path.endsWith('/auth/capabilities')) data = { permissions, enabledModuleIds: managed.enabled ? ['demo'] : [] }
    else if (path.endsWith('/menus/authorized')) data = menus
    else if (path.endsWith('/system/login-logs/501')) data = log
    else if (path.endsWith('/system/login-logs')) data = [log]
    else if (path.endsWith('/users/me/login-logs')) data = [log]
    else if (path.endsWith('/system/regions/tree')) data = regions
    else if (path.endsWith('/module-management/list')) data = { items: [managed] }
    else if (path.endsWith('/toggle/demo/toggle')) { managed.enabled = body.enabled; data = { id: 'demo', enabled: managed.enabled } }
    else if (path.endsWith('/users/me/password')) {
      if (failPassword) {
        await route.fulfill({ status: 400, json: { success: false, code: 400, message: '当前密码错误' } })
        return
      }
      data = null
    } else if (path.endsWith('/users/me') && method === 'PUT') { Object.assign(user, body); data = body }
    else if (path.endsWith('/auth/logout')) data = null
    await route.fulfill({ json: { success: true, code: 200, data, pagination: { page: 1, pageSize: 20, total: Array.isArray(data) ? data.length : 1, totalPages: 1 } } })
  })
  await page.goto(origin)
  await page.evaluate((value) => {
    localStorage.setItem('yishan:app:accessToken', JSON.stringify({ data: 'fixture-token' }))
    localStorage.setItem('yishan:app:refreshToken', JSON.stringify({ data: 'fixture-refresh' }))
    localStorage.setItem('yishan:app:user', JSON.stringify({ data: value }))
  }, user)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${origin}/#/pages/apps/index`)
  await page.reload()
  await page.locator('[aria-label="login-log"]').waitFor()
  const pages = [
    ['system/login-log/index', '登录日志'], ['system/login-log/detail/index?id=501', '登录详情'],
    ['profile/login-log/index', '登录记录'], ['system/region/index', '地区管理'],
    ['system/module-management/index', '模块管理'], ['system/module-management/detail/index?id=demo', '示例模块'],
    ['profile/edit/index', '真实姓名'], ['profile/password/index', '当前密码'],
  ]
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 })
    for (const [route, text] of pages) {
      await page.goto(`${origin}/#/pages/${route}`)
      await page.getByText(text, { exact: true }).filter({ visible: true }).first().waitFor()
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) throw new Error(`Overflow ${width}: ${route}`)
      if (width === 390) await page.screenshot({ path: `.playwright-cli/second-${route.split('/').slice(0, 2).join('-')}.png` })
    }
  }
  if (errors.length) throw new Error(errors.join('\n'))
  return { pages: pages.length, queries: queries.length, writes, errors }
}
