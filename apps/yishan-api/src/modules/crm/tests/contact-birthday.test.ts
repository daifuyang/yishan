import { afterEach, expect, it, vi } from 'vitest'
import { dbManager } from '@/db'
import { ContactService } from '../services/contact.service.js'
import { CustomerRepository } from '../repositories/customer.repository.js'
import { ContactRepository } from '../repositories/contact.repository.js'

afterEach(() => vi.restoreAllMocks())
it('converts API birthday strings before creating and updating contacts, and permits clearing', async () => {
  const tx = {} as any
  vi.spyOn(dbManager, 'transaction').mockImplementation(async (fn: any) => fn(tx))
  vi.spyOn(CustomerRepository, 'findById').mockResolvedValue({ id: 3 } as any)
  vi.spyOn(ContactRepository, 'findById').mockResolvedValue({ id: 8, customerId: 3 } as any)
  const create = vi.spyOn(ContactRepository, 'create').mockResolvedValue({ id: 8 } as any)
  const update = vi.spyOn(ContactRepository, 'update').mockResolvedValue({ id: 8 } as any)
  const service = new ContactService()
  const user = { id: 1, roleCodes: ['super_admin'], deptIds: [] }
  const birthday = '1990-01-15T00:00:00+08:00'
  await service.create({ customerId: 3, name: '陈明', birthday } as any, user)
  expect(create).toHaveBeenCalledWith(expect.objectContaining({ birthday: new Date(birthday) }), tx)
  await service.update(8, { birthday } as any, user)
  expect(update).toHaveBeenLastCalledWith(8, expect.objectContaining({ birthday: new Date(birthday) }), tx)
  await service.update(8, { birthday: null }, user)
  expect(update).toHaveBeenLastCalledWith(8, expect.objectContaining({ birthday: null }), tx)
})
