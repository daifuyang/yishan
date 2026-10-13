const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const { loadTs, appRoot } = require('./helpers/load-ts.cjs')

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

const loginPage = () => fs.readFileSync(path.join(appRoot, 'src/pages/login/index.tsx'), 'utf8')
const loginScss = () => fs.readFileSync(path.join(appRoot, 'src/pages/login/index.module.scss'), 'utf8')

test('登录页记住账号与失败信息复用共享 Checkbox / FormError', () => {
  const page = loginPage()
  const shared = page.match(/import \{([^}]*)\} from '@\/components\/management'/)
  assert.ok(shared, '登录页应从 @/components/management 引入共享原子')
  assert.match(shared[1], /\bCheckbox\b/, '记住账号复用共享 Checkbox')
  assert.match(shared[1], /\bFormError\b/, '失败信息复用共享 FormError')
  assert.match(page, /<Checkbox\b/, '记住账号渲染共享 Checkbox')
  assert.match(page, /<FormError>/, '失败信息渲染在表单边界')
  assert.doesNotMatch(page, /remember__box/, '不再自绘勾选框')
  assert.doesNotMatch(page, /styles\.form__error/, '不再自绘错误行')
})

test('登录页禁用态不画灰底块，标签与取值一起弱化', () => {
  const scss = loginScss()
  assert.doesNotMatch(scss, /\.field__box--disabled[^}]*background/, '禁用行不加灰底块')
  assert.match(scss, /\.field--disabled\b/, '禁用时标签与取值一起降到三级灰')
})

test('登录页颜色与字号走 token，保留 label 堆叠与 16px 输入字号的登记例外', () => {
  const scss = loginScss()
  assert.doesNotMatch(scss, /#[0-9a-fA-F]{3,8}\b/, '不再写死颜色')
  assert.match(scss, /\.field \{[\s\S]*?flex-direction: column/, 'label 上下堆叠是登记例外')
  assert.match(scss, /\.field__input \{[\s\S]*?font-size: var\(--font-size-16\)/, '输入框 16px 防 iOS 缩放')
})
