const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTs } = require('./helpers/load-ts.cjs')

function setup() {
  let session = 1
  let writes = 0
  const model = loadTs('src/pages/system/position/model.ts', {
    '@/api/client': { getSessionVersion: () => session },
    '@/utils/auth-guard': { canWriteModuleNow: () => true },
    '@/hooks': {
      confirmAction: async () => {
        session++
        return true
      },
    },
    '@/api/admin/position': {
      deleteAdminPosition: async () => {
        writes++
      },
    },
  })
  return { model, writes: () => writes }
}

test('position form trims names and rejects invalid sorting', () => {
  const { model } = setup()
  assert.deepEqual(model.positionPayload('  经理  ', '说明', '1', '2'), {
    name: '经理',
    description: '说明',
    status: '1',
    sort_order: 2,
  })
  assert.throws(() => model.positionPayload(' ', '', '1', '0'), /请输入岗位名称/)
  for (const sort of ['', '-1', 'abc', 'Infinity'])
    assert.throws(() => model.positionPayload('经理', '', '1', sort), /排序/)
})

test('position delete stops when account changes during confirmation', async () => {
  const { model, writes } = setup()
  assert.equal(await model.removePosition({ id: 1, name: '经理' }), false)
  assert.equal(writes(), 0)
})

function mountForm({ id, permissions, api }) {
  const slots = []
  let cursor = 0
  let dirty = true
  let effects = []
  let tree
  let session = 1
  let backs = 0
  const mocks = {
    '@tarojs/components': { Text: 'Text' },
    react: {
      useState(initial) {
        const index = cursor++
        slots[index] ??= { value: initial }
        return [
          slots[index].value,
          (value) => {
            slots[index].value = typeof value === 'function' ? value(slots[index].value) : value
            dirty = true
          },
        ]
      },
      useRef(initial) {
        const index = cursor++
        slots[index] ??= { current: initial }
        return slots[index]
      },
      useEffect(effect, deps) {
        const index = cursor++
        if (slots[index]?.deps?.every((value, i) => Object.is(value, deps[i]))) return
        const cleanup = slots[index]?.cleanup
        slots[index] = { deps }
        effects.push(() => {
          cleanup?.()
          slots[index].cleanup = effect()
        })
      },
    },
    '@tarojs/taro': {
      useRouter: () => ({ params: id ? { id } : {} }),
      showToast() {},
      setNavigationBarTitle() {},
    },
    '@/api/admin/position': api,
    '@/api/client': { getSessionVersion: () => session },
    '@/components/feedback': { StateView: 'StateView' },
    '@/components/management': Object.fromEntries(
      [
        'FormContent',
        'FormError',
        'FormField',
        'FormSection',
        'FormSubmitBar',
        'ManagementPage',
        'ManagementPageHeader',
        'EnumField',
        'TextAreaField',
        'TextField',
      ].map((key) => [key, key]),
    ),
    '@/hooks': {
      useCanWrite: (permission) => permissions.includes(permission),
      confirmAction: async () => true,
    },
    '@/utils/auth-guard': {
      useRequireAuth: () => ({ ready: true, allowed: true }),
      canWriteModuleNow: (_, required) => required.every((code) => permissions.includes(code)),
    },
    '@/utils/router': {
      navigateBack: () => {
        backs++
      },
    },
    '@/utils/account-scope': {
      withAccountScope: (component) => component,
      errorMessage: (error) => error.message,
    },
  }
  const page = loadTs('src/pages/system/position/form/index.tsx', mocks).default
  const nodes = (value) =>
    !value || typeof value !== 'object'
      ? []
      : Array.isArray(value)
        ? value.flatMap(nodes)
        : [value, ...nodes(value.props?.children)]
  const flush = () => {
    while (dirty) {
      dirty = false
      cursor = 0
      tree = page()
      const pending = effects
      effects = []
      pending.forEach((effect) => {
        effect()
      })
    }
    return nodes(tree)
  }
  flush()
  return {
    field: () => flush().find((node) => node.type === 'TextField'),
    submit: () => flush().find((node) => node.type === 'FormSubmitBar'),
    nodes: flush,
    settle: async () => {
      await new Promise(setImmediate)
      return flush()
    },
    changeSession: () => {
      session++
    },
    backs: () => backs,
  }
}

test('position creation requires only create permission and keeps input on failure', async () => {
  let reject
  let writes = 0
  const pending = new Promise((_, fail) => {
    reject = fail
  })
  const form = mountForm({
    permissions: ['system:position:create'],
    api: {
      createAdminPosition: () => {
        writes++
        return pending
      },
    },
  })
  form.field().props.onChange('主管')
  const submit = form.submit().props.onSubmit
  submit()
  submit()
  assert.equal(writes, 1)
  reject(new Error('岗位名称重复'))
  await form.settle()
  assert.equal(form.field().props.value, '主管')
  assert.ok(form.nodes().some((node) => node.props?.children === '岗位名称重复'))
  assert.equal(form.backs(), 0)
})

test('position edit works with update permission only and ignores save completion after account switch', async () => {
  let resolve
  let writes = 0
  const pending = new Promise((done) => {
    resolve = done
  })
  const form = mountForm({
    id: '8',
    permissions: ['system:position:update'],
    api: {
      getAdminPosition: async () => ({ id: 8, name: '经理', status: '1', sort_order: 0 }),
      updateAdminPosition: () => {
        writes++
        return pending
      },
    },
  })
  await form.settle()
  assert.equal(form.field().props.value, '经理')
  form.submit().props.onSubmit()
  assert.equal(writes, 1)
  form.changeSession()
  resolve({})
  await form.settle()
  assert.equal(form.backs(), 0)
})

test('previous account form callbacks cannot submit', async () => {
  let writes = 0
  const form = mountForm({
    permissions: ['system:position:create'],
    api: {
      createAdminPosition: async () => {
        writes++
      },
    },
  })
  form.field().props.onChange('旧账号草稿')
  const submit = form.submit().props.onSubmit
  form.changeSession()
  submit()
  await form.settle()
  assert.equal(writes, 0)
})

test('failed position load cannot save default values', async () => {
  let writes = 0
  const form = mountForm({
    id: '8',
    permissions: ['system:position:update'],
    api: {
      getAdminPosition: async () => {
        throw new Error('加载失败')
      },
      updateAdminPosition: async () => {
        writes++
      },
    },
  })
  await form.settle()
  assert.equal(form.field().props.disabled, true)
  assert.equal(form.submit(), undefined)
  assert.equal(writes, 0)
})

test('position deletion rechecks revoked permission after confirmation', async () => {
  let allowed = true
  let deletes = 0
  const model = loadTs('src/pages/system/position/model.ts', {
    '@/api/client': { getSessionVersion: () => 1 },
    '@/utils/auth-guard': { canWriteModuleNow: () => allowed },
    '@/hooks': {
      confirmAction: async () => {
        allowed = false
        return true
      },
    },
    '@/api/admin/position': {
      deleteAdminPosition: async () => {
        deletes++
      },
    },
  })
  assert.equal(await model.removePosition({ id: 8, name: '主管' }), false)
  assert.equal(deletes, 0)
})
