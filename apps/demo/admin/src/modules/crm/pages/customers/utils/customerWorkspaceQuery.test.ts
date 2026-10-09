import {
  parseCustomerWorkspaceQuery,
  serializeCustomerWorkspaceQuery,
  toCustomerListQuery,
} from './customerWorkspaceQuery'

describe('customer workspace query codec', () => {
  it('preserves current list state and selected customer', () => {
    const state = parseCustomerWorkspaceQuery(
      '?view=mine&page=2&pageSize=20&keyword=%E4%B8%8A%E6%B5%B7&customerId=123',
    )

    expect(state).toMatchObject({
      view: 'mine',
      page: 2,
      pageSize: 20,
      keyword: '上海',
      customerId: 123,
    })
    expect(serializeCustomerWorkspaceQuery(state)).toContain('customerId=123')
  })

  it('uses safe defaults for invalid pagination and omits an absent selection', () => {
    const state = parseCustomerWorkspaceQuery('?view=unknown&page=0&pageSize=nope&customerId=-1')

    expect(state).toEqual({ view: 'all', page: 1, pageSize: 10 })
    expect(serializeCustomerWorkspaceQuery(state)).toBe('view=all&page=1&pageSize=10')
  })

  it('maps the important workspace view to the supported level filter', () => {
    expect(
      toCustomerListQuery({ view: 'important', page: 1, pageSize: 10 }),
    ).toMatchObject({ view: 'all', level: 'important' })
  })

  it('maps each UI-only filter to the customer API query names', () => {
    expect(
      toCustomerListQuery({
        view: 'all',
        page: 2,
        pageSize: 20,
        collaboratorUserId: 9,
        tagId: 12,
        createdAtFrom: '2026-09-01T00:00:00.000Z',
        createdAtTo: '2026-09-02T00:00:00.000Z',
        lastFollowUpAtFrom: '2026-09-03T00:00:00.000Z',
        lastFollowUpAtTo: '2026-09-04T00:00:00.000Z',
        nextFollowUpAtFrom: '2026-09-05T00:00:00.000Z',
        nextFollowUpAtTo: '2026-09-06T00:00:00.000Z',
      }),
    ).toEqual({
      view: 'all',
      page: 2,
      pageSize: 20,
      collaboratorId: 9,
      tagIds: [12],
      createdFrom: '2026-09-01T00:00:00.000Z',
      createdTo: '2026-09-02T00:00:00.000Z',
      lastFollowUpFrom: '2026-09-03T00:00:00.000Z',
      lastFollowUpTo: '2026-09-04T00:00:00.000Z',
      nextFollowUpFrom: '2026-09-05T00:00:00.000Z',
      nextFollowUpTo: '2026-09-06T00:00:00.000Z',
    })
  })

  it('omits URL values that would violate the customer API schema', () => {
    const tooLongKeyword = 'k'.repeat(101)
    const state = parseCustomerWorkspaceQuery(
      `?pageSize=201&keyword=${tooLongKeyword}&sortBy=id&sortOrder=sideways&type=partner&poolStatus=shared&createdAtFrom=not-a-date&createdAtTo=2026-15-99T00:00:00.000Z&lastFollowUpAtFrom=yesterday&lastFollowUpAtTo=2026-09-31T00:00:00.000Z&nextFollowUpAtFrom=tomorrow&nextFollowUpAtTo=invalid`,
    )

    expect(state).toEqual({ view: 'all', page: 1, pageSize: 10 })
  })

  it.each(['name', 'level'] as const)('preserves the supported %s server sort field', (sortBy) => {
    expect(parseCustomerWorkspaceQuery(`?sortBy=${sortBy}`)).toMatchObject({ sortBy })
  })
})
