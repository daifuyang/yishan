const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTs } = require('./helpers/load-ts.cjs')

// auth 身份可变的 mock：切换 auth.user.id 即可模拟登录另一个账号
function load() {
  const auth = { user: { id: 1 } }
  const store = loadTs('src/stores/selectionDraft.ts', {
    zustand: require('zustand'),
    './auth': {
      useAuthStore: Object.assign(
        (selector) => selector(auth),
        { getState: () => auth },
      ),
    },
  }).useSelectionDraft
  return { store, auth }
}

test('writeDraft 后 readDraft 返回写入的 ids', () => {
  const { store } = load()
  store.getState().writeDraft('user-depts', [48, 52])
  assert.deepEqual(store.getState().readDraft('user-depts'), [48, 52])
})

test('readDraft 在无草稿时返回空数组而不是 undefined', () => {
  const { store } = load()
  assert.deepEqual(store.getState().readDraft('user-roles'), [])
})

test('consumeDraft 读后清空，二次读取返回 undefined', () => {
  const { store } = load()
  store.getState().writeDraft('user-depts', [48])
  assert.deepEqual(store.getState().consumeDraft('user-depts'), [48])
  assert.equal(store.getState().consumeDraft('user-depts'), undefined)
})

test('不同 key 的草稿互不干扰', () => {
  const { store } = load()
  const s = store.getState()
  s.writeDraft('user-depts', [48])
  s.writeDraft('user-roles', [37])
  assert.deepEqual(store.getState().consumeDraft('user-depts'), [48])
  assert.deepEqual(store.getState().consumeDraft('user-roles'), [37])
})

test('切换账号后读不到上一个账号的草稿（Review Focus #4）', () => {
  const { store, auth } = load()
  store.getState().writeDraft('user-depts', [48])
  auth.user = { id: 2 }
  assert.deepEqual(store.getState().readDraft('user-depts'), [])
})

test('登出（user 为 null）后读不到任何账号的草稿（Review Focus #4）', () => {
  const { store, auth } = load()
  store.getState().writeDraft('user-depts', [48])
  auth.user = null
  assert.deepEqual(store.getState().readDraft('user-depts'), [])
})

test('切回原账号仍能读回自己的草稿', () => {
  const { store, auth } = load()
  store.getState().writeDraft('user-depts', [48])
  auth.user = { id: 2 }
  store.getState().writeDraft('user-depts', [99])
  auth.user = { id: 1 }
  assert.deepEqual(store.getState().readDraft('user-depts'), [48])
})

test('reset 清空全部账号的草稿', () => {
  const { store } = load()
  store.getState().writeDraft('user-depts', [48])
  store.getState().reset()
  assert.deepEqual(store.getState().readDraft('user-depts'), [])
})

test('writeDraft 去重并剔除非法值', () => {
  const { store } = load()
  store.getState().writeDraft('user-depts', [48, 48, NaN, 'x', null, 52])
  assert.deepEqual(store.getState().readDraft('user-depts'), [48, 52])
})