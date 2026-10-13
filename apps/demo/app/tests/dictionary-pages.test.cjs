const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTs } = require('./helpers/load-ts.cjs')
test('dictionary draft preserves zero status and derives item context from server record', () => {
  const { dictionaryDraft } = loadTs('src/pages/system/dict/form.ts')
  const draft = dictionaryDraft({
    id: 4,
    typeId: 2,
    type: 'gender',
    label: '未知',
    value: '0',
    status: 0,
    sort_order: 0,
    isDefault: true,
    tag: '',
    remark: null,
  })
  assert.equal(draft.status, '0')
  assert.equal(draft.value, '0')
  assert.equal(draft.isDefault, true)
  assert.equal(draft.type, 'gender')
})

const tick = () => new Promise((resolve) => setImmediate(resolve))
function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
function nodes(tree) {
  if (!tree || typeof tree !== 'object') return []
  if (Array.isArray(tree)) return tree.flatMap(nodes)
  return [tree, ...nodes(tree.props?.children)]
}
function mount(path, api, params = {}) {
  const slots = []
  let index = 0,
    effects = [],
    current = true,
    back = 0,
    toasts = 0
  const react = {
    useState(initial) {
      const slot = index++
      slots[slot] ??= { value: typeof initial === 'function' ? initial() : initial }
      return [
        slots[slot].value,
        (next) => {
          slots[slot].value = typeof next === 'function' ? next(slots[slot].value) : next
        },
      ]
    },
    useRef(initial) {
      const slot = index++
      slots[slot] ??= { current: initial }
      return slots[slot]
    },
    useEffect(fn, deps) {
      const slot = index++
      if (!slots[slot]?.deps || !deps.every((value, i) => Object.is(value, slots[slot].deps[i]))) {
        const old = slots[slot]
        slots[slot] = { deps }
        effects.push(() => {
          old?.cleanup?.()
          slots[slot].cleanup = fn()
        })
      }
    },
  }
  const names = [
    'ManagementPage',
    'ManagementPageHeader',
    'FormContent',
    'FormField',
    'FormSection',
    'FormSubmitBar',
    'EnumField',
    'TextAreaField',
    'TextField',
    'ActionSheet',
    'BottomActionBar',
    'DetailContent',
    'DetailHero',
    'DetailRow',
    'DetailSection',
  ]
  const component = loadTs(`src/pages/system/dict/${path}.tsx`, {
    react,
    '@tarojs/taro': {
      useRouter: () => ({ params }),
      useDidShow: () => {},
      useDidHide: () => {},
      setNavigationBarTitle: async () => {},
      showToast: async () => {
        toasts++
      },
    },
    '@/api/admin/dict': api,
    '@tarojs/components': { Switch: 'Switch' },
    '@/components/atoms': { Tag: 'Tag' },
    '@/components/feedback': { StateView: 'StateView' },
    '@/components/management': Object.fromEntries(names.map((name) => [name, name])),
    '@/hooks': { useCanWrite: () => true, confirmAction: async () => true },
    '@/utils/auth-guard': {
      useCurrentModuleAccess: () => () => current,
      useRequireAuth: () => ({ ready: true, allowed: true }),
    },
    '@/utils/router': {
      navigateBack: () => {
        back++
      },
      navigateTo: () => {},
    },
    '@/utils/format': { formatDateTime: (value) => value },
    '@/constants/routes': { SYSTEM_PAGES: {} },
    '../_shared/AdminUI': { errorMessage: (cause) => cause.message },
    './form': loadTs('src/pages/system/dict/form.ts'),
  }).default
  function render() {
    index = 0
    const tree = component({})
    const pending = effects
    effects = []
    pending.forEach((effect) => {
      effect()
    })
    return nodes(tree)
  }
  render()
  return {
    render,
    switchAccount: () => {
      current = false
    },
    back: () => back,
    toasts: () => toasts,
    unmount: () =>
      slots.forEach((slot) => {
        slot?.cleanup?.()
      }),
  }
}
test('dictionary form retains input after failed save and prevents concurrent duplicate saves', async () => {
  const pending = deferred()
  const submitted = []
  const form = mount('DictionaryForm', {
    createAdminDictType: (data) => {
      submitted.push(data)
      return pending.promise
    },
  })
  await tick()
  const fields = form.render().filter((node) => node.type === 'TextField')
  fields[0].props.onChange('客户状态')
  fields[1].props.onChange('customer_status')
  const save = form.render().find((node) => node.type === 'FormSubmitBar')
  save.props.onSubmit()
  save.props.onSubmit()
  assert.equal(submitted.length, 1)
  pending.reject(new Error('网络失败'))
  await tick()
  const tree = form.render()
  assert.equal(tree.find((node) => node.type === 'TextField').props.value, '客户状态')
  assert.ok(tree.some((node) => node.type === 'StateView' && node.props.text === '网络失败'))
  assert.equal(form.back(), 0)
  form.unmount()
})
test('dictionary save ignores successful response after account switch', async () => {
  const pending = deferred()
  const form = mount('DictionaryForm', { createAdminDictType: () => pending.promise })
  await tick()
  const fields = form.render().filter((node) => node.type === 'TextField')
  fields[0].props.onChange('客户状态')
  fields[1].props.onChange('customer_status')
  form
    .render()
    .find((node) => node.type === 'FormSubmitBar')
    .props.onSubmit()
  form.switchAccount()
  pending.resolve({ id: 1 })
  await tick()
  assert.equal(form.back(), 0)
  assert.equal(form.toasts(), 0)
  form.unmount()
})
test('dictionary detail discards loaded record after account switch', async () => {
  const pending = deferred()
  const page = mount('DictionaryDetail', { getAdminDictType: () => pending.promise }, { id: '1' })
  page.switchAccount()
  pending.resolve({ id: 1, name: '旧账号字典', type: 'old', status: 1, sort_order: 0 })
  await tick()
  assert.equal(page.render().filter((node) => node.type === 'DetailHero').length, 0)
  page.unmount()
})
