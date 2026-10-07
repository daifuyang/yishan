import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { dbManager } from '@/db'
import { QuotationService } from '../services/quotation.service.js'
import { ActivityRepository } from '../repositories/activity.repository.js'
import { QuotationRepository, type QuotationRow, type QuotationShareRow } from '../repositories/quotation.repository.js'
import { OpportunityRepository } from '../repositories/opportunity.repository.js'
import { CustomerRepository } from '../repositories/customer.repository.js'
import { ContactRepository } from '../repositories/contact.repository.js'
import { OpportunityService } from '../services/opportunity.service.js'
import { PublicQuoteSchema } from '../schemas/quotation.schema.js'

const user = { id: 7, roleCodes: ['super_admin'], deptIds: [10] }
const quote: QuotationRow = {
  id: 1, quotationNo: 'Q-20261010-0001', name: '禾味餐饮 CRM 数字化项目第一版报价', version: 1, rootQuoteId: 1, sourceQuoteId: null,
  customerId: 100, customerName: '上海禾味餐饮管理有限公司', opportunityId: 200, opportunityName: '禾味餐饮 CRM 数字化项目', contactId: 15, contactName: '张明远',
  ownerUserId: 7, ownerUserName: '销售', ownerDepartmentId: 10, status: 'draft', quoteDate: new Date('2026-10-10T00:00:00Z'), validUntil: new Date('2026-10-17T00:00:00Z'),
  netCents: 7000000, taxCents: 0, totalCents: 6600000, discountAmountCents: 400000, remark: '报价说明', creatorId: 7, createdAt: new Date(), updaterId: 7, updatedAt: new Date(), sentAt: null, acceptedAt: null, closedAt: null,
}

const existingShare: QuotationShareRow = {
  id: 9, quotationId: 1, tokenHash: 'a'.repeat(64), status: 'active',
  expiresAt: new Date('2099-10-17T15:59:59Z'), durationDays: 7,
  followQuoteValidUntil: 0, createdAt: new Date(), createdBy: 7,
  sentAt: new Date(), firstViewedAt: new Date(), lastViewedAt: new Date(),
  viewCount: 9, revokedAt: null, updatedAt: new Date(),
}

beforeEach(() => vi.clearAllMocks())
afterEach(() => vi.restoreAllMocks())

describe('报价公开分享', () => {
  it.each(['active', 'revoked', 'expired', 'tampered'] as const)('retrieves an existing share URL without mutation and respects %s access', async (state) => {
    const share = { ...existingShare,
      ...(state === 'revoked' ? { status: 'revoked' as const, revokedAt: new Date() } : {}),
      ...(state === 'expired' ? { expiresAt: new Date('2020-01-01') } : {}),
    }
    vi.spyOn(QuotationRepository, 'findById').mockResolvedValue(quote)
    vi.spyOn(QuotationRepository, 'listItemsByQuotationId').mockResolvedValue([])
    vi.spyOn(QuotationRepository, 'findLatestShare').mockResolvedValue(share)
    const create = vi.spyOn(QuotationRepository, 'createShare')
    const activity = vi.spyOn(ActivityRepository, 'create')
    const update = vi.spyOn(QuotationRepository, 'updateShare').mockResolvedValue({ ...share, viewCount: 10 })
    const service = new QuotationService()
    const first = await service.findDetailById(1, user)
    const second = await new QuotationService().findDetailById(1, user)
    const url = (first.share as QuotationShareRow & { url?: string })?.url
    expect(url).toMatch(/^\/q\/.+/)
    expect((second.share as QuotationShareRow & { url?: string })?.url).toBe(url)
    expect(url).not.toContain(share.tokenHash)
    expect(create).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
    expect(activity).not.toHaveBeenCalled()
    if (!url) throw new Error('missing share URL')
    vi.spyOn(QuotationRepository, 'findShareById').mockResolvedValue(share)
    vi.spyOn(QuotationRepository, 'findDetailById').mockResolvedValue({ head: { ...quote, status: 'sent' }, items: [] })
    vi.spyOn(dbManager, 'transaction').mockImplementation(async (callback) => callback({} as never))
    const token = url.slice('/q/'.length)
    const altered = token.slice(0, -1) + (token.endsWith('A') ? 'B' : 'A')
    const result = await service.publicQuote(state === 'tampered' ? altered : token)
    expect(result.state).toBe(state === 'active' ? 'ok' : state === 'tampered' ? 'invalid' : state)
    expect(create).not.toHaveBeenCalled()
    if (state !== 'active') expect(update).not.toHaveBeenCalled()
  })
  it.each(['update', 'delete'])('a previously shared draft cannot %s even after the share is revoked', async (action) => {
    vi.spyOn(dbManager, 'transaction').mockImplementation(async (callback) => callback({} as never))
    vi.spyOn(QuotationRepository, 'findByIdWithLock').mockResolvedValue({ ...quote, hasShare: true })
    const update = vi.spyOn(QuotationRepository, 'update')
    const remove = vi.spyOn(QuotationRepository, 'softDelete')
    const service = new QuotationService()
    await expect(action === 'update' ? service.updateDraft(1, { name: '篡改' }, user) : service.softDelete(1, user)).rejects.toThrow('已生成分享链接')
    expect(update).not.toHaveBeenCalled()
    expect(remove).not.toHaveBeenCalled()
  })
  it('internal preview uses the public whitelist without recording customer views or activities', async () => {
    vi.spyOn(QuotationRepository, 'findById').mockResolvedValue({ ...quote, publicDiscountDescription: '首期合作优惠', internalDiscountReason: '内部竞争性报价原因' })
    vi.spyOn(QuotationRepository, 'listItemsByQuotationId').mockResolvedValue([])
    const update = vi.spyOn(QuotationRepository, 'updateShare')
    const activity = vi.spyOn(ActivityRepository, 'create')
    const transaction = vi.spyOn(dbManager, 'transaction')
    const result = await new QuotationService().previewQuote(1, user)
    expect(result.quoteTitle).toBe(quote.name)
    expect(result.publicDiscountDescription).toBe('首期合作优惠')
    expect(result).not.toHaveProperty('internalDiscountReason')
    expect(JSON.stringify(result)).not.toContain('内部竞争性报价原因')
    expect(update).not.toHaveBeenCalled()
    expect(activity).not.toHaveBeenCalled()
    expect(transaction).not.toHaveBeenCalled()
  })
  it('internal preview enforces quotation data scope', async () => {
    vi.spyOn(QuotationRepository, 'findById').mockResolvedValue(quote)
    const items = vi.spyOn(QuotationRepository, 'listItemsByQuotationId')
    await expect(new QuotationService().previewQuote(1, { id: 99, roleCodes: [], deptIds: [] })).rejects.toThrow()
    expect(items).not.toHaveBeenCalled()
  })
  it('replaces a link within one transaction without changing the quote or opportunity', async () => {
    const tx = {} as Parameters<Parameters<typeof dbManager.transaction>[0]>[0]
    vi.spyOn(dbManager, 'transaction').mockImplementation(async (callback) => callback(tx))
    vi.spyOn(QuotationRepository, 'findById').mockResolvedValue(quote)
    vi.spyOn(QuotationRepository, 'findByIdWithLock').mockResolvedValue(quote)
    vi.spyOn(QuotationRepository, 'findShareById').mockResolvedValue({ id: 8, quotationId: 1, status: 'active' } as never)
    vi.spyOn(QuotationRepository, 'findLatestShare').mockResolvedValue({ id: 8 } as never)
    vi.spyOn(QuotationRepository, 'updateShare').mockResolvedValue({ id: 8 } as never)
    vi.spyOn(QuotationRepository, 'createShare').mockResolvedValue(existingShare)
    vi.spyOn(ActivityRepository, 'create').mockResolvedValue({ id: 1 } as never)
    await new QuotationService().createShare(1, { durationDays: 7, replaceShareId: 8 }, user)
    expect(QuotationRepository.updateShare).toHaveBeenCalledWith(8, expect.objectContaining({ status: 'revoked' }), tx)
    expect(QuotationRepository.createShare).toHaveBeenCalledWith(expect.anything(), tx)
    expect(ActivityRepository.create).toHaveBeenCalledWith(expect.objectContaining({ type: 'quote_share_revoked' }), tx)
  })
  it('rejects replacing another quotation share before any mutation', async () => {
    vi.spyOn(dbManager, 'transaction').mockImplementation(async (callback) => callback({} as never))
    vi.spyOn(QuotationRepository, 'findById').mockResolvedValue(quote)
    vi.spyOn(QuotationRepository, 'findByIdWithLock').mockResolvedValue(quote)
    vi.spyOn(QuotationRepository, 'findShareById').mockResolvedValue({ id: 8, quotationId: 99, status: 'active' } as never)
    const create = vi.spyOn(QuotationRepository, 'createShare')
    await expect(new QuotationService().createShare(1, { replaceShareId: 8 }, user)).rejects.toThrow('分享链接不存在')
    expect(create).not.toHaveBeenCalled()
  })
  it('rolls back both link changes when replacement fails', async () => {
    let oldStatus = 'active'
    let created = false
    vi.spyOn(dbManager, 'transaction').mockImplementation(async (callback) => {
      try { return await callback({} as never) } catch (error) { oldStatus = 'active'; created = false; throw error }
    })
    vi.spyOn(QuotationRepository, 'findByIdWithLock').mockResolvedValue(quote)
    vi.spyOn(QuotationRepository, 'findShareById').mockResolvedValue({ id: 8, quotationId: 1, status: 'active' } as never)
    vi.spyOn(QuotationRepository, 'findLatestShare').mockResolvedValue({ id: 8 } as never)
    vi.spyOn(QuotationRepository, 'createShare').mockImplementation(async () => { created = true; return { id: 9 } as never })
    vi.spyOn(QuotationRepository, 'updateShare').mockImplementation(async () => { oldStatus = 'revoked'; return { id: 8 } as never })
    vi.spyOn(ActivityRepository, 'create').mockRejectedValue(new Error('写入失败'))
    await expect(new QuotationService().createShare(1, { replaceShareId: 8 }, user)).rejects.toThrow('写入失败')
    expect(oldStatus).toBe('active')
    expect(created).toBe(false)
  })
  it('retains revoked share metadata in internal detail', async () => {
    vi.spyOn(QuotationRepository, 'findById').mockResolvedValue(quote)
    vi.spyOn(QuotationRepository, 'listItemsByQuotationId').mockResolvedValue([])
    vi.spyOn(QuotationRepository, 'findLatestShare').mockResolvedValue({ ...existingShare, id: 8, status: 'revoked' })
    const result = await new QuotationService().findDetailById(1, user)
    expect(result.share?.status).toBe('revoked')
  })
  it('creates a high entropy token but stores only a sha256 hash', async () => {
    vi.spyOn(dbManager, 'transaction').mockImplementation(async (callback) => callback({} as never))
    vi.spyOn(QuotationRepository, 'findById').mockResolvedValue(quote)
    vi.spyOn(QuotationRepository, 'findByIdWithLock').mockResolvedValue(quote)
    vi.spyOn(QuotationRepository, 'createShare').mockResolvedValue({
      id: 9, quotationId: 1, tokenHash: 'a'.repeat(64), status: 'active', expiresAt: new Date('2026-10-17T15:59:59.999Z'), durationDays: 7, followQuoteValidUntil: 0,
      createdAt: new Date(), createdBy: 7, sentAt: null, firstViewedAt: null, lastViewedAt: null, viewCount: 0, revokedAt: null, updatedAt: new Date(),
    })
    vi.spyOn(ActivityRepository, 'create').mockResolvedValue({ id: 1 } as never)
    const result = await new QuotationService().createShare(1, { durationDays: 7 }, user)
    const input = vi.mocked(QuotationRepository.createShare).mock.calls[0][0]
    expect(input.tokenHash).toMatch(/^[a-f0-9]{64}$/)
    expect(result.rawToken).toHaveLength(43)
    expect(result.rawToken).not.toBe(input.tokenHash)
    vi.spyOn(QuotationRepository, 'listItemsByQuotationId').mockResolvedValue([])
    vi.spyOn(QuotationRepository, 'findLatestShare').mockResolvedValue(result.share)
    const detail = await new QuotationService().findDetailById(1, user)
    expect((detail.share as QuotationShareRow & { url?: string })?.url).toBe(result.url)
    expect(input.expiresAt.getUTCHours()).toBe(15)
    expect(input.expiresAt.getUTCMinutes()).toBe(59)
    expect(input.expiresAt.getUTCSeconds()).toBe(59)
    expect(input.expiresAt.getUTCMilliseconds()).toBe(0)
  })

  it.each(['raw-token-value', `s1-${'a'.repeat(40)}`])('retains legacy token %s access and records one first-view activity', async (legacyToken) => {
    const share = { id: 9, quotationId: 1, tokenHash: 'a'.repeat(64), status: 'active' as const, expiresAt: new Date(Date.now() + 86400000), durationDays: 7, followQuoteValidUntil: 0, createdAt: new Date(), createdBy: 7, sentAt: new Date(), firstViewedAt: null, lastViewedAt: null, viewCount: 0, revokedAt: null, updatedAt: new Date() }
    const items = [{ id: 1, quotationId: 1, productId: null, productNameSnapshot: '标准 CRM 基础方案', description: '客户、联系人', unitSnapshot: '套', quantityCents: 10000, unitPriceCents: 3600000, discountBp: 0, taxRateBp: 0, lineAmountCents: 3600000, sortOrder: 0, createdAt: new Date(), updatedAt: new Date() }]
    vi.spyOn(QuotationRepository, 'findShareByTokenHash').mockResolvedValue(share)
    vi.spyOn(QuotationRepository, 'findDetailById').mockResolvedValue({ head: { ...quote, status: 'sent', publicDiscountDescription: '首期合作优惠', internalDiscountReason: '内部竞争性报价原因' }, items })
    vi.spyOn(dbManager, 'transaction').mockImplementation(async (callback) => callback({} as never))
    vi.spyOn(QuotationRepository, 'findShareById').mockResolvedValue(share)
    vi.spyOn(QuotationRepository, 'updateShare').mockResolvedValue({ ...share, firstViewedAt: new Date(), lastViewedAt: new Date(), viewCount: 1 })
    vi.spyOn(ActivityRepository, 'create').mockResolvedValue({ id: 1 } as never)
    const result = await new QuotationService().publicQuote(legacyToken)
    expect(result.state).toBe('ok')
    if (result.state !== 'ok') return
    expect(result.quote).toMatchObject({ companyName: quote.customerName, quoteTitle: quote.name, totalAmountCents: 6600000 })
    expect(result.quote).not.toHaveProperty('customerId')
    expect(result.quote.publicDiscountDescription).toBe('首期合作优惠')
    expect(result.quote).not.toHaveProperty('internalDiscountReason')
    expect(PublicQuoteSchema.properties).not.toHaveProperty('internalDiscountReason')
    expect(JSON.stringify(result)).not.toContain('内部竞争性报价原因')
    expect(result.quote.items[0]).not.toHaveProperty('productId')
    expect(vi.mocked(ActivityRepository.create).mock.calls).toHaveLength(1)
    expect(QuotationRepository.updateShare).toHaveBeenCalledWith(share.id, expect.objectContaining({ viewCount: 1, firstViewedAt: expect.any(Date), lastViewedAt: expect.any(Date) }), expect.anything())
  })

  it('uses the share expiry independently from the quotation validUntil', async () => {
    const share = { id: 9, quotationId: 1, tokenHash: 'a'.repeat(64), status: 'active' as const, expiresAt: new Date(Date.now() + 86400000), durationDays: 30, followQuoteValidUntil: 0, createdAt: new Date(), createdBy: 7, sentAt: new Date(), firstViewedAt: null, lastViewedAt: null, viewCount: 0, revokedAt: null, updatedAt: new Date() }
    const items = [{ id: 1, quotationId: 1, productId: null, productNameSnapshot: '项目', description: null, unitSnapshot: '项', quantityCents: 10000, unitPriceCents: 100, discountBp: 0, taxRateBp: 0, lineAmountCents: 100, sortOrder: 0, createdAt: new Date(), updatedAt: new Date() }]
    vi.spyOn(QuotationRepository, 'findShareByTokenHash').mockResolvedValue(share)
    vi.spyOn(QuotationRepository, 'findDetailById').mockResolvedValue({ head: { ...quote, status: 'sent', validUntil: new Date('2020-01-01T00:00:00Z') }, items })
    vi.spyOn(dbManager, 'transaction').mockImplementation(async (callback) => callback({} as never))
    vi.spyOn(QuotationRepository, 'findShareById').mockResolvedValue(share)
    vi.spyOn(QuotationRepository, 'updateShare').mockResolvedValue({ ...share, firstViewedAt: new Date(), lastViewedAt: new Date(), viewCount: 1 })
    vi.spyOn(ActivityRepository, 'create').mockResolvedValue({ id: 1 } as never)

    const result = await new QuotationService().publicQuote('raw-token-value')
    expect(result.state).toBe('ok')
  })

  it.each([
    ['revoked', { status: 'revoked' as const }],
    ['expired', { expiresAt: new Date('2020-01-01T00:00:00Z') }],
  ])('rejects %s links without exposing quote fields', async (_label, patch) => {
    const share = { id: 9, quotationId: 1, tokenHash: 'a'.repeat(64), status: 'active' as const, expiresAt: new Date(Date.now() + 86400000), durationDays: 7, followQuoteValidUntil: 0, createdAt: new Date(), createdBy: 7, sentAt: null, firstViewedAt: null, lastViewedAt: null, viewCount: 0, revokedAt: null, updatedAt: new Date(), ...patch }
    vi.spyOn(QuotationRepository, 'findShareByTokenHash').mockResolvedValue(share)
    const result = await new QuotationService().publicQuote('bad')
    expect(result.quote).toBeNull()
    expect(result.state).toBe(_label)
  })

  it.each(['solution', 'quotation', 'negotiation'] as const)('sends with an active share during %s without regressing the opportunity', async (stage) => {
    const draft = { ...quote }
    const share = { id: 9, quotationId: 1, tokenHash: 'a'.repeat(64), status: 'active' as const, expiresAt: new Date(Date.now() + 86400000), durationDays: 7, followQuoteValidUntil: 0, createdAt: new Date(), createdBy: 7, sentAt: null, firstViewedAt: null, lastViewedAt: null, viewCount: 0, revokedAt: null, updatedAt: new Date() }
    const item = { id: 1, quotationId: 1, productId: null, productNameSnapshot: '项目', description: null, unitSnapshot: '套', quantityCents: 10000, unitPriceCents: 1000, discountBp: 0, taxRateBp: 0, lineAmountCents: 1000, sortOrder: 0, createdAt: new Date(), updatedAt: new Date() }
    vi.spyOn(dbManager, 'transaction').mockImplementation(async (callback) => callback({} as never))
    vi.spyOn(QuotationRepository, 'findByIdWithLock').mockResolvedValue(draft)
    vi.spyOn(QuotationRepository, 'findShareById').mockResolvedValue(share)
    vi.spyOn(QuotationRepository, 'listItemsByQuotationId').mockResolvedValue([item])
    vi.spyOn(QuotationRepository, 'update').mockImplementation(async (_id, patch) => ({ ...draft, ...patch, status: 'sent' } as QuotationRow))
    vi.spyOn(QuotationRepository, 'updateShare').mockResolvedValue({ ...share, sentAt: new Date() })
    vi.spyOn(QuotationRepository, 'createStatusLog').mockResolvedValue()
    vi.spyOn(OpportunityRepository, 'findByIdWithLock').mockResolvedValue({ id: 200, customerId: 100, ownerId: 7, ownerDepartmentId: 10, stage, name: '商机' } as never)
    vi.spyOn(CustomerRepository, 'findById').mockResolvedValue({ id: 100 } as never)
    vi.spyOn(ContactRepository, 'findById').mockResolvedValue({ id: 15, customerId: 100 } as never)
    vi.spyOn(OpportunityService.prototype, 'advanceStage').mockResolvedValue({ stage: 'quotation' } as never)
    vi.spyOn(ActivityRepository, 'create').mockResolvedValue({ id: 1 } as never)
    const result = await new QuotationService().sendQuotationWithShare(1, 9, user)
    expect(result.head.status).toBe('sent')
    expect(QuotationRepository.updateShare).toHaveBeenCalledWith(9, expect.objectContaining({ sentAt: expect.any(Date) }), expect.anything())
    if (stage === 'solution') {
      expect(OpportunityService.prototype.advanceStage).toHaveBeenCalledWith(expect.objectContaining({ input: { toStage: 'quotation' } }))
    } else {
      expect(OpportunityService.prototype.advanceStage).not.toHaveBeenCalled()
    }
  })
})
