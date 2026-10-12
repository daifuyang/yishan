// Run against the built H5 at localhost:21803 with playwright-cli run-code --filename=...
async (page) => {
  const origin = 'http://127.0.0.1:21803'
  const errors = []
  const requests = []
  page.on('pageerror', (error) => errors.push(error.message))
  const entries = [
    ['用户管理', 'system/user', 'system:user:list'], ['部门管理', 'system/dept', 'system:department:list'],
    ['角色管理', 'system/role', 'system:role:list'], ['岗位管理', 'system/position', 'system:position:list'],
    ['菜单管理', 'system/menu', 'system:menu:list'], ['工作台管理', 'system/app-menu', 'system:app-menu:list'],
    ['字典管理', 'system/dict', 'system:dict:list'], ['地区管理', 'system/region', 'region:tree'],
    ['站点配置', 'system/site', 'system:option:list'], ['云存储', 'system/storage', 'system:storage:list'],
    ['媒体库', 'system/attachments', 'system:attachment:list'], ['登录日志', 'system/login-log', 'system:login-log:list'],
    ['模块管理', 'system/module-management', 'system:module-management:list'],
    ['快速入门', 'demo/quickstart', 'demo:quickstart:read'], ['健康检查', 'demo/health', 'demo:health:read'],
    ['Todo 示例', 'demo/todos', 'demo:todos:list'], ['省市级联', 'demo/region', 'region:list'],
  ]
  let permissions = [...entries.map((entry) => entry[2]), 'app:menu:authorized-tree', 'demo:todos:create', 'demo:todos:update', 'demo:todos:delete', 'region:path']
  const menus = [{ id: 1, name: '基础功能', type: 0, status: '1', moduleId: 'core', sortOrder: 1, children: entries.map(([name, route], index) => ({ id: index + 10, parentId: 1, name, type: 1, status: '1', moduleId: route.startsWith('demo/') ? 'demo' : 'core', page: `pages/${route}/index`, sortOrder: index })) }]
  const user = { id: 900, username: 'mobile-fixture', realName: '验收用户', phone: '13800138000', gender: '0', status: '1', loginCount: 1, createdAt: '2026-10-10', updatedAt: '2026-10-10' }
  const todos = []
  let failSave = false
  let nextId = 1
  await page.unroute('**/api/**')
  await page.route('**/api/**', async (route) => {
    const path = route.request().url().replace(/^https?:\/\/[^/]+/, '').split('?')[0].replace(/\/$/, '')
    const method = route.request().method()
    requests.push({ path, method })
    let data = []
    if (path.endsWith('/auth/me')) data = user
    else if (path.endsWith('/auth/capabilities')) data = { permissions, enabledModuleIds: ['demo', 'portal', 'shop'] }
    else if (path.endsWith('/menus/authorized')) data = menus
    else if (path === '/api/demo/v1/todos') {
      if (method === 'POST') {
        if (failSave) { await route.fulfill({ status: 500, json: { success: false, code: 500, message: '保存测试失败' } }); return }
        const input = route.request().postDataJSON()
        data = { ...input, id: nextId++, dueAt: input.dueAt ?? null, createdAt: '2026-10-10T00:00:00Z', updatedAt: '2026-10-10T00:00:00Z' }
        todos.push(data)
      } else {
        // run-code 沙箱没有全局 URL，手动解析查询串
        const query = Object.fromEntries((route.request().url().split('?')[1] || '').split('&').filter(Boolean).map((pair) => pair.split('=').map(decodeURIComponent)))
        const keyword = (query.keyword || '').trim()
        const status = query.status ?? null
        const page = Number(query.page || 1)
        const pageSize = Number(query.pageSize || 20)
        const matched = todos.filter((todo) => (!keyword || `${todo.title} ${todo.description || ''}`.includes(keyword)) && (status === null || String(todo.status) === status))
        data = { items: matched.slice((page - 1) * pageSize, page * pageSize), total: matched.length }
      }
      await route.fulfill({ json: data }); return
    } else if (/^\/api\/demo\/v1\/todos\/\d+$/.test(path)) {
      const id = Number(path.split('/').pop())
      const item = todos.find((todo) => todo.id === id)
      if (method === 'PATCH') Object.assign(item, route.request().postDataJSON())
      if (method === 'DELETE') { todos.splice(todos.findIndex((todo) => todo.id === id), 1); await route.fulfill({ status: 204 }); return }
      await route.fulfill({ json: item }); return
    } else if (path === '/api/demo/v1/info') {
      await route.fulfill({ json: { module: 'demo', env: 'test', nodeVersion: 'v22', hostname: 'fixture', platform: 'win32', arch: 'x64', cpus: 4, memory: { total: 8589934592, free: 4294967296 }, uptimeSeconds: 3600, pid: 100, timestamp: '2026-10-10T00:00:00Z' } }); return
    } else if (path.endsWith('/system/options/basicConfig')) data = JSON.stringify({ siteName: '验收站点' })
    else if (path.endsWith('/system/storage/config')) data = { provider: 'disabled', qiniu: {}, aliyunOss: {} }
    else if (path.includes('/module-management/list')) data = { items: [] }
    else if (path.endsWith('/app-menus/tree')) data = menus
    else if (path.endsWith('/system/regions') || path.endsWith('/system/regions/tree')) data = [{ code: 11, name: '北京市', level: 1, parentCode: 0, sortOrder: 1, children: [] }]
    await route.fulfill({ json: { success: true, code: 200, message: 'OK', data, timestamp: '2026-10-10', pagination: { page: 1, pageSize: 20, total: Array.isArray(data) ? data.length : 0, totalPages: 1 } } })
  })
  await page.goto(origin)
  await page.evaluate((currentUser) => {
    localStorage.setItem('yishan:app:accessToken', JSON.stringify({ data: 'fixture-token' }))
    localStorage.setItem('yishan:app:refreshToken', JSON.stringify({ data: 'fixture-refresh' }))
    localStorage.setItem('yishan:app:user', JSON.stringify({ data: currentUser }))
  }, user)
  await page.goto(`${origin}/#/pages/apps/index`)
  await page.reload()
  await page.locator('[aria-label="Todo 示例"]').waitFor()
  await page.setViewportSize({ width: 320, height: 740 })
  const passed = []
  for (const [name, route] of entries) {
    await page.goto(`${origin}/#/pages/${route}/index`)
    await page.getByText(name, { exact: true }).filter({ visible: true }).first().waitFor()
    await page.waitForLoadState('networkidle')
    if (await page.getByText('移动端功能正在建设中，敬请期待。', { exact: true }).filter({ visible: true }).count()) throw new Error(`${name} remains placeholder`)
    const fits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
    if (!fits) throw new Error(`${name} overflows 320px viewport`)
    passed.push(name)
  }
  await page.goto(`${origin}/#/pages/demo/todos/index`)
  await page.getByText('新建', { exact: true }).filter({ visible: true }).click()
  await page.getByText('新建 Todo', { exact: true }).filter({ visible: true }).waitFor()
  const inputs = page.locator('input:visible')
  await inputs.first().fill('移动验收 Todo')
  failSave = true
  await page.getByText('保存', { exact: true }).filter({ visible: true }).click()
  await page.getByText('保存测试失败', { exact: true }).filter({ visible: true }).waitFor()
  if (await inputs.first().inputValue() !== '移动验收 Todo') throw new Error('failed create lost input')
  failSave = false
  await page.getByText('保存', { exact: true }).filter({ visible: true }).click()
  // 保存后回到列表，列表在 didShow 时刷新
  await page.getByText('移动验收 Todo', { exact: true }).filter({ visible: true }).click()
  await page.getByText('Todo 详情', { exact: true }).filter({ visible: true }).waitFor()
  await page.getByText('基本信息', { exact: true }).filter({ visible: true }).waitFor()
  await page.getByText('编辑', { exact: true }).filter({ visible: true }).click()
  await page.getByText('编辑 Todo', { exact: true }).filter({ visible: true }).waitFor()
  await page.locator('input:visible').first().fill('移动验收已修改')
  await page.getByText('保存', { exact: true }).filter({ visible: true }).click()
  // 回到详情，详情在 didShow 时重新拉取
  await page.getByText('移动验收已修改', { exact: true }).filter({ visible: true }).first().waitFor()
  await page.getByText('更多', { exact: true }).filter({ visible: true }).click()
  await page.getByText('删除 Todo', { exact: true }).filter({ visible: true }).click()
  await page.locator('.taro-model__confirm').filter({ visible: true }).click()
  await page.getByText('暂无 Todo', { exact: true }).filter({ visible: true }).waitFor()
  passed.push('Todo list / form failure retention / detail / edit / 204 delete')
  await page.goto(`${origin}/#/pages/demo/region/index`)
  await page.getByText('请选择', { exact: true }).filter({ visible: true }).first().click()
  await page.getByText('北京市', { exact: true }).filter({ visible: true }).click()
  await page.getByText('北京市', { exact: true }).filter({ visible: true }).first().waitFor()
  passed.push('Region picker selects a leaf region')
  permissions = ['app:menu:authorized-tree']
  const before = requests.filter((request) => request.path === '/api/demo/v1/todos').length
  await page.goto(`${origin}/#/pages/apps/index`)
  // 工作台已无刷新按钮，重载页面以重新拉取权限
  await page.reload()
  await page.getByText('暂无可用应用', { exact: true }).filter({ visible: true }).waitFor()
  await page.goto(`${origin}/#/pages/demo/todos/index`)
  await page.getByText('无权访问', { exact: true }).filter({ visible: true }).waitFor()
  if (requests.filter((request) => request.path === '/api/demo/v1/todos').length !== before) throw new Error('revoked permission fetched todos')
  if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`)
  return { passed, apiFixtures: true, viewport: '320x740', runtimeErrors: errors.length }
}
