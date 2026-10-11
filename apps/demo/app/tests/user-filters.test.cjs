const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTs } = require('./helpers/load-ts.cjs')

test('user query combines status, sorting and inclusive local creation dates', () => {
  const { buildUserQuery } = loadTs('src/pages/system/user/filters.ts')
  assert.deepEqual(
    buildUserQuery(1, 20, '王', {
      status: '2',
      sort: 'loginCount',
      startDate: '2026-10-01',
      endDate: '2026-10-11',
    }),
    {
      page: 1,
      pageSize: 20,
      keyword: '王',
      status: '2',
      sortBy: 'loginCount',
      sortOrder: 'desc',
      startTime: new Date(2026, 9, 1, 0, 0, 0, 0).toISOString(),
      endTime: new Date(2026, 9, 11, 23, 59, 59, 999).toISOString(),
    },
  )
})

test('date presets include today and reject incomplete or reversed custom ranges', () => {
  const { dateRangePreset, validateDateRange } = loadTs('src/components/management/dateRange.ts')
  assert.deepEqual(dateRangePreset('7', new Date(2026, 9, 11, 12)), {
    startDate: '2026-10-05',
    endDate: '2026-10-11',
  })
  assert.deepEqual(dateRangePreset('all'), { startDate: '', endDate: '' })
  assert.ok(validateDateRange('2026-10-11', '2026-10-01'))
  assert.ok(validateDateRange('2026-10-11', ''))
  assert.equal(validateDateRange('', ''), '')
  assert.equal(validateDateRange('2026-10-01', '2026-10-11'), '')
})

test('one-sided ranges pass only when the caller allows them', () => {
  const { validateDateRange } = loadTs('src/components/management/dateRange.ts')
  assert.match(validateDateRange('2026-10-01', ''), /开始和结束日期/)
  assert.equal(validateDateRange('2026-10-01', '', true), '')
  assert.match(validateDateRange('2026-02-30', '', true), /有效日期/)
  assert.match(validateDateRange('2026-10-12', '2026-10-11', true), /不能晚于/)
})

test('user filters survive a weak filter dictionary from the list hook', () => {
  const { readUserFilters, DEFAULT_USER_FILTERS } = loadTs('src/pages/system/user/filters.ts')
  assert.deepEqual(readUserFilters({}), DEFAULT_USER_FILTERS)
  assert.deepEqual(readUserFilters({ status: '2', sort: 1, startDate: '2026-10-01' }), {
    status: '2',
    sort: 'createdDesc',
    startDate: '2026-10-01',
    endDate: '',
  })
})
