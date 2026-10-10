const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTs, deferred } = require('./helpers/load-ts.cjs')

function mount(fetcher, options = {}) {
  const slots = []
  let index = 0
  let dirty = true
  let effects = []
  let hook
  const same = (a, b) =>
    a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]))
  const react = {
    useState(initial) {
      const i = index++
      slots[i] ??= { value: typeof initial === 'function' ? initial() : initial }
      return [
        slots[i].value,
        (next) => {
          slots[i].value = typeof next === 'function' ? next(slots[i].value) : next
          dirty = true
        },
      ]
    },
    useRef(initial) {
      const i = index++
      slots[i] ??= { current: initial }
      return slots[i]
    },
    useCallback(fn, deps) {
      const i = index++
      if (!same(slots[i]?.deps, deps)) slots[i] = { value: fn, deps }
      return slots[i].value
    },
    useEffect(fn, deps) {
      const i = index++
      if (!same(slots[i]?.deps, deps)) {
        const previous = slots[i]
        slots[i] = { deps, cleanup: previous?.cleanup }
        effects.push(() => {
          previous?.cleanup?.()
          slots[i].cleanup = fn()
        })
      }
    },
  }
  const taro = {
    usePullDownRefresh() {},
    useReachBottom() {},
    showToast() {},
    stopPullDownRefresh() {},
  }
  const { useListPagination } = loadTs('src/hooks/useListPagination.ts', {
    react,
    '@tarojs/taro': taro,
  })
  const flush = () => {
    while (dirty) {
      dirty = false
      index = 0
      // biome-ignore lint/correctness/useHookAtTopLevel: This harness simulates complete React renders with persistent hook slots.
      hook = useListPagination({ fetcher, keywordDebounce: 0, ...options })
      const queued = effects
      effects = []
      queued.forEach((effect) => {
        effect()
      })
    }
    return hook
  }
  flush()
  return {
    flush,
    get: () => hook,
    unmount: () =>
      slots.forEach((slot) => {
        slot?.cleanup?.()
      }),
  }
}

test('initial mount makes one request and duplicate load-more calls are locked synchronously', async () => {
  let calls = 0
  const second = deferred()
  const h = mount(async ({ page }) => {
    calls++
    return page === 1 ? { list: ['first'], total: 50 } : second.promise
  })
  await new Promise((resolve) => setTimeout(resolve, 15))
  const hook = h.flush()
  assert.equal(calls, 1)
  const one = hook.loadMore()
  const two = hook.loadMore()
  assert.equal(calls, 2)
  second.resolve({ list: ['second'], total: 50 })
  await Promise.all([one, two])
  assert.deepEqual(h.flush().list, ['first', 'second'])
  h.unmount()
})

test('late responses from previous searches cannot overwrite or clear the newer request state', async () => {
  const old = deferred()
  const fresh = deferred()
  const calls = []
  const h = mount(({ keyword }) => {
    calls.push(keyword)
    return keyword ? fresh.promise : old.promise
  })
  await new Promise((resolve) => setTimeout(resolve, 10))
  h.get().setKeyword('new')
  h.flush()
  await new Promise((resolve) => setTimeout(resolve, 10))
  old.resolve({ list: ['old'], total: 1 })
  await new Promise(setImmediate)
  assert.deepEqual(h.flush().list, [])
  assert.equal(h.get().loading, true)
  fresh.resolve({ list: ['new'], total: 1 })
  await new Promise(setImmediate)
  assert.deepEqual(h.flush().list, ['new'])
  assert.deepEqual(calls, ['', 'new'])
  h.unmount()
})

test('disabled pages do not fetch data before authorization', async () => {
  let calls = 0
  const h = mount(
    async () => {
      calls++
      return { list: [], total: 0 }
    },
    { enabled: false },
  )
  await new Promise((resolve) => setTimeout(resolve, 10))
  assert.equal(calls, 0)
  h.unmount()
})

test('load more cannot skip page one while a new search is debouncing', async () => {
  const pages = []
  const h = mount(async ({ page }) => {
    pages.push(page)
    return { list: ['item'], total: 50 }
  })
  await new Promise(setImmediate)
  h.flush().setKeyword('new')
  await h.get().loadMore()
  await new Promise((resolve) => setTimeout(resolve, 10))
  h.flush()
  await new Promise((resolve) => setTimeout(resolve, 10))
  assert.deepEqual(pages, [1, 1])
  h.unmount()
})

test('failed load more retains the prior list and retries the same page', async () => {
  let fail = true
  const pages = []
  const h = mount(async ({ page }) => {
    pages.push(page)
    if (page === 2 && fail) throw Error('offline')
    return { list: [page], total: 50 }
  })
  await new Promise(setImmediate)
  await h.flush().loadMore()
  assert.deepEqual(h.flush().list, [1])
  assert.equal(h.get().error, 'offline')
  fail = false
  await h.get().loadMore()
  assert.deepEqual(h.flush().list, [1, 2])
  assert.deepEqual(pages, [1, 2, 2])
  h.unmount()
})
