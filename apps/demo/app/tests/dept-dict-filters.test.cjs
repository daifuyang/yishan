const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTs } = require('./helpers/load-ts.cjs')

test('dept query keeps the custom sort number as the default ordering', () => {
  const { buildDeptQuery, DEFAULT_DEPT_FILTERS, readDeptFilters } = loadTs('src/pages/system/dept/filters.ts')
  assert.deepEqual(DEFAULT_DEPT_FILTERS, { status: '', sort: 'sortOrder' })
  assert.deepEqual(readDeptFilters({}), DEFAULT_DEPT_FILTERS)
  assert.deepEqual(readDeptFilters({ status: 1, sort: null }), DEFAULT_DEPT_FILTERS)
  assert.deepEqual(buildDeptQuery(1, 20, '研发', { status: '1', sort: 'sortOrder' }), {
    page: 1,
    pageSize: 20,
    keyword: '研发',
    status: '1',
    sortBy: 'sortOrder',
    sortOrder: 'asc',
  })
})

test('dept query maps sort keys and falls back to the default on unknown keys', () => {
  const { buildDeptQuery } = loadTs('src/pages/system/dept/filters.ts')
  const updated = buildDeptQuery(2, 10, '', { status: '', sort: 'updated' })
  assert.equal(updated.sortBy, 'updatedAt')
  assert.equal(updated.sortOrder, 'desc')
  assert.equal(updated.keyword, undefined)
  assert.equal(updated.status, undefined)
  const fallback = buildDeptQuery(1, 20, '', { status: '', sort: 'nope' })
  assert.equal(fallback.sortBy, 'sortOrder')
  assert.equal(fallback.sortOrder, 'asc')
})

test('dict query encodes status as a number and keeps sort keys', () => {
  const { buildDictQuery, DEFAULT_DICT_FILTERS, readDictFilters } = loadTs('src/pages/system/dict/filters.ts')
  assert.deepEqual(DEFAULT_DICT_FILTERS, { status: '', sort: 'sortOrder' })
  assert.deepEqual(readDictFilters({}), DEFAULT_DICT_FILTERS)
  assert.equal(buildDictQuery(1, 20, '颜色', { status: '1', sort: 'createdDesc' }).status, 1)
  assert.equal(buildDictQuery(1, 20, '颜色', { status: '0', sort: 'createdDesc' }).status, 0)
  assert.equal(buildDictQuery(1, 20, '', { status: '', sort: 'sortOrder' }).status, undefined)
  const created = buildDictQuery(1, 20, '', { status: '', sort: 'createdAsc' })
  assert.equal(created.sortBy, 'createdAt')
  assert.equal(created.sortOrder, 'asc')
})
