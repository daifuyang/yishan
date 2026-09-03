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
})
