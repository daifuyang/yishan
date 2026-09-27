import { afterEach, describe, expect, it, vi } from 'vitest'
import { dbManager } from '@/db'
import { OpportunityService } from '../services/opportunity.service.js'
import { OpportunityRepository } from '../repositories/opportunity.repository.js'
import { CustomerRepository } from '../repositories/customer.repository.js'
import { CustomerLifecycleService } from '../services/customer-lifecycle.service.js'
import { ActivityRepository } from '../repositories/activity.repository.js'
import { opportunityStageConfig } from '../schemas/opportunity.schema.js'

const user = { id: 7, roleCodes: ['super_admin'], deptIds: [10] }
const row = { id: 1, customerId: 100, name: 'CRM 20用户采购', primaryContactId: null, ownerId: 7, ownerName: '王磊', ownerDepartmentId: 10, stage: 'requirement', amountCents: 2_000_000, expectedCloseDate: new Date('2026-09-30'), requirement: null, nextAction: '提供正式方案和报价', nextFollowUpAt: new Date('2026-09-17T10:00:00Z'), remark: null, lostReason: null, products: [], createdAt: new Date(), updatedAt: new Date(), stageEnteredAt: new Date(), wonAt: null, lostAt: null, version: 1, creatorId: 7, updaterId: 7, deletedAt: null } as any

afterEach(() => vi.restoreAllMocks())
describe('OpportunityService canonical model', () => {
  it('creates product intents and customer activities in one transaction', async () => {
    vi.spyOn(dbManager, 'transaction').mockImplementation(async (callback: any) => callback({} as any))
    vi.spyOn(CustomerRepository, 'findById').mockResolvedValue({ id: 100, statusCode: 'following', relationshipStatus: 'following', ownerDepartmentId: 10 } as any)
    vi.spyOn(OpportunityRepository, 'create').mockResolvedValue(row)
    const intents = vi.spyOn(OpportunityRepository, 'replaceProductIntents').mockResolvedValue()
    vi.spyOn(OpportunityRepository, 'findById').mockResolvedValue(row)
    vi.spyOn(CustomerLifecycleService, 'recalculate').mockResolvedValue('opportunity')
    const activity = vi.spyOn(ActivityRepository, 'create').mockResolvedValue({} as any)
    await new OpportunityService().create({ input: { name: row.name, customerId: 100, ownerId: 7, expectedCloseDate: '2026-09-30T00:00:00.000Z', productIds: [3], nextAction: row.nextAction, nextFollowUpAt: '2026-09-17T10:00:00.000Z' }, currentUser: user })
    expect(intents).toHaveBeenCalledWith(1, [3], expect.anything())
    expect(activity).toHaveBeenCalledWith(expect.objectContaining({ metadata: expect.objectContaining({ eventType: 'opportunity_created' }) }), expect.anything())
    expect(activity).toHaveBeenCalledWith(expect.objectContaining({ metadata: expect.objectContaining({ eventType: 'customer_status_changed', from: 'following', to: 'opportunity' }) }), expect.anything())
  })
  it('creates an early opportunity without inventing amount or expected close date', async () => {
    vi.spyOn(dbManager, 'transaction').mockImplementation(async (callback: any) => callback({} as any))
    vi.spyOn(CustomerRepository, 'findById').mockResolvedValue({ id: 100, statusCode: 'following', relationshipStatus: 'following', ownerDepartmentId: 10 } as any)
    const create = vi.spyOn(OpportunityRepository, 'create').mockResolvedValue({ ...row, amountCents: null, expectedCloseDate: null })
    vi.spyOn(OpportunityRepository, 'replaceProductIntents').mockResolvedValue()
    vi.spyOn(OpportunityRepository, 'findById').mockResolvedValue({ ...row, amountCents: null, expectedCloseDate: null })
    vi.spyOn(CustomerLifecycleService, 'recalculate').mockResolvedValue('opportunity')
    vi.spyOn(ActivityRepository, 'create').mockResolvedValue({} as any)

    await new OpportunityService().create({ input: { name: 'CRM系统采购', customerId: 100, ownerId: 7, stage: 'requirement', nextAction: '确认用户数量和预算', nextFollowUpAt: '2026-09-17T10:00:00.000Z' }, currentUser: user })

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ amountCents: null, expectedCloseDate: null }), expect.anything())
  })
  it('derives probability solely from the shared stage configuration', () => expect(opportunityStageConfig.requirement.probability).toBe(20))
})
