const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTs } = require('./helpers/load-ts.cjs')

const registry = loadTs('src/modules/registry.ts')

const app = (menuId, id = `app-${menuId}`) => ({ id, name: id, icon: 'X', menuId, entry: `pages/${id}/index` })
const groups = [
  { id: 'group-1', name: 'A', apps: [app(11), app(12), app(13)] },
  { id: 'group-2', name: 'B', apps: [app(21), app(22)] },
]

test('getHomeApps puts pinned first, fills with ranked and skips ids without a usable page', () => {
  const result = registry.getHomeApps(groups, { pinned: [22, 404], ranked: [13, 11, 405, 12, 21] })
  assert.deepEqual(result.map((a) => a.menuId), [22, 13, 11, 12, 21])
})

test('getHomeApps truncates to the limit and never repeats an app', () => {
  const result = registry.getHomeApps(groups, { pinned: [11, 11], ranked: [11, 12, 13] }, 2)
  assert.deepEqual(result.map((a) => a.menuId), [11, 12])
  assert.equal(registry.MAX_HOME_APPS, 8)
})

test('getHomeApps falls back to workbench order when the home list is unavailable', () => {
  assert.deepEqual(registry.getHomeApps(groups, null, 3).map((a) => a.menuId), [11, 12, 13])
})
