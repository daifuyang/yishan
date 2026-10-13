const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTs, deferred } = require('./helpers/load-ts.cjs')

function harness(page, inputs = []) {
  let stateIndex = 0
  let version = 0
  let current = { token: 'token', user: { id: 1, nickname: '原昵称' } }
  const pending = deferred()
  const updates = []
  const toasts = []
  const actions = []
  const store = (selector) =>
    selector({
      ...current,
      setUser: (data) => updates.push(data),
      refreshMe: async () => actions.push('refresh'),
      logout: async () => {
        actions.push('logout')
        version++
        current = { token: null, user: null }
      },
    })
  store.getState = () => current
  const component = loadTs(`src/pages/profile/${page}/index.tsx`, {
    react: {
      useRef: (value) => ({ current: value }),
      useEffect: (effect) => effect(),
      useState: (value) => [inputs[stateIndex++] ?? value, () => {}],
    },
    '@tarojs/components': { View: 'View', Text: 'Text', Input: 'Input', Picker: 'Picker' },
    '@tarojs/taro': {
      showToast: (options) => toasts.push(options),
      getEnv: () => 'WEB',
      ENV_TYPE: { WEB: 'WEB' },
    },
    '@/stores/auth': { useAuthStore: store },
    '@/api/client': { getSessionVersion: () => version },
    '@/api': {
      userApi: { updateMe: () => pending.promise, changeMyPassword: () => pending.promise },
      dictApi: { getDictByType: async () => [] },
      ApiError: Error,
    },
    '@/utils/auth-guard': { useRequireAuth: () => ({ ready: true, allowed: true }) },
    '@/components/atoms': { Button: 'Button' },
    '@/components/icons': { LineIcon: 'LineIcon' },
    '@/components/layout': { PageContainer: 'PageContainer' },
    '@/components/management': Object.fromEntries(
      [
        'ManagementPage',
        'ManagementPageHeader',
        'FormContent',
        'FormSection',
        'FormField',
        'EnumField',
        'TextField',
        'FormSubmitBar',
        'LineIcon',
      ].map((name) => [name, name]),
    ),
    '@/utils/router': {
      navigateBack: () => actions.push('back'),
      redirectToLogin: () => actions.push('login'),
    },
    './index.module.scss': {},
  }).default
  const tree = component()
  const elements = []
  function collect(node) {
    if (!node || typeof node !== 'object') return
    elements.push(node)
    for (const child of [node.props?.children].flat(Infinity)) collect(child)
  }
  collect(tree)
  const submit = elements.find((node) => node.type === 'FormSubmitBar' || node.type === 'Button')
  return {
    pending,
    updates,
    toasts,
    actions,
    submit: () => (submit.props.onSubmit || submit.props.onClick)(),
    switchAccount: () => {
      version++
      current = { token: 'other', user: { id: 2 } }
    },
  }
}

test('personal profile save completion cannot update or refresh a replacement account', async () => {
  const h = harness('edit')
  const saving = h.submit()
  h.switchAccount()
  h.pending.resolve({})
  await saving
  assert.deepEqual(h.updates, [])
  assert.deepEqual(h.actions, [])
  assert.deepEqual(h.toasts, [])
})

test('password completion cannot revoke a replacement account session', async () => {
  const h = harness('password', ['Old123', 'New123', 'New123'])
  const saving = h.submit()
  h.switchAccount()
  h.pending.resolve(null)
  await saving
  assert.deepEqual(h.actions, [])
  assert.deepEqual(h.toasts, [])
})

test('password validation rejects weak, repeated and mismatched new passwords', async () => {
  for (const [oldPassword, newPassword, confirmation, message] of [
    ['Old123', '123456', '123456', /字母/],
    ['Old123', 'Old123', 'Old123', /相同/],
    ['Old123', 'New123', 'Other123', /不一致/],
  ]) {
    const h = harness('password', [oldPassword, newPassword, confirmation])
    await h.submit()
    assert.match(h.toasts[0].title, message)
    assert.deepEqual(h.actions, [])
  }
})

test('personal profile save refreshes the same account and returns after success', async () => {
  const h = harness('edit', [
    '新昵称',
    '姓名',
    'person@example.com',
    '13800138000',
    '2000-01-01',
    '1',
  ])
  const saving = h.submit()
  h.pending.resolve({})
  await saving
  assert.equal(h.updates[0].nickname, '新昵称')
  assert.equal(h.updates[0].gender, '1')
  assert.deepEqual(h.actions, ['refresh', 'back'])
  assert.equal(h.toasts[0].title, '保存成功')
})

test('personal profile failure keeps the page open with useful feedback', async () => {
  const h = harness('edit')
  const saving = h.submit()
  h.pending.reject(new Error('手机号已被使用'))
  await saving
  assert.deepEqual(h.updates, [])
  assert.deepEqual(h.actions, [])
  assert.equal(h.toasts[0].title, '手机号已被使用')
})

test('password success clears the current session and requests relogin', async () => {
  const h = harness('password', ['Old123', 'New123', 'New123'])
  const saving = h.submit()
  h.pending.resolve(null)
  await saving
  assert.deepEqual(h.actions, ['logout', 'login'])
  assert.match(h.toasts[0].title, /重新登录/)
})

test('password toast delay does not revoke a replacement session', async () => {
  const h = harness('password', ['Old123', 'New123', 'New123'])
  const saving = h.submit()
  h.pending.resolve(null)
  await Promise.resolve()
  h.switchAccount()
  await saving
  assert.deepEqual(h.actions, [])
})
