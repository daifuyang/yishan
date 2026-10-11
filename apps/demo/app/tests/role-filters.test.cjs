const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTs } = require('./helpers/load-ts.cjs')

test('role query carries status and maps each sort key onto backend fields', () => {
  const { buildRoleQuery } = loadTs('src/pages/system/role/filters.ts')
  assert.deepEqual(buildRoleQuery(1, 20, '管理员', { status: '1', sort: 'createdAsc' }), {
    page: 1,
    pageSize: 20,
    keyword: '管理员',
    status: '1',
    sortBy: 'createdAt',
    sortOrder: 'asc',
  })
  assert.deepEqual(buildRoleQuery(2, 10, '', { status: '', sort: 'updated' }), {
    page: 2,
    pageSize: 10,
    keyword: undefined,
    status: undefined,
    sortBy: 'updatedAt',
    sortOrder: 'desc',
  })
})

test('unknown sort keys fall back to the default newest-first ordering', () => {
  const { buildRoleQuery, DEFAULT_ROLE_FILTERS, readRoleFilters } = loadTs('src/pages/system/role/filters.ts')
  assert.deepEqual(readRoleFilters({}), DEFAULT_ROLE_FILTERS)
  assert.deepEqual(readRoleFilters({ status: 1, sort: null }), DEFAULT_ROLE_FILTERS)
  const query = buildRoleQuery(1, 20, '', { status: '', sort: 'nope' })
  assert.equal(query.sortBy, 'createdAt')
  assert.equal(query.sortOrder, 'desc')
  assert.equal(query.status, undefined)
})
