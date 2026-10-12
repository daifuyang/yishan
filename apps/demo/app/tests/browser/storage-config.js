// Run against the built H5 at localhost:21823 with playwright-cli run-code --filename=...
async (page) => {
  const origin = 'http://127.0.0.1:21823'
  const user = { id: 900, username: 'reviewer', realName: '验收用户', status: '1', loginCount: 1, createdAt: '2026-10-12', updatedAt: '2026-10-12' }
  const permissions = ['system:storage:list', 'system:storage:update', 'app:menu:authorized-tree']
  const menus = [{ id: 1, name: '系统管理', type: 0, status: '1', moduleId: 'core', children: [{ id: 10, parentId: 1, name: '云存储', type: 1, status: '1', moduleId: 'core', page: 'pages/system/storage/index' }] }]
  let stored = { provider: 'qiniu', qiniu: { provider: 'qiniu', accessKey: 'ak-visible', bucket: 'media', region: 'z1', domain: 'https://cdn.example.com', useHttps: true, useCdnDomains: true, tokenExpires: 3600 }, aliyunOss: {} }
  const writes = []
  const probes = []
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
    else if (path.endsWith('/system/storage/config') && method === 'GET') data = stored
    else if (path.endsWith('/system/storage/config') && method === 'PUT') {
      const body = route.request().postDataJSON()
      writes.push(body)
      stored = { ...stored, provider: body.provider, qiniu: { ...stored.qiniu, ...body.qiniu } }
      data = stored
    } else if (path.endsWith('/system/storage/test')) {
      const body = route.request().postDataJSON()
      probes.push(body)
      data = body.qiniu.bucket === 'media'
        ? { ok: true, provider: 'qiniu', bucket: 'media', latencyMs: 120 }
        : { ok: false, provider: 'qiniu', bucket: body.qiniu.bucket, latencyMs: 230, message: `空间 ${body.qiniu.bucket} 不存在` }
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
  await page.getByText('云存储').first().waitFor()
  await page.goto(`${origin}/#/pages/system/storage/index`)
  await page.getByText('当前存储', { exact: true }).waitFor()
  // H5 页面切换带滑入动画，等动画结束再截图
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'tmp/storage-overview.png' })

  await page.getByText('基础配置', { exact: true }).click()
  await page.getByLabel('测试连接').waitFor()
  const accessKey = page.locator('input[placeholder="请输入 AccessKey"]')
  if ((await accessKey.getAttribute('type')) !== 'password') throw new Error('AccessKey should be masked by default')
  await page.getByLabel('显示AccessKey').click()
  if ((await accessKey.getAttribute('type')) === 'password') throw new Error('AccessKey toggle did not reveal the value')
  await page.getByLabel('测试连接').click()
  await page.getByText('连接成功').waitFor()
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'tmp/storage-basic-ok.png' })
  if (probes[0].qiniu.secretKey !== undefined) throw new Error('blank secret must not be sent')

  await page.locator('input[placeholder="存储空间名称"]').fill('missing')
  if (await page.getByText('连接成功').count()) throw new Error('stale test result should be cleared after editing')
  await page.getByLabel('测试连接').click()
  await page.getByText('连接失败').waitFor()
  await page.getByText('空间 missing 不存在').waitFor()
  await page.screenshot({ path: 'tmp/storage-basic-fail.png' })
  await page.locator('input[placeholder="存储空间名称"]').fill('media')
  await page.getByLabel('保存配置').click()
  await page.getByText('当前存储', { exact: true }).waitFor()
  if (writes.length !== 1 || Object.keys(writes[0].qiniu).sort().join() !== 'accessKey,bucket,region')
    throw new Error(`basic save payload: ${JSON.stringify(writes)}`)

  await page.getByText('访问配置', { exact: true }).click()
  await page.getByText('访问方式', { exact: true }).waitFor()
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'tmp/storage-access.png' })
  await page.goBack()
  await page.getByText('上传设置', { exact: true }).click()
  await page.getByText('上传凭证', { exact: true }).waitFor()
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'tmp/storage-upload.png' })
  if (errors.length) throw new Error(errors.join('\n'))
  return { writes: writes.length, probes: probes.length, ok: true }
}
