import { afterEach, beforeEach, describe, expect, it, vi } from '../../../../test/runtime-fixture'
import { computeLineAmountCents } from '@yishan/core-system-api/utils/money'
import { dbManager } from '@yishan/core-system-api/database'
import { QuotationService } from '../services/quotation.service.js'
import { QuotationRepository, type QuotationRow, type QuotationItemRow } from '../repositories/quotation.repository.js'
import { OpportunityRepository, type OpportunityRow } from '../repositories/opportunity.repository.js'
import { CustomerRepository } from '../repositories/customer.repository.js'
import { ContactRepository } from '../repositories/contact.repository.js'
import { ActivityRepository, type CreateActivityInput } from '../repositories/activity.repository.js'
import { CustomerLifecycleService } from '../services/customer-lifecycle.service.js'
import { Value } from '@sinclair/typebox/value'
import { QuotationCreateReqSchema } from '../schemas/quotation.schema.js'
import type { QuotationCreateReq } from '../schemas/quotation.schema.js'

const user = { id: 7, roleCodes: ['super_admin'], deptIds: [10] }
const date = new Date('2026-10-10T06:00:00Z')
const opportunity: OpportunityRow = {
  id: 200, opportunityNo: 'OPP-202610-0001', customerId: 100, customerName: '上海禾味餐饮管理有限公司', name: '禾味餐饮 CRM 数字化项目',
  primaryContactId: 15, ownerId: 8, ownerName: '愚公', ownerDepartmentId: 10, stage: 'solution',
  amountCents: 6000000, expectedCloseDate: new Date('2026-10-31'), sourceId: null, requirement: 'CRM',
  competition: null, nextAction: null, nextFollowUpAt: null, lastFollowUpAt: null, remark: null,
  lostReason: null, products: [], createdAt: date, updatedAt: date, stageEnteredAt: date,
  wonAt: null, lostAt: null, version: 1, creatorId: 7, updaterId: 7, deletedAt: null,
}
const input: QuotationCreateReq = {
  customerId: 100, opportunityId: 200, contactId: 15, name: '禾味餐饮 CRM 数字化项目第一版报价',
  quoteDate: '2026-10-10T00:00:00+08:00', validUntil: '2026-10-20T00:00:00+08:00', discountAmountCents: 400000,
  items: [36000, 12000, 18000, 4000].map((price, i) => ({
    productNameSnapshot: ['标准 CRM 基础方案', '40账号方案', '门店企业客户服务记录定制', '实施及数据初始化'][i],
    description: '项目描述', unitSnapshot: '项', quantityCents: 10000, unitPriceCents: price * 100,
  })),
}
let head: QuotationRow | null
let items: QuotationItemRow[]
let stage: OpportunityRow
let activities: CreateActivityInput[]
const tx = {} as Parameters<Parameters<typeof dbManager.transaction>[0]>[0]

beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(date)
  head = null; items = []; stage = { ...opportunity }; activities = []
  vi.spyOn(dbManager, 'transaction').mockImplementation(async (callback) => {
    const snapshot = structuredClone({ head, items, stage, activities })
    try { return await callback(tx) } catch (error) {
      head = snapshot.head; items = snapshot.items; stage = snapshot.stage; activities = snapshot.activities
      throw error
    }
  })
  vi.spyOn(OpportunityRepository, 'findById').mockImplementation(async () => ({ ...stage }))
  if ('findByIdWithLock' in OpportunityRepository) vi.spyOn(OpportunityRepository, 'findByIdWithLock').mockImplementation(async () => ({ ...stage }))
  vi.spyOn(OpportunityRepository, 'updateStage').mockImplementation(async (_id, next) => {
    stage = { ...stage, stage: next }; return stage
  })
  vi.spyOn(CustomerRepository, 'findById').mockResolvedValue({ id: 100, statusCode: 'potential' } as Awaited<ReturnType<typeof CustomerRepository.findById>>)
  vi.spyOn(ContactRepository, 'findById').mockResolvedValue({ id: 15, customerId: 100 } as Awaited<ReturnType<typeof ContactRepository.findById>>)
  vi.spyOn(CustomerLifecycleService, 'recalculate').mockResolvedValue('potential')
  vi.spyOn(ActivityRepository, 'create').mockImplementation(async (activity, db) => {
    expect(db).toBe(tx); activities.push(activity)
    return { id: activities.length } as Awaited<ReturnType<typeof ActivityRepository.create>>
  })
  vi.spyOn(QuotationRepository, 'countTodayByNoPrefix').mockResolvedValue(0)
  vi.spyOn(QuotationRepository, 'create').mockImplementation(async (data, db) => {
    expect(db).toBe(tx)
    head = { ...data, id: 1, version: 1, rootQuoteId: 1, sourceQuoteId: null, customerName: opportunity.customerName, opportunityName: opportunity.name,
      ownerDepartmentId: 10, contactName: '张明远', ownerUserName: '愚公', createdAt: date, updatedAt: date, sentAt: null, acceptedAt: null, closedAt: null,
    } as QuotationRow
    return { id: 1 }
  })
  vi.spyOn(QuotationRepository, 'replaceItems').mockImplementation(async (_id, data, db) => {
    expect(db).toBe(tx); items = data.map((item, i) => ({ ...item, unitSnapshot: item.unitSnapshot ?? null, id: i + 1, createdAt: date, updatedAt: date })); return items
  })
  vi.spyOn(QuotationRepository, 'findDetailById').mockImplementation(async () => head ? { head, items } : null)
  vi.spyOn(QuotationRepository, 'findByIdWithLock').mockImplementation(async () => head)
  vi.spyOn(QuotationRepository, 'listItemsByQuotationId').mockImplementation(async () => items)
  vi.spyOn(QuotationRepository, 'update').mockImplementation(async (_id, patch, db) => {
    expect(db).toBe(tx); if (head) head = { ...head, ...patch }; return head
  })
  vi.spyOn(QuotationRepository, 'createStatusLog').mockResolvedValue()
})
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })

describe('opportunity → quotation workflow', () => {
  it('stores public and internal discount explanations without advancing the opportunity', async () => {
    const result = await new QuotationService().createDraft({ ...input,
      publicDiscountDescription: ' 首期合作优惠 ',
      internalDiscountReason: ' 竞争性报价，用于推进首次合作 ',
    }, user)
    expect(result.head).toMatchObject({ publicDiscountDescription: '首期合作优惠', internalDiscountReason: '竞争性报价，用于推进首次合作', status: 'draft' })
    expect(stage.stage).toBe('solution')
  })
  it('clears hidden discount explanations when the amount becomes zero', async () => {
    const service = new QuotationService()
    await service.createDraft({ ...input, publicDiscountDescription: '首期合作优惠', internalDiscountReason: '竞争性报价' }, user)
    const result = await service.updateDraft(1, { discountAmountCents: 0 }, user)
    expect(result.head).toMatchObject({ discountAmountCents: 0, publicDiscountDescription: null, internalDiscountReason: null, totalCents: 7000000 })
  })
  it('preserves and updates draft explanations independently', async () => {
    const service = new QuotationService()
    await service.createDraft({ ...input, publicDiscountDescription: '首期合作优惠', internalDiscountReason: '竞争性报价' }, user)
    const result = await service.updateDraft(1, { internalDiscountReason: ' 首次合作 ' }, user)
    expect(result.head).toMatchObject({ publicDiscountDescription: '首期合作优惠', internalDiscountReason: '首次合作' })
  })
  it('creates a manual snapshot draft for ¥66,000 without advancing solution', async () => {
    const saved = await new QuotationService().createDraft(input, user)
    expect(saved.head).toMatchObject({ status: 'draft', version: 1, netCents: 7000000, discountAmountCents: 400000, totalCents: 6600000, ownerUserId: 8 })
    expect(saved.items.map(item => item.lineAmountCents)).toEqual([3600000, 1200000, 1800000, 400000])
    expect(saved.items[0]).toMatchObject({ productId: null, description: '项目描述' })
    expect(stage.stage).toBe('solution')
  })
  it('sends and advances with both business activities, then rejects a repeat', async () => {
    const service = new QuotationService(); await service.createDraft(input, user)
    const sent = await service.sendQuotation(1, user)
    expect(sent.head).toMatchObject({ status: 'sent', sentAt: date })
    expect(stage.stage).toBe('quotation')
    expect(activities.map(a => a.metadata?.eventType)).toEqual(expect.arrayContaining(['quote_sent', 'opportunity_stage_changed']))
    await expect(service.sendQuotation(1, user)).rejects.toThrow('已发送')
  })
  it('does not advance a quotation-stage opportunity twice', async () => {
    stage.stage = 'quotation'; const service = new QuotationService(); await service.createDraft(input, user)
    await service.sendQuotation(1, user)
    expect(stage.stage).toBe('quotation')
    expect(activities.filter(a => a.metadata?.eventType === 'opportunity_stage_changed')).toHaveLength(0)
  })
  it('rolls back quote, opportunity and activities if activity insertion fails', async () => {
    const service = new QuotationService(); await service.createDraft(input, user)
    vi.mocked(ActivityRepository.create).mockImplementationOnce(async () => { throw new Error('activity failed') })
    await expect(service.sendQuotation(1, user)).rejects.toThrow('activity failed')
    expect(head?.status).toBe('draft'); expect(stage.stage).toBe('solution')
    expect(activities.some(a => a.metadata?.eventType === 'quote_sent')).toBe(false)
  })
  it('rolls back the head if item insertion fails', async () => {
    vi.mocked(QuotationRepository.replaceItems).mockRejectedValueOnce(new Error('item failed'))
    await expect(new QuotationService().createDraft(input, user)).rejects.toThrow('item failed')
    expect(head).toBeNull(); expect(items).toHaveLength(0)
  })
  it('keeps teammate quotations visible and sendable to the department lead', async () => {
    const lead = { id: 7, roleCodes: ['sales_lead'], deptIds: [10] }
    const service = new QuotationService(); await service.createDraft(input, lead)
    vi.spyOn(QuotationRepository, 'findById').mockImplementation(async () => head)
    expect((await service.findDetailById(1, lead)).head.ownerUserId).toBe(8)
    expect((await service.sendQuotation(1, lead)).head.status).toBe('sent')
  })
  it('rejects a contact from another customer', async () => {
    vi.mocked(ContactRepository.findById).mockResolvedValue({ customerId: 999 } as Awaited<ReturnType<typeof ContactRepository.findById>>)
    await expect(new QuotationService().createDraft(input, user)).rejects.toThrow('联系人')
    expect(head).toBeNull()
  })
  it.each([-1, 7000001])('rejects invalid discount %s instead of clamping', async discountAmountCents => {
    await expect(new QuotationService().createDraft({ ...input, discountAmountCents }, user)).rejects.toThrow('优惠')
    expect(head).toBeNull()
  })
  it('rejects a negative line price', async () => {
    await expect(new QuotationService().createDraft({ ...input, items: [{ ...input.items[0], unitPriceCents: -1 }] }, user)).rejects.toThrow()
  })
  it('rejects invalid date order', async () => {
    await expect(new QuotationService().createDraft({ ...input, validUntil: '2026-10-09T00:00:00+08:00' }, user)).rejects.toThrow('有效期')
  })
  it('rejects expired sending and preserves draft', async () => {
    const service = new QuotationService(); await service.createDraft(input, user)
    vi.setSystemTime(new Date('2026-10-21T06:00:00Z'))
    await expect(service.sendQuotation(1, user)).rejects.toThrow('有效期')
    expect(head?.status).toBe('draft'); expect(stage.stage).toBe('solution')
  })
  it('refuses to send a zero total draft', async () => {
    const service = new QuotationService(); await service.createDraft({ ...input, discountAmountCents: 7000000 }, user)
    await expect(service.sendQuotation(1, user)).rejects.toThrow('金额')
    expect(head?.status).toBe('draft'); expect(stage.stage).toBe('solution')
  })
  it('revalidates customer contact on send', async () => {
    const service = new QuotationService(); await service.createDraft(input, user)
    vi.mocked(ContactRepository.findById).mockResolvedValue({ customerId: 999 } as Awaited<ReturnType<typeof ContactRepository.findById>>)
    await expect(service.sendQuotation(1, user)).rejects.toThrow('联系人')
    expect(head?.status).toBe('draft'); expect(stage.stage).toBe('solution')
  })
  it('rejects a quotation tied to a different customer opportunity', async () => {
    stage.customerId = 999
    await expect(new QuotationService().createDraft(input, user)).rejects.toThrow('关联')
    expect(head).toBeNull()
  })
  it('sends a revised quote while keeping the opportunity in negotiation', async () => {
    const service = new QuotationService(); await service.createDraft(input, user); stage.stage = 'negotiation'
    const result = await service.sendQuotation(1, user)
    expect(result.head.status).toBe('sent')
    expect(stage.stage).toBe('negotiation')
    expect(activities.filter(a => a.metadata?.eventType === 'opportunity_stage_changed')).toHaveLength(0)
  })
  it.each(['needs_confirmation', 'won', 'lost'] as const)('rejects sending during %s', async (currentStage) => {
    const service = new QuotationService(); await service.createDraft(input, user); stage.stage = currentStage
    await expect(service.sendQuotation(1, user)).rejects.toThrow('阶段')
    expect(head?.status).toBe('draft')
  })
})

it('rounds an exact half cent upwards without floating point error', () => {
  expect(computeLineAmountCents({ qty: 1450, unitPriceCents: 100, discountBp: 0, taxRateBp: 0 })).toBe(15)
})

it('rejects quotation names over 100 characters in the HTTP contract', () => {
  expect(Value.Check(QuotationCreateReqSchema.properties.name, '报'.repeat(101))).toBe(false)
})

it('limits public discount labels to 50 characters and internal reasons to 500', () => {
  expect(Value.Check(QuotationCreateReqSchema.properties.publicDiscountDescription, '优'.repeat(51))).toBe(false)
  expect(Value.Check(QuotationCreateReqSchema.properties.internalDiscountReason, '因'.repeat(501))).toBe(false)
})
