// Run against the built H5 at localhost:21823 with playwright-cli run-code --filename=...
async (page) => {
  const origin = 'http://127.0.0.1:21823'
  const user = { id: 900, username: 'reviewer', realName: '验收用户', status: '1', loginCount: 1, createdAt: '2026-10-11', updatedAt: '2026-10-11' }
  const permissions = ['system:option:list', 'system:option:update', 'app:menu:authorized-tree']
  const menus = [{ id: 1, name: '系统管理', type: 0, status: '1', moduleId: 'core', children: [{ id: 10, parentId: 1, name: '站点配置', type: 1, status: '1', moduleId: 'core', page: 'pages/system/site/index' }] }]
  let stored = { siteName: '企业官网', siteDomain: 'https://example.com/', siteTitle: '企业数字化服务平台', seoKeywords: 'CRM,ERP', seoDescription: '一站式企业管理与数字化解决方案。', icp: '沪ICP备1号' }
  const writes = []
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.unroute('**/api/**')
  await page.route('**/api/**', async (route) => {
    const path = route.request().url().split('?')[0].replace(/\/$/, '')
    const method = route.request().method()
    let data = []
    if (path.endsWith('/auth/me')) data = user
    else if (path.endsWith('/auth/capabilities')) data = { permissions, enabledModuleIds: [] }
    else if (path.endsWith('/menus/authorized')) data = menus
    else if (path.endsWith('/system/options/basicConfig')) data = JSON.stringify(stored)
    else if (path.endsWith('/system/options/batch') && method === 'POST') {
      const body = route.request().postDataJSON()
      writes.push(body)
      stored = JSON.parse(body[0].value)
      data = { updatedCount: 1, results: [{ key: 'basicConfig', success: true }] }
    }
    await route.fulfill({ json: { success: true, code: 200, data } })
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
  await page.getByText('站点配置').first().waitFor()
  await page.goto(`${origin}/#/pages/system/site/index`)
  await page.getByText('配置分类').waitFor()
  await page.getByText('example.com').first().waitFor()
  // H5 页面切换带滑入动画，等动画结束再截图
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'tmp/site-overview.png' })

  await page.getByText('SEO 优化').click()
  await page.getByText('搜索预览').waitFor()
  const keyword = page.locator('input[placeholder="继续添加"]')
  await keyword.fill('官网')
  await keyword.press('Enter')
  await page.getByText('官网', { exact: true }).waitFor()
  // H5 页面切换带滑入动画，等动画结束再截图
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'tmp/site-seo.png' })
  await page.getByLabel('保存').click()
  await page.getByText('配置分类').waitFor()
  if (writes.length !== 1) throw new Error(`expected one write, got ${writes.length}`)
  const seo = JSON.parse(writes[0][0].value)
  if (seo.seoKeywords !== 'CRM,ERP,官网' || seo.icp !== '沪ICP备1号' || seo.siteName !== '企业官网')
    throw new Error(`seo save lost fields: ${writes[0][0].value}`)

  await page.getByText('基础信息').click()
  await page.locator('input[placeholder="请输入站点名称"]').waitFor()
  // H5 页面切换带滑入动画，等动画结束再截图
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'tmp/site-basic.png' })
  await page.locator('input[placeholder="请输入站点名称"]').fill('新官网')
  await page.getByLabel('保存').click()
  await page.getByText('新官网').first().waitFor()
  const basic = JSON.parse(writes[1][0].value)
  if (basic.siteName !== '新官网' || basic.seoKeywords !== 'CRM,ERP,官网') throw new Error(`basic save lost fields: ${writes[1][0].value}`)

  await page.getByText('备案与页脚').click()
  await page.getByText('备案信息', { exact: true }).waitFor()
  // H5 页面切换带滑入动画，等动画结束再截图
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'tmp/site-filing.png' })
  if (errors.length) throw new Error(errors.join('\n'))
  return { writes: writes.length, ok: true }
}
