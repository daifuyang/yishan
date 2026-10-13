// Run against built H5 at localhost:21824 with playwright-cli --mobile run-code --filename=...
async (page) => {
  const origin = 'http://127.0.0.1:21824'
  const check = (ok, message) => { if (!ok) throw new Error(message) }
  const permissions = ['app:menu:authorized-tree', 'system:dashboard:read',
    'system:user:list', 'system:department:list', 'system:role:list',
    'system:position:list', 'system:menu:list', 'system:app-menu:list',
    'system:option:list', 'system:storage:list', 'system:attachment:list', 'system:login-log:list']
  const menus = [{ id: 1, name: '系统管理', type: 0, status: '1', moduleId: 'core', children:
    ['user', 'dept', 'role', 'position', 'menu', 'app-menu', 'site', 'storage', 'attachments', 'login-log']
      .map((name, i) => ({ id: i + 10, parentId: 1, name: `测试应用${i + 1}`, type: 1,
        status: '1', moduleId: 'core', page: `pages/system/${name}/index` })) }]
  const errors = []
  let refreshRequests = 0
  page.on('pageerror', error => errors.push(error.message))
  await page.unroute('**/api/**')
  await page.route('**/api/**', async route => {
    const path = route.request().url().split('?')[0].replace(/^https?:\/\/[^/]+/, '')
    let data = []
    if (path.endsWith('/auth/me')) data = { id: 900, username: 'scroll-test', realName: '滚动测试', status: '1' }
    else if (path.endsWith('/auth/capabilities')) data = { permissions, enabledModuleIds: [] }
    else if (path.endsWith('/menus/authorized')) { data = menus; refreshRequests++ }
    else if (path.endsWith('/menus/home')) data = { pinned: [], ranked: [] }
    else if (path.endsWith('/dashboard/stats')) data = { userTotal: 20, deptTotal: 5, todayLogin: 10, online: 3 }
    await route.fulfill({ json: { success: true, code: 200, data } })
  })
  await page.addInitScript(() => {
    localStorage.setItem('yishan:app:accessToken', JSON.stringify({ data: 'scroll-test-only' }))
  })
  await page.setViewportSize({ width: 390, height: 360 })
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setUserAgentOverride', {
    userAgent: `${await page.evaluate(() => navigator.userAgent)} MicroMessenger/8.0`,
  })
  const swipe = async (from, to) => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 180, y: from }] })
    for (let step = 1; step <= 12; step++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 180, y: from + (to - from) * step / 12 }] })
      await page.waitForTimeout(25)
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  }
  const results = []
  for (const route of ['index', 'apps']) {
    if (route === 'index') {
      await page.goto(`${origin}/#/pages/index/index`)
      await page.reload()
    } else {
      await page.locator('.weui-tabbar__label', { hasText: '工作台' }).click()
    }
    await page.getByText(route === 'index' ? '组织成员' : '系统管理', { exact: true }).waitFor()
    const active = page.locator('.taro_page:visible').last()
    await active.locator('.rmc-pull-to-refresh-content').waitFor()
    await page.waitForTimeout(400)
    const range = await active.evaluate(el => el.scrollHeight - el.clientHeight)
    check(range > 40, `${route}: fixture must exceed the viewport (range=${range})`)
    await active.evaluate(el => { el.scrollTop = 0 })
    await swipe(280, 80)
    await page.waitForFunction(() => [...document.querySelectorAll('.taro_page')]
      .some(el => el.getBoundingClientRect().width > 0 && el.scrollTop > 20))
    const before = await active.evaluate(el => el.scrollTop)
    const requestsBeforeReturn = refreshRequests
    // Cancelable TouchEvents prove whether the refresh handler steals the return gesture.
    const intercepted = await active.evaluate(el => {
      const target = el.querySelector('.rmc-pull-to-refresh-content')
      const touch = y => new Touch({ identifier: 1, target, clientX: 180, clientY: y, screenX: 180, screenY: y })
      const emit = (type, y) => {
        const touches = type === 'touchend' ? [] : [touch(y)]
        const event = new TouchEvent(type, { bubbles: true, cancelable: true, touches, changedTouches: [touch(y)] })
        target.dispatchEvent(event)
        return event.defaultPrevented
      }
      emit('touchstart', 100)
      const prevented = emit('touchmove', 140)
      emit('touchend', 140)
      return prevented
    })
    check(!intercepted, `${route}: return-to-top gesture was intercepted while scrollTop=${before}`)
    await swipe(80, 280)
    await page.waitForFunction(value => {
      const el = [...document.querySelectorAll('.taro_page')].find(el => el.getBoundingClientRect().width > 0)
      return el && el.scrollTop < value - 15
    }, before)
    check(refreshRequests === requestsBeforeReturn, `${route}: scrolling back must not refresh`)
    await active.evaluate(el => { el.scrollTop = 0 })
    const requestsBeforePull = refreshRequests
    await swipe(80, 280)
    await page.waitForFunction(() => !document.querySelector('.rmc-pull-to-refresh-indicator'))
    check(refreshRequests > requestsBeforePull, `${route}: pull at top must still refresh`)
    await page.waitForFunction(() => [...document.querySelectorAll('.rmc-pull-to-refresh-content')]
      .every(el => !el.style.transform))
    results.push({ page: route, range, scrollDown: before, scrollReturn: 'allowed', pullRefresh: 'passed' })
  }
  check(errors.length === 0, `Browser errors: ${errors.join('; ')}`)
  await cdp.detach()
  return results
}
