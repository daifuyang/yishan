import { afterEach, expect, it, vi } from 'vitest'
import { CustomerRepository } from '../repositories/customer.repository.js'
import { CustomerService } from '../services/customer.service.js'

afterEach(() => vi.restoreAllMocks())

it('enriches only the visible page with owner and primary contact display fields', async () => {
  vi.spyOn(CustomerRepository, 'list').mockResolvedValue({ rows: [
    { id: 3, ownerUserId: 1 }, { id: 4, ownerUserId: 1 }, { id: 5, ownerUserId: null },
  ] as any, total: 30 })
  const contacts = vi.spyOn(CustomerRepository, 'findPrimaryContactsByCustomerIds').mockResolvedValue(
    new Map([[3, { id: 8, name: '陈明', mobile: '13800001001' }]]),
  )
  const owners = vi.spyOn(CustomerRepository, 'findOwnerNamesByUserIds').mockResolvedValue(new Map([[1, '愚公']]))
  const result = await new CustomerService().list({ query: { page: 2, pageSize: 3 }, currentUser: { id: 1, roleCodes: ['super_admin'], deptIds: [] } })
  expect(result.items[0]).toMatchObject({ ownerUserName: '愚公', primaryContactId: 8, primaryContactName: '陈明', primaryContactMobile: '13800001001' })
  expect(result.items[2]).toMatchObject({ ownerUserName: null, primaryContactName: null, primaryContactMobile: null })
  expect(contacts).toHaveBeenCalledWith([3, 4, 5], undefined)
  expect(owners).toHaveBeenCalledWith([1], undefined)
  expect(result).toMatchObject({ total: 30, page: 2, pageSize: 3 })
})
