import { afterEach, expect, it, vi } from 'vitest'
import { CustomerService } from '../services/customer.service.js'
import { CustomerRepository } from '../repositories/customer.repository.js'
import { buildListWhere } from '../repositories/customer.repository.js'
import { MySqlDialect } from 'drizzle-orm/mysql-core'
import { computeDataScope } from '../schemas/data-scope.js'

afterEach(() => vi.restoreAllMocks())
it.each([
  { id: 7, roleCodes: ['sales'], deptIds: [] },
  { id: 8, roleCodes: ['sales_lead'], deptIds: [10] },
  { id: 1, roleCodes: ['super_admin'], deptIds: [] },
])('forces private ownership before pagination for user $id despite client overrides', async (currentUser) => {
  const list = vi.spyOn(CustomerRepository, 'list').mockResolvedValue({ rows: [], total: 0 })
  vi.spyOn(CustomerRepository, 'findPrimaryContactsByCustomerIds').mockResolvedValue(new Map())
  vi.spyOn(CustomerRepository, 'findOwnerNamesByUserIds').mockResolvedValue(new Map())
  await new CustomerService().list({ query: { view: 'all', poolStatus: 'public', page: 2, pageSize: 10 }, currentUser })
  expect(list).toHaveBeenCalledWith(expect.objectContaining({ poolStatus: 'owned', requireOwner: true, currentUserId: currentUser.id, page: 2 }), undefined)
})

it('puts owner presence and the private domain in SQL alongside scope before limit/count', () => {
  const where = buildListWhere({ ...computeDataScope({ id: 7, roleCodes: ['sales'], deptIds: [] }), requireOwner: true, poolStatus: 'owned' })
  if (!where) throw new Error('Missing private where')
  const query = new MySqlDialect().sqlToQuery(where)
  expect(query.sql).toContain('`crm_customer`.`owner_user_id` is not null')
  expect(query.sql).toContain('`crm_customer`.`pool_status` = ?')
  expect(query.sql).toContain(' and ')
  expect(query.params).toContain('owned')
  expect(query.params).toContain(7)
})

it('keeps the dedicated pool query public even when the caller asks for owned', async () => {
  const list = vi.spyOn(CustomerRepository, 'list').mockResolvedValue({ rows: [], total: 0 })
  vi.spyOn(CustomerRepository, 'findPrimaryContactsByCustomerIds').mockResolvedValue(new Map())
  vi.spyOn(CustomerRepository, 'findOwnerNamesByUserIds').mockResolvedValue(new Map())
  await new CustomerService().listPool({ query: { poolStatus: 'owned' }, currentUser: { id: 7 } })
  expect(list).toHaveBeenCalledWith(expect.objectContaining({ poolStatus: 'public', requireOwner: false }), undefined)
})

it('derives owner filter capability from scope and visible collaboration owners', async () => {
  const owners = vi.spyOn(CustomerRepository, 'findVisibleOwners').mockResolvedValue([{ id: 7, name: '本人' }])
  const service = new CustomerService()
  expect((await service.listOptions({ id: 7 })).canFilterOwners).toBe(false)
  expect((await service.listOptions({ id: 7, roleCodes: ['sales_lead'], deptIds: [10] })).canFilterOwners).toBe(true)
  expect((await service.listOptions({ id: 1, roleCodes: ['super_admin'] })).canFilterOwners).toBe(true)
  owners.mockResolvedValue([{ id: 7, name: '本人' }, { id: 8, name: '协同客户负责人' }])
  expect((await service.listOptions({ id: 7 })).canFilterOwners).toBe(true)
  expect(owners).toHaveBeenLastCalledWith(expect.objectContaining({ ownerUserIds: [7], collaboratorUserId: 7 }), undefined)
})
