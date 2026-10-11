const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTs } = require('./helpers/load-ts.cjs')

test('position query keeps the custom sort number as the default ordering', () => {
  const { buildPositionQuery, DEFAULT_POSITION_FILTERS } = loadTs('src/pages/system/position/filters.ts')
  assert.deepEqual(DEFAULT_POSITION_FILTERS, { status: '', sort: 'sortOrder' })
  assert.deepEqual(buildPositionQuery(1, 20, '主管', { status: '1', sort: 'sortOrder' }), {
    page: 1,
    pageSize: 20,
    keyword: '主管',
    status: '1',
    sortBy: 'sortOrder',
    sortOrder: 'asc',
  })
})

test('position query maps each sort key onto backend fields and drops an empty keyword', () => {
  const { buildPositionQuery } = loadTs('src/pages/system/position/filters.ts')
  assert.deepEqual(buildPositionQuery(2, 10, '', { status: '', sort: 'updated' }), {
    page: 2,
    pageSize: 10,
    keyword: undefined,
    status: undefined,
    sortBy: 'updatedAt',
    sortOrder: 'desc',
  })
  const oldest = buildPositionQuery(1, 20, '', { status: '', sort: 'createdAsc' })
  assert.equal(oldest.sortBy, 'createdAt')
  assert.equal(oldest.sortOrder, 'asc')
})

test('unknown sort keys and non-string filter values fall back to the defaults', () => {
  const { buildPositionQuery, readPositionFilters, DEFAULT_POSITION_FILTERS } = loadTs('src/pages/system/position/filters.ts')
  assert.deepEqual(readPositionFilters({}), DEFAULT_POSITION_FILTERS)
  assert.deepEqual(readPositionFilters({ status: 1, sort: null }), DEFAULT_POSITION_FILTERS)
  const query = buildPositionQuery(1, 20, '', { status: '', sort: 'nope' })
  assert.equal(query.sortBy, 'sortOrder')
  assert.equal(query.sortOrder, 'asc')
})
