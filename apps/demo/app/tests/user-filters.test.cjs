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
  const { datePreset, validateDateRange } = loadTs('src/pages/system/user/filters.ts')
  assert.deepEqual(datePreset('7', new Date(2026, 9, 11, 12)), {
    startDate: '2026-10-05',
    endDate: '2026-10-11',
  })
  assert.deepEqual(datePreset('all'), { startDate: '', endDate: '' })
  assert.ok(validateDateRange('2026-10-11', '2026-10-01'))
  assert.ok(validateDateRange('2026-10-11', ''))
  assert.equal(validateDateRange('', ''), '')
  assert.equal(validateDateRange('2026-10-01', '2026-10-11'), '')
})
