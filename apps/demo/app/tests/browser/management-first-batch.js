async (page) => {
  const origin = 'http://127.0.0.1:21003'
  const stamp = { createdAt: '2026-10-01T08:00:00Z', updatedAt: '2026-10-10T08:00:00Z' }
  const position = { id: 101, name: '销售经理', status: '1', sort_order: 10, description: '负责销售团队', ...stamp }
  const department = { id: 201, name: '销售部', parentId: 0, status: '1', sort_order: 1, description: '销售业务部门', leaderName: '王磊', ...stamp }
  const child = { ...department, id: 202, name: '华东销售组', parentId: 201, parentName: '销售部' }
  const dictType = { id: 301, name: '客户等级', type: 'customer_level', status: 1, sort_order: 1, remark: '客户等级选项', ...stamp }
  const dictItem = { id: 401, typeId: 301, type: 'customer_level', label: '重点客户', value: 'important', tag: 'primary', status: 1, isDefault: false, sort_order: 1, remark: '重点跟进', ...stamp }
  const user = { id: 900, username: 'reviewer', realName: '验收用户', phone: '13800138000', status: '1', gender: '0', loginCount: 1, ...stamp }
  const folder = { id: 7, name: '首页素材', kind: 'all', status: '1', sort_order: 0, parentId: 0, children: [] }
  const attachment = { id: 1, name: 'banner.png', originalName: 'b.png', kind: 'image', size: 1024, status: '1', storage: 'local', path: '/u/b.png', ...stamp }
  const permissions = [
    'app:menu:authorized-tree', 'app:contacts:dept-users', 'system:user:list',
    'system:user:create', 'system:attachment:list', 'system:attachment:create', 'system:attachment:delete', 'system:attachment:update', 'system:option:list', 'system:storage:upload-token',
    ...['position', 'department', 'dict'].flatMap((resource) => ['list', 'create', 'update', 'delete'].map((action) => `system:${resource}:${action}`)),
  ]
  const menus = [{ id: 1, name: '系统管理', type: 0, status: '1', moduleId: 'core', children: ['position', 'dept', 'dict', 'user', 'attachments'].map((name, index) => ({ id: index + 10, parentId: 1, name, type: 1, status: '1', moduleId: 'core', page: `pages/system/${name}/index` })) }]
  const writes = []
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.unroute('**/api/**')
  await page.route('**/api/**', async (route) => {
    const path = route.request().url().split('?')[0].replace(/\/$/, '')
    const method = route.request().method()
    let data = []
    if (method !== 'GET') writes.push({ path, method, data: route.request().postDataJSON() })
    if (path.endsWith('/auth/me')) data = user
    else if (path.endsWith('/auth/capabilities')) data = { permissions, enabledModuleIds: [] }
    else if (path.endsWith('/menus/authorized')) data = menus
    else if (path.endsWith('/menus/home')) data = { pinned: [], ranked: [] }
    else if (path.endsWith('/positions/101')) data = position
    else if (path.endsWith('/positions')) data = method === 'GET' ? [position] : position
    else if (path.endsWith('/departments/tree')) data = [{ ...department, children: [child] }]
    else if (path.endsWith('/departments/201')) data = department
    else if (path.endsWith('/departments/202')) data = child
    else if (path.endsWith('/departments')) data = method === 'GET' ? [department, child] : department
    else if (path.endsWith('/users') || /\/contacts\/depts\/\d+\/users$/.test(path)) data = [user]
    else if (path.endsWith('/dicts/types/301')) data = dictType
    else if (path.endsWith('/dicts/types')) data = method === 'GET' ? [dictType] : dictType
    else if (path.endsWith('/dicts/data/401')) data = dictItem
    else if (path.endsWith('/dicts/data')) data = method === 'GET' ? [dictItem] : dictItem
    else if (path.endsWith('/attachments/folders/7')) data = folder
    else if (path.endsWith('/attachments/folders/tree')) data = [folder]
    else if (path.endsWith('/attachments')) data = [attachment]
    else if (path.endsWith('/storage/settings')) data = { provider: 'disabled' }
    await route.fulfill({ json: { success: true, code: 200, data, pagination: { page: 1, pageSize: 20, total: Array.isArray(data) ? data.length : 1, totalPages: 1 } } })
  })
  await page.goto(origin)
  await page.evaluate((value) => {
    localStorage.setItem('yishan:app:accessToken', JSON.stringify({ data: 'fixture-token' }))
    localStorage.setItem('yishan:app:user', JSON.stringify({ data: value }))
  }, user)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${origin}/#/pages/apps/index`)
  await page.reload()
  await page.locator('[aria-label="position"]').waitFor()
  const pages = [
    ['position/index', '销售经理'], ['position/detail/index?id=101', '销售经理'],
    ['position/form/index?id=101', '岗位名称'], ['position/form/index', '岗位名称'],
    ['dept/index', '销售部'], ['dept/detail/index?id=201', '销售部'],
    ['dept/form/index?id=201', '部门名称'], ['dept/form/index?parentId=201', '部门名称'],
    ['dict/index', '客户等级'], ['dict/detail/index?id=301', '客户等级'],
    ['dict/form/index?id=301', '字典名称'],
    ['dict/items/index?typeId=301', '重点客户'], ['dict/items/detail/index?id=401', '重点客户'],
    ['dict/items/form/index?id=401&typeId=301', '字典标签'],
  ]
  for (const [route, text] of pages) {
    await page.goto(`${origin}/#/pages/system/${route}`)
    await page.getByText(text, { exact: true }).filter({ visible: true }).first().waitFor()
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) throw new Error(`Overflow: ${route}`)
    if (await page.locator('[class*=header__title]').count()) throw new Error(`H5 navigation remains: ${route}`)
    if (!(await page.locator('#taro-navigation-bar').isHidden())) throw new Error(`Native H5 navigation remains: ${route}`)
    if (['position/index', 'dept/index', 'dict/index', 'dict/items/index?typeId=301'].includes(route)) {
      const action = page.getByLabel('新建', { exact: true })
      const box = await action.boundingBox()
      if (!box || box.y < 600) throw new Error(`Create action must be at the bottom: ${route}`)
    }
  }
  await page.goto(`${origin}/#/pages/system/position/index`)
  await page.getByText('销售经理', { exact: true }).click()
  await page.getByLabel('编辑', { exact: true }).click()
  await page.getByPlaceholder('请输入岗位名称', { exact: true }).fill('销售主管')
  await Promise.all([
    page.waitForResponse((response) => response.request().method() === 'PUT' && response.url().endsWith('/positions/101')),
    page.getByLabel('保存', { exact: true }).click(),
  ])
  await page.waitForTimeout(400)
  if (writes.at(-1).data.name !== '销售主管') throw new Error('Position edit payload incorrect')
  await page.goto(`${origin}/#/pages/system/dept/form/index?parentId=201`)
  await page.getByPlaceholder('请输入部门名称', { exact: true }).fill('销售支持组')
  await Promise.all([
    page.waitForResponse((response) => response.request().method() === 'POST' && response.url().endsWith('/departments')),
    page.getByLabel('保存', { exact: true }).click(),
  ])
  await page.waitForTimeout(400)
  if (writes.at(-1).data.parentId !== 201) throw new Error('Department parent context lost')
  await page.goto(`${origin}/#/pages/system/dict/items/detail/index?id=401`)
  await page.getByLabel('编辑', { exact: true }).click()
  await page.getByPlaceholder('请输入字典标签', { exact: true }).fill('核心客户')
  await Promise.all([
    page.waitForResponse((response) => response.request().method() === 'PUT' && response.url().endsWith('/dicts/data/401')),
    page.getByLabel('保存', { exact: true }).click(),
  ])
  await page.waitForTimeout(400)
  if (writes.at(-1).data.typeId !== 301 || writes.at(-1).data.label !== '核心客户') throw new Error('Dictionary context/edit payload incorrect')
  await page.setViewportSize({ width: 320, height: 740 })
  for (const [route, text] of pages) {
    await page.goto(`${origin}/#/pages/system/${route}`)
    await page.getByText(text, { exact: true }).filter({ visible: true }).first().waitFor()
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) throw new Error(`320px overflow: ${route}`)
  }
  await page.goto(`${origin}/#/pages/system/position/detail/index?id=101`)
  await page.getByText('岗位名称', { exact: true }).waitFor()
  if (await page.getByText('岗位详情', { exact: true }).filter({ visible: true }).count() !== 0) throw new Error('Position navigation header must be absent')
  await page.screenshot({ path: '.playwright-cli/management-position-detail.png' })
  await page.goto(`${origin}/#/pages/system/dept/detail/index?id=201`)
  await page.getByText('销售部', { exact: true }).first().waitFor()
  await page.screenshot({ path: '.playwright-cli/management-dept-detail.png' })
  await page.goto(`${origin}/#/pages/system/dict/detail/index?id=301`)
  await page.getByText('客户等级', { exact: true }).first().waitFor()
  await page.screenshot({ path: '.playwright-cli/management-dict-detail.png' })
  await page.goto(`${origin}/#/pages/system/user/index`)
  await page.getByLabel('新建', { exact: true }).click()
  await page.getByPlaceholder('请输入用户名', { exact: true }).waitFor()
  if (await page.locator('[class*=header__title]').count()) throw new Error('User form header remains')

  await page.goto(`${origin}/#/pages/system/attachments/index`)
  await page.getByText('banner.png', { exact: true }).waitFor()
  const manage = page.getByLabel('管理', { exact: true })
  const manageBox = await manage.boundingBox()
  if (!manageBox || manageBox.y < 600) throw new Error('Media actions must be at the bottom')
  await manage.click()
  await page.getByLabel('删除', { exact: true }).waitFor()
  if (await page.getByLabel('上传', { exact: true }).count()) throw new Error('Media footer must not overlap selection actions')
  await page.getByLabel('取消', { exact: true }).click()
  await page.getByLabel('上传', { exact: true }).waitFor()

  await page.goto(`${origin}/#/pages/system/attachments/folder-form/index?id=7`)
  await page.getByLabel('保存', { exact: true }).waitFor()
  const more = page.getByLabel('更多', { exact: true })
  const footer = more.locator('..')
  if (!(await footer.getByLabel('保存', { exact: true }).count())) throw new Error('Folder more/save must share one footer')
  await page.evaluate(() => document.documentElement.style.setProperty('--safe-area-bottom', '34px'))
  const saveBox = await page.getByLabel('保存', { exact: true }).boundingBox()
  if (!saveBox || saveBox.y + saveBox.height > 740 - 34) throw new Error('Save must avoid the bottom safe area')
  await page.evaluate(() => document.documentElement.style.removeProperty('--safe-area-bottom'))
  await more.click()
  await page.getByLabel('删除分组', { exact: true }).waitFor()
  await page.getByLabel('取消', { exact: true }).click()

  for (const route of ['pages/index/index', 'pages/mine/index', 'pages/messages/index', 'pages/security/index', 'pages/about/index', 'pages/profile/edit/index', 'pages/profile/password/index', 'pages/profile/login-log/index', 'pages/profile/login-log/detail/index?id=1']) {
    await page.goto(`${origin}/#/${route}`)
    await page.waitForLoadState('networkidle')
    if (!(await page.locator('#taro-navigation-bar').isHidden())) throw new Error(`Native H5 navigation remains: ${route}`)
    if (await page.locator('[class*=header__title], [class*=home__topBar]').count()) throw new Error(`Custom H5 navigation remains: ${route}`)
    if (route === 'pages/index/index') {
      if (await page.getByText('数据概览', { exact: true }).count()) throw new Error('Home metrics heading remains')
      if (await page.locator('[class*=home__refresh]').count()) throw new Error('Home refresh icon remains')
      await page.getByText('消息中心', { exact: true }).click()
      await page.waitForURL('**/#/pages/messages/index')
    }
  }
  if (errors.length) throw new Error(errors.join('\n'))
  return { visited: pages.length + 13, writes: writes.length, errors }
}
