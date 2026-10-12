const { loadTs } = require('./load-ts.cjs')

/**
 * 驱动真实页面组件：模拟 React hooks 与 Taro 生命周期。
 * JSX 组件在 mocks 里映射成字符串，页面接线通过元素 props 断言。
 */
function mountPage(entry, mocks, { router = {} } = {}) {
  const slots = []
  let cursor = 0
  let dirty = true
  let effects = []
  let tree
  const didShow = []
  const didHide = []
  const react = {
    useState(initial) {
      const index = cursor++
      if (!(index in slots)) slots[index] = { value: typeof initial === 'function' ? initial() : initial }
      return [slots[index].value, (next) => {
        slots[index].value = typeof next === 'function' ? next(slots[index].value) : next
        dirty = true
      }]
    },
    useRef(initial) {
      const index = cursor++
      if (!(index in slots)) slots[index] = { current: initial }
      return slots[index]
    },
    useMemo(factory) { cursor++; return factory() },
    useCallback(fn) { cursor++; return fn },
    useEffect(effect, deps) {
      const index = cursor++
      if (deps && slots[index]?.deps?.length === deps.length && slots[index].deps.every((v, i) => Object.is(v, deps[i]))) return
      const cleanup = slots[index]?.cleanup
      slots[index] = { deps }
      effects.push(() => { cleanup?.(); slots[index].cleanup = effect() })
    },
  }
  const taro = mocks['@tarojs/taro'] || {}
  const Page = loadTs(entry, {
    react,
    ...mocks,
    '@tarojs/taro': {
      useRouter: () => ({ params: router }),
      useDidShow: (cb) => didShow.push(cb),
      useDidHide: (cb) => didHide.push(cb),
      usePullDownRefresh: () => {},
      useReachBottom: () => {},
      ...taro,
    },
  }).default
  // 除 children 外，也展开以元素为值的 props（如顶栏的 action、单元格的 tag），否则这些插槽里的元素无法断言
  const isElement = (value) => Boolean(value && typeof value === 'object' && 'type' in value && 'props' in value)
  const slotted = (props) => Object.entries(props || {}).flatMap(([key, value]) =>
    key === 'children' ? [] : isElement(value) ? [value] : Array.isArray(value) ? value.filter(isElement) : [])
  const nodes = (value) => !value || typeof value !== 'object' ? [] : Array.isArray(value) ? value.flatMap(nodes) : [value, ...nodes(value.props?.children), ...nodes(slotted(value.props))]
  const flush = () => {
    let guard = 0
    while (dirty && guard++ < 50) {
      dirty = false
      cursor = 0
      didShow.length = 0
      didHide.length = 0
      tree = Page()
      const pending = effects
      effects = []
      for (const run of pending) run()
    }
    return nodes(tree)
  }
  const api = {
    flush,
    // 每轮强制重渲染：外部可变数据（如 mock 的 list.filters）变化后 effect 依赖才能被重新比较
    async settle() { for (let i = 0; i < 5; i++) { dirty = true; flush(); await new Promise(setImmediate) } return flush() },
    all: (type) => flush().filter((n) => n.type === type),
    one: (type) => flush().find((n) => n.type === type),
    byLabel: (label) => flush().find((n) => n.props?.['aria-label'] === label || n.props?.label === label),
    text: () => flush().map((n) => typeof n.props?.children === 'string' || typeof n.props?.children === 'number' ? String(n.props.children) : '').join('|'),
    show() { for (const cb of didShow) cb(); dirty = true; return flush() },
    rerender() { dirty = true; return flush() },
  }
  flush()
  return api
}

module.exports = { mountPage }
