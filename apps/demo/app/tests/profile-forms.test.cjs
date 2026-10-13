const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const { loadTs, deferred, appRoot } = require('./helpers/load-ts.cjs')

const MANAGEMENT_ATOMS = [
  'ManagementPage',
  'ManagementPageHeader',
  'FormContent',
  'FormSection',
  'FormField',
  'EnumField',
  'TextField',
  'FormSubmitBar',
  'FormError',
  'SecretField',
]

// 页面在迷你渲染器里跑：state 跨重渲染持久化，才能断言失败后 FormError 就地出现、输入值仍在。
// 页面副作用的依赖（auth、user）在测试里不变，等价于 React 只在挂载时跑一次，所以只在首次渲染后执行。
function harness(page, inputs = []) {
  let version = 0
  let current = { token: 'token', user: { id: 1, nickname: '原昵称' } }
  const pending = deferred()
  const updates = []
  const toasts = []
  const actions = []
  const states = []
  const refs = []
  const effects = []
  const injected = new Map()
  let stateIndex = 0
  let refIndex = 0
  let mounted = false
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
      useState(initial) {
        const index = stateIndex++
        if (!(index in states)) {
          const given = inputs[index]
          if (given !== undefined) injected.set(index, given)
          states[index] = given !== undefined ? given : typeof initial === 'function' ? initial() : initial
        }
        return [
          states[index],
          (value) => {
            states[index] = typeof value === 'function' ? value(states[index]) : value
          },
        ]
      },
      useRef(initial) {
        const index = refIndex++
        refs[index] ||= { current: initial }
        return refs[index]
      },
      useEffect(effect) {
        effects.push(effect)
      },
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
    '@/components/management': Object.fromEntries(MANAGEMENT_ATOMS.map((name) => [name, name])),
    '@/utils/router': {
      navigateBack: () => actions.push('back'),
      redirectToLogin: () => actions.push('login'),
    },
    './index.module.scss': {},
  }).default
  const elements = []
  const render = () => {
    stateIndex = 0
    refIndex = 0
    effects.length = 0
    elements.length = 0
    ;(function collect(node) {
      if (!node || typeof node !== 'object') return
      elements.push(node)
      for (const child of [node.props?.children].flat(Infinity)) collect(child)
    })(component())
    if (!mounted) {
      mounted = true
      for (const effect of effects) effect()
      // 挂载副作用会从 store 把表单值重新灌回来；注入值才是本次测试的起点，不能被它顶掉。
      for (const [index, value] of injected) states[index] = value
    }
    return elements
  }
  render()
  return {
    pending,
    updates,
    toasts,
    actions,
    render,
    tree: () => elements,
    formError: () => elements.find((node) => node.type === 'FormError')?.props.children,
    field: (label) =>
      elements.find((node) => node.type === 'FormField' && node.props.label === label)?.props.children
        ?.props.value,
    secret: (label) =>
      elements.find((node) => node.type === 'SecretField' && node.props.label === label)?.props.value,
    submit: () => {
      const submit = elements.find((node) => node.type === 'FormSubmitBar' || node.type === 'Button')
      return (submit.props.onSubmit || submit.props.onClick)()
    },
    switchAccount: () => {
      version++
      current = { token: 'other', user: { id: 2 } }
    },
  }
}

const pageSource = (file) => fs.readFileSync(path.join(appRoot, file), 'utf8')

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

test('password validation rejects weak, repeated and mismatched new passwords inline', async () => {
  for (const [oldPassword, newPassword, confirmation, message] of [
    ['Old123', '123456', '123456', /字母/],
    ['Old123', 'Old123', 'Old123', /相同/],
    ['Old123', 'New123', 'Other123', /不一致/],
  ]) {
    const h = harness('password', [oldPassword, newPassword, confirmation])
    await h.submit()
    h.render()
    assert.match(h.formError(), message)
    assert.deepEqual(h.toasts, [])
    assert.deepEqual(h.actions, [])
    assert.deepEqual(
      [h.secret('当前密码'), h.secret('新密码'), h.secret('确认密码')],
      [oldPassword, newPassword, confirmation],
    )
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
  const h = harness('edit', [
    '新昵称',
    '姓名',
    'person@example.com',
    '13800138000',
    '2000-01-01',
    '1',
  ])
  const saving = h.submit()
  h.pending.reject(new Error('手机号已被使用'))
  await saving
  h.render()
  assert.deepEqual(h.updates, [])
  assert.deepEqual(h.actions, [])
  assert.deepEqual(h.toasts, [])
  assert.equal(h.formError(), '手机号已被使用')
  assert.equal(h.field('昵称'), '新昵称')
  assert.equal(h.field('邮箱'), 'person@example.com')
})

test('personal profile contact validation reports inline instead of by toast', async () => {
  const email = harness('edit', ['昵称', '姓名', 'not-an-email', '13800138000', '', '0'])
  await email.submit()
  email.render()
  assert.equal(email.formError(), '邮箱格式不正确')
  assert.deepEqual(email.toasts, [])
  assert.deepEqual(email.updates, [])

  const phone = harness('edit', ['昵称', '姓名', 'a@b.com', '12345', '', '0'])
  await phone.submit()
  phone.render()
  assert.equal(phone.formError(), '手机号格式不正确')
  assert.deepEqual(phone.toasts, [])
  assert.deepEqual(phone.updates, [])
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

test('profile password page reuses the shared SecretField and drops the local PasswordRow', () => {
  const page = pageSource('src/pages/profile/password/index.tsx')
  assert.doesNotMatch(page, /PasswordRow/, '不再保留本地 PasswordRow')
  assert.doesNotMatch(page, /pwd__(control|input|eye)/, '不再自绘密码行样式')
  const shared = page.match(/import \{([^}]*)\} from '@\/components\/management'/)
  assert.ok(shared, '密码页应从 @/components/management 引入共享原子')
  assert.match(shared[1], /\bSecretField\b/, '密码字段复用共享 SecretField')
  assert.match(shared[1], /\bFormError\b/, '失败信息复用共享 FormError')
  assert.equal((page.match(/<SecretField\b/g) ?? []).length, 3, '三个密码行都是 SecretField')
  assert.equal(
    (page.match(/Taro\.showToast\(/g) ?? []).length,
    1,
    '只有成功提示保留 toast，校验与保存失败不再走 toast',
  )
})

test('profile edit page reports failures through FormError only', () => {
  const page = pageSource('src/pages/profile/edit/index.tsx')
  const shared = page.match(/import \{([^}]*)\} from '@\/components\/management'/)
  assert.ok(shared, '个人资料页应从 @/components/management 引入共享原子')
  assert.match(shared[1], /\bFormError\b/, '失败信息复用共享 FormError')
  assert.match(page, /<FormError>/, '失败信息渲染在表单边界')
  assert.equal(
    (page.match(/Taro\.showToast\(/g) ?? []).length,
    1,
    '只有成功提示保留 toast，校验与保存失败不再走 toast',
  )
})
