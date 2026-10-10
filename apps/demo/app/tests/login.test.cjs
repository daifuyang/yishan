const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTs } = require('./helpers/load-ts.cjs')

function setup(initial = {}) {
  const values = new Map(Object.entries(initial))
  const taro = {
    getStorageSync: (key) => values.get(key),
    setStorageSync: (key, value) => values.set(key, value),
    removeStorageSync: (key) => values.delete(key),
    clearStorageSync: () => values.clear(),
  }
  const types = loadTs('src/api/types.ts')
  // 共用同一份 api/types，保证 instanceof 与运行时一致
  const form = loadTs('src/pages/login/login-form.ts', { '@tarojs/taro': taro, '@/api/types': types })
  return { form, types, values }
}

test('login button is enabled only when both account and password are present', () => {
  const { form } = setup()
  assert.equal(form.canSubmit('', ''), false)
  assert.equal(form.canSubmit('   ', 'secret1'), false)
  assert.equal(form.canSubmit('admin', ''), false)
  assert.equal(form.canSubmit('admin', ' '), true)
})

test('local validation keeps legal spaces and mirrors the backend password length', () => {
  const { form } = setup()
  assert.equal(form.validateLoginForm('', 'secret1'), '请输入账号')
  assert.equal(form.validateLoginForm('admin', ''), '请输入密码')
  assert.equal(form.validateLoginForm('admin', '12345'), '密码至少 6 位')
  assert.equal(form.validateLoginForm('admin', ' pass word '), null)
})

test('login errors map backend codes to user-facing copy without leaking raw messages', () => {
  const { form, types } = setup()
  const api = (code, message = 'raw stack: Error at x', status = 400) =>
    new types.ApiError(code, message, status)
  assert.equal(form.describeLoginError(api(22007, '用户名或密码错误', 401)), '账号或密码错误')
  assert.equal(form.describeLoginError(api(30003)), '账号已被禁用，请联系管理员')
  assert.equal(form.describeLoginError(api(22008)), '账号已被锁定，请联系管理员')
  assert.equal(
    form.describeLoginError(api(21008, '登录失败次数过多，请 15 分钟后再试', 429)),
    '登录失败次数过多，请 15 分钟后再试',
  )
  assert.equal(form.describeLoginError(api(-1, 'x', 0)), '网络连接异常，请检查网络后重试')
  assert.equal(form.describeLoginError(api(10001, 'Internal', 500)), '服务暂时不可用，请稍后重试')
  assert.equal(form.describeLoginError(api(99999)), '登录失败，请稍后重试')
  assert.equal(form.describeLoginError(new Error('TypeError: boom')), '登录失败，请稍后重试')
  assert.equal(form.describeLoginError(new types.RequestCancelledError()), null)
})

test('remember account stores only the trimmed account and can be cleared', () => {
  const { form, values } = setup()
  assert.equal(form.readRememberedAccount(), '')
  form.saveRememberedAccount('  admin  ')
  assert.equal(values.get(form.REMEMBERED_ACCOUNT_KEY), 'admin')
  assert.equal(form.readRememberedAccount(), 'admin')
  assert.ok([...values.values()].every((value) => !String(value).includes('secret')))
  form.clearRememberedAccount()
  assert.equal(values.has(form.REMEMBERED_ACCOUNT_KEY), false)
})

test('remembered account ignores corrupted storage values', () => {
  const { form } = setup({ 'yishan:app:login:rememberedAccount': { password: 'x' } })
  assert.equal(form.readRememberedAccount(), '')
})
