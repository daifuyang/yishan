import { afterEach, describe, expect, it, vi } from '../../../../test/runtime-fixture'
import { dbManager } from '@yishan/core-system-api/database'
import { OpportunityService } from '../services/opportunity.service.js'
import { OpportunityRepository } from '../repositories/opportunity.repository.js'
import { CustomerRepository } from '../repositories/customer.repository.js'
import { CustomerLifecycleService } from '../services/customer-lifecycle.service.js'
import { ActivityRepository } from '../repositories/activity.repository.js'
import { SourceRepository } from '../repositories/source.repository.js'
import { opportunityStageConfig } from '../schemas/opportunity.schema.js'
import { BusinessNumberRepository } from '../repositories/business-number.repository.js'

const user = { id: 7, roleCodes: ['super_admin'], deptIds: [10] }
const row = { id: 1, customerId: 100, customerName: '上海禾味餐饮管理有限公司', name: 'CRM 20用户采购', primaryContactId: null, ownerId: 7, ownerName: '王磊', ownerDepartmentId: 10, stage: 'needs_confirmation', amountCents: 2_000_000, expectedCloseDate: new Date('2026-09-30'), sourceId: 2, requirement: '统一客户资料与销售跟进', competition: null, nextAction: '提供正式方案和报价', nextFollowUpAt: new Date('2026-09-17T10:00:00Z'), lastFollowUpAt: null, remark: null, lostReason: null, products: [], createdAt: new Date(), updatedAt: new Date(), stageEnteredAt: new Date(), wonAt: null, lostAt: null, version: 1, creatorId: 7, updaterId: 7, deletedAt: null } as any

afterEach(() => vi.restoreAllMocks())
describe('OpportunityService canonical model', () => {
  it('saves and clears source and competition fields during editing', async () => {
    vi.spyOn(dbManager, 'transaction').mockImplementation(async (callback) => callback({} as Parameters<Parameters<typeof dbManager.transaction>[0]>[0]))
    vi.spyOn(OpportunityRepository, 'findById').mockResolvedValue(row)
    vi.spyOn(SourceRepository, 'findById').mockResolvedValue({ id: 3 } as NonNullable<Awaited<ReturnType<typeof SourceRepository.findById>>>)
    const update = vi.spyOn(OpportunityRepository, 'update').mockResolvedValue(row)
    vi.spyOn(ActivityRepository, 'create').mockResolvedValue({ id: 1 } as Awaited<ReturnType<typeof ActivityRepository.create>>)
    const service = new OpportunityService()
    await service.update({ id: 1, input: { sourceId: 3, competition: '  竞品方案  ' }, currentUser: user })
    expect(update).toHaveBeenLastCalledWith(1, expect.objectContaining({ sourceId: 3, competition: '竞品方案' }), expect.anything())
    await service.update({ id: 1, input: { sourceId: null, competition: null }, currentUser: user })
    expect(update).toHaveBeenLastCalledWith(1, expect.objectContaining({ sourceId: null, competition: null }), expect.anything())
  })
  it('creates product intents and customer activities in one transaction', async () => {
    vi.spyOn(BusinessNumberRepository, 'next').mockResolvedValue(1)
    vi.spyOn(dbManager, 'transaction').mockImplementation(async (callback: any) => callback({} as any))
    vi.spyOn(CustomerRepository, 'findById').mockResolvedValue({ id: 100, statusCode: 'potential', relationshipStatus: 'potential', ownerDepartmentId: 10, sourceId: 2 } as any)
    vi.spyOn(SourceRepository, 'findById').mockResolvedValue({ id: 2 } as any)
    vi.spyOn(OpportunityRepository, 'create').mockResolvedValue(row)
    const intents = vi.spyOn(OpportunityRepository, 'replaceProductIntents').mockResolvedValue()
    vi.spyOn(OpportunityRepository, 'findById').mockResolvedValue(row)
    vi.spyOn(CustomerLifecycleService, 'recalculate').mockResolvedValue('potential')
    const activity = vi.spyOn(ActivityRepository, 'create').mockResolvedValue({} as any)
    await new OpportunityService().create({ input: { name: row.name, customerId: 100, ownerId: 7, requirement: '统一客户资料与销售跟进', expectedCloseDate: '2026-09-30T00:00:00.000Z', productIds: [3], nextAction: row.nextAction, nextFollowUpAt: '2026-09-17T10:00:00.000Z' }, currentUser: user })
    expect(intents).toHaveBeenCalledWith(1, [3], expect.anything())
    expect(activity).toHaveBeenCalledWith(expect.objectContaining({
      category: 'business',
      type: 'opportunity_created',
      metadata: expect.objectContaining({ eventType: 'opportunity_created' }),
    }), expect.anything())
    expect(activity).not.toHaveBeenCalledWith(expect.objectContaining({ metadata: expect.objectContaining({ eventType: 'customer_status_changed' }) }), expect.anything())
  })
  it('creates an early opportunity without inventing amount or expected close date', async () => {
    vi.spyOn(BusinessNumberRepository, 'next').mockResolvedValue(1)
    vi.spyOn(dbManager, 'transaction').mockImplementation(async (callback: any) => callback({} as any))
    vi.spyOn(CustomerRepository, 'findById').mockResolvedValue({ id: 100, statusCode: 'potential', relationshipStatus: 'potential', ownerDepartmentId: 10, sourceId: null } as any)
    const create = vi.spyOn(OpportunityRepository, 'create').mockResolvedValue({ ...row, amountCents: null, expectedCloseDate: null })
    vi.spyOn(OpportunityRepository, 'replaceProductIntents').mockResolvedValue()
    vi.spyOn(OpportunityRepository, 'findById').mockResolvedValue({ ...row, amountCents: null, expectedCloseDate: null })
    vi.spyOn(CustomerLifecycleService, 'recalculate').mockResolvedValue('potential')
    vi.spyOn(ActivityRepository, 'create').mockResolvedValue({} as any)

    await new OpportunityService().create({ input: { name: 'CRM系统采购', customerId: 100, ownerId: 7, stage: 'needs_confirmation', requirement: '确认用户数量和预算', nextAction: '确认用户数量和预算', nextFollowUpAt: '2026-09-17T10:00:00.000Z' }, currentUser: user })

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ amountCents: null, expectedCloseDate: null }), expect.anything())
  })
  it('derives probability solely from the shared stage configuration', () => expect(opportunityStageConfig.needs_confirmation.probability).toBe(20))
  it('assigns a stable business number during creation', async () => {
    vi.spyOn(BusinessNumberRepository, 'next').mockResolvedValue(1)
    vi.spyOn(dbManager, 'transaction').mockImplementation(async (callback: any) => callback({} as any))
    vi.spyOn(CustomerRepository, 'findById').mockResolvedValue({ id: 100, statusCode: 'potential', ownerDepartmentId: 10, sourceId: null } as any)
    const create = vi.spyOn(OpportunityRepository, 'create').mockResolvedValue(row)
    vi.spyOn(OpportunityRepository, 'replaceProductIntents').mockResolvedValue()
    vi.spyOn(OpportunityRepository, 'findById').mockResolvedValue(row)
    vi.spyOn(CustomerLifecycleService, 'recalculate').mockResolvedValue('potential')
    vi.spyOn(ActivityRepository, 'create').mockResolvedValue({} as any)
    await new OpportunityService().create({ input: { name: row.name, customerId: 100, ownerId: 7, requirement: '需求' }, currentUser: user })
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ opportunityNo: expect.stringMatching(/^OPP-\d{6}-0001$/) }), expect.anything())
  })
  it('advances the same opportunity and records the stage history without creating another', async () => {
    vi.spyOn(dbManager, 'transaction').mockImplementation(async (callback: any) => callback({} as any))
    vi.spyOn(OpportunityRepository, 'findByIdWithLock').mockResolvedValue({ ...row, stage: 'quotation' })
    vi.spyOn(OpportunityRepository, 'updateStage').mockResolvedValue({ ...row, stage: 'negotiation' })
    const create = vi.spyOn(OpportunityRepository, 'create')
    vi.spyOn(CustomerRepository, 'findById').mockResolvedValue({ statusCode: 'potential' } as any)
    vi.spyOn(CustomerLifecycleService, 'recalculate').mockResolvedValue('potential')
    const activity = vi.spyOn(ActivityRepository, 'create').mockResolvedValue({} as any)
    const updated = await new OpportunityService().advanceStage({ id: 1, input: { toStage: 'negotiation' }, currentUser: user })
    expect(updated).toMatchObject({ id: 1, stage: 'negotiation' })
    expect(create).not.toHaveBeenCalled()
    expect(activity).toHaveBeenCalledWith(expect.objectContaining({ type: 'opportunity_stage_changed', metadata: expect.objectContaining({ opportunityId: 1, fromStage: 'quotation', toStage: 'negotiation' }) }), expect.anything())
  })
  it('warns for a normalized matching open opportunity without blocking independent creation', async () => {
    vi.spyOn(OpportunityRepository, 'findOpenByCustomerId').mockResolvedValue([{ ...row, name: 'CRM 20用户采购' }])
    const matches = await new OpportunityService().duplicateCandidates({ customerId: 100, name: ' crm　20用户采购 ', currentUser: user })
    expect(matches.map((item) => item.id)).toEqual([1])
    expect(OpportunityRepository.findOpenByCustomerId).toHaveBeenCalledWith(100)
  })
  it('replays a matching creation key without a second insert or activity', async () => {
    vi.spyOn(OpportunityRepository, 'findByCreationKey').mockResolvedValue(row)
    const create = vi.spyOn(OpportunityRepository, 'create')
    const activity = vi.spyOn(ActivityRepository, 'create')
    const saved = await new OpportunityService().create({ input: { name: row.name, customerId: 100, ownerId: 7, requirement: '需求', creationKey: 'a-unique-create-key' }, currentUser: user })
    expect(saved.id).toBe(1)
    expect(create).not.toHaveBeenCalled()
    expect(activity).not.toHaveBeenCalled()
  })
  it('retries a business number collision and creates one opportunity', async () => {
    vi.spyOn(BusinessNumberRepository, 'next').mockResolvedValue(1)
    vi.spyOn(dbManager, 'transaction').mockClear().mockRejectedValueOnce({ code: 'ER_DUP_ENTRY', sqlMessage: "Duplicate entry for key 'uniq_crm_opportunity_no'" }).mockImplementation(async (callback: any) => callback({} as any))
    vi.spyOn(CustomerRepository, 'findById').mockResolvedValue({ id: 100, statusCode: 'potential', ownerDepartmentId: 10, sourceId: null } as any)
    vi.spyOn(OpportunityRepository, 'create').mockResolvedValue(row)
    vi.spyOn(OpportunityRepository, 'replaceProductIntents').mockResolvedValue()
    vi.spyOn(OpportunityRepository, 'findById').mockResolvedValue(row)
    vi.spyOn(CustomerLifecycleService, 'recalculate').mockResolvedValue('potential')
    vi.spyOn(ActivityRepository, 'create').mockResolvedValue({} as any)
    await expect(new OpportunityService().create({ input: { name: row.name, customerId: 100, ownerId: 7, requirement: '需求' }, currentUser: user })).resolves.toMatchObject({ id: 1 })
    expect(dbManager.transaction).toHaveBeenCalledTimes(2)
  })
  it('returns the committed row when a concurrent retry hits the creation key', async () => {
    vi.spyOn(dbManager, 'transaction').mockRejectedValue({ code: 'ER_DUP_ENTRY', sqlMessage: 'uniq_crm_opportunity_creation_key' })
    vi.spyOn(OpportunityRepository, 'findByCreationKey').mockResolvedValue(row)
    await expect(new OpportunityService().create({ input: { name: row.name, customerId: 100, ownerId: 7, requirement: '需求', creationKey: 'same-key-123456' }, currentUser: user })).resolves.toMatchObject({ id: 1 })
  })
  it('does not replay an idempotency key for a different payload owner', async () => {
    vi.spyOn(OpportunityRepository, 'findByCreationKey').mockResolvedValue(row)
    await expect(new OpportunityService().create({ input: { name: row.name, customerId: 100, ownerId: 99, requirement: '需求', creationKey: 'same-key-123456' }, currentUser: { ...user, id: 8 } })).rejects.toThrow('创建请求幂等键已被使用')
  })
})
