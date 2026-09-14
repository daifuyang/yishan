import { afterEach, expect, it, vi } from 'vitest'
import { dbManager } from '@/db'
import { OpportunityService } from '../services/opportunity.service.js'
import { CustomerRepository } from '../repositories/customer.repository.js'
import { OpportunityRepository } from '../repositories/opportunity.repository.js'

const salesperson = { id: 7, roleCodes: ['sales'], deptIds: [10] }

afterEach(() => vi.restoreAllMocks())

it('moves the customer lifecycle to opportunity when an opportunity is created', async () => {
  vi.spyOn(dbManager, 'transaction').mockImplementation(async (callback: any) => callback({} as any))
  vi.spyOn(OpportunityRepository, 'create').mockResolvedValue({ id: 18 } as any)
  vi.spyOn(CustomerRepository, 'update').mockResolvedValue({ id: 11, statusCode: 'opportunity' } as any)

  await new OpportunityService().create({
    input: { name: 'Expansion', customerId: 11 },
    currentUser: salesperson,
  })

  expect(CustomerRepository.update).toHaveBeenCalledWith(
    11,
    expect.objectContaining({ statusCode: 'opportunity', updaterId: 7 }),
    expect.anything(),
  )
})
