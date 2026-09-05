import { afterEach, expect, it, vi } from 'vitest'
import { dbManager } from '@/db'
import { ActivityService } from '../services/activity.service.js'
import { ActivityRepository } from '../repositories/activity.repository.js'
import { CustomerRepository } from '../repositories/customer.repository.js'

afterEach(() => vi.restoreAllMocks())
it('normalizes API follow-up dates for create/update while preserving explicit null', async () => {
  vi.spyOn(dbManager, 'transaction').mockImplementation(async (fn: any) => fn({}))
  vi.spyOn(CustomerRepository, 'findById').mockResolvedValue({ id: 3 } as any)
  vi.spyOn(CustomerRepository, 'update').mockResolvedValue({ id: 3 } as any)
  vi.spyOn(ActivityRepository, 'computeFollowUpState').mockResolvedValue({ lastFollowUpAt: null, nextFollowUpAt: null })
  vi.spyOn(ActivityRepository, 'listByCustomerId').mockResolvedValue([])
  vi.spyOn(ActivityRepository, 'findById').mockResolvedValue({ id: 8, customerId: 3 } as any)
  const create = vi.spyOn(ActivityRepository, 'create').mockResolvedValue({ id: 8 } as any)
  const update = vi.spyOn(ActivityRepository, 'update').mockResolvedValue({ id: 8 } as any)
  const input = { type: 'meeting', content: '模拟评审', occurredAt: '2026-09-04T10:00:00+08:00', nextFollowUpAt: '2026-09-07T10:00:00+08:00' }
  const user = { id: 1, roleCodes: ['super_admin'], deptIds: [] }
  const service = new ActivityService()
  await service.create(3, input as any, user)
  expect(create).toHaveBeenCalledWith(expect.objectContaining({ occurredAt: new Date(input.occurredAt), nextFollowUpAt: new Date(input.nextFollowUpAt) }), expect.anything())
  await service.update(8, input as any, user)
  expect(update).toHaveBeenLastCalledWith(8, expect.objectContaining({ occurredAt: new Date(input.occurredAt), nextFollowUpAt: new Date(input.nextFollowUpAt) }), expect.anything())
  await service.update(8, { nextFollowUpAt: null }, user)
  expect(update).toHaveBeenLastCalledWith(8, expect.objectContaining({ nextFollowUpAt: null }), expect.anything())
})
