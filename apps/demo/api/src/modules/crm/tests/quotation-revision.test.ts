import { afterEach, beforeEach, describe, expect, it, vi } from '../../../../test/runtime-fixture'
import { dbManager } from '@yishan/core-system-api/database'
import { QuotationService } from '../services/quotation.service.js'
import { QuotationRepository, type QuotationRow, type QuotationItemRow } from '../repositories/quotation.repository.js'
import { ActivityRepository, type CreateActivityInput } from '../repositories/activity.repository.js'

const date = new Date('2026-10-07T17:00:00Z') // 上海业务日期为 10 月 8 日。
const user = { id: 7, roleCodes: ['super_admin'], deptIds: [] }
const source = {
  id: 1, rootQuoteId: 1, sourceQuoteId: null, version: 1,
  quotationNo: 'Q-20261006-0001', name: '禾味餐饮 CRM 数字化项目第一版报价',
  customerId: 23, customerName: '上海禾味餐饮管理有限公司', opportunityId: 1,
  opportunityName: '禾味餐饮 CRM 数字化项目', contactId: 15, contactName: '张明远',
  ownerUserId: 8, ownerUserName: '愚公', ownerDepartmentId: 10, status: 'sent',
  quoteDate: new Date('2026-10-01T16:00:00Z'), validUntil: new Date('2026-10-03T16:00:00Z'),
  netCents: 7000000, taxCents: 0, discountAmountCents: 400000, totalCents: 6600000,
  publicDiscountDescription: '首期合作优惠', internalDiscountReason: '竞争性报价', remark: '交付边界',
  creatorId: 8, updaterId: 8, createdAt: new Date('2026-10-01'), updatedAt: new Date('2026-10-01'),
  sentAt: new Date('2026-10-01'), acceptedAt: null, closedAt: null,
  hasShare: true, shareViewCount: 9, shareFirstViewedAt: new Date('2026-10-02'),
} satisfies QuotationRow & { rootQuoteId: number; sourceQuoteId: number | null }
const sourceItems: QuotationItemRow[] = [3600000, 1200000, 1800000, 400000].map((price, i) => ({
  id: i + 1, quotationId: 1, productId: i === 0 ? 10 : null,
  productNameSnapshot: ['标准 CRM 基础方案', '40账号方案', '门店企业客户服务记录定制', '实施及数据初始化'][i],
  description: '完整历史描述', quantityCents: 10000, unitSnapshot: i === 0 ? '套' : '项',
  unitPriceCents: price, lineAmountCents: price, discountBp: 0, taxRateBp: 0, sortOrder: i,
  createdAt: source.createdAt, updatedAt: source.updatedAt,
}))
let quotes: Map<number, QuotationRow>
let items: Map<number, QuotationItemRow[]>
let activities: CreateActivityInput[]
const tx = {} as Parameters<Parameters<typeof dbManager.transaction>[0]>[0]

beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(date)
  quotes = new Map([[1, structuredClone(source)]]); items = new Map([[1, structuredClone(sourceItems)]]); activities = []
  vi.spyOn(dbManager, 'transaction').mockImplementation(async callback => {
    const snapshot = structuredClone({ quotes, items, activities })
    try { return await callback(tx) } catch (error) {
      quotes = snapshot.quotes; items = snapshot.items; activities = snapshot.activities; throw error
    }
  })
  vi.spyOn(QuotationRepository, 'findById').mockImplementation(async id => quotes.get(id) ?? null)
  vi.spyOn(QuotationRepository, 'findByIdWithLock').mockImplementation(async id => quotes.get(id) ?? null)
  vi.spyOn(QuotationRepository, 'maxVersionWithLock').mockResolvedValue(1)
  vi.spyOn(QuotationRepository, 'listItemsByQuotationId').mockImplementation(async id => items.get(id) ?? [])
  vi.spyOn(QuotationRepository, 'findDetailById').mockImplementation(async id => {
    const head = quotes.get(id); return head ? { head, items: items.get(id) ?? [] } : null
  })
  vi.spyOn(QuotationRepository, 'create').mockImplementation(async data => {
    const id = quotes.size + 1
    quotes.set(id, { ...source, ...data, id, sentAt: null, acceptedAt: null, closedAt: null,
      createdAt: date, updatedAt: date, hasShare: false, shareViewCount: 0, shareFirstViewedAt: null })
    return { id }
  })
  vi.spyOn(QuotationRepository, 'replaceItems').mockImplementation(async (id, values) => {
    const saved = values.map((item, i) => ({ ...item, id: 100 + i, unitSnapshot: item.unitSnapshot ?? null, createdAt: date, updatedAt: date }))
    items.set(id, saved); return saved
  })
  vi.spyOn(ActivityRepository, 'create').mockImplementation(async value => {
    activities.push(value); return { id: 100 } as Awaited<ReturnType<typeof ActivityRepository.create>>
  })
})
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })

describe('quotation revisions', () => {
  it.each(['sent', 'accepted'] as const)('copies an immutable %s snapshot into an independent editable V2 draft', async status => {
    quotes.set(1, { ...source, status })
    const result = await new QuotationService().reviseQuotation(1, user)
    expect(result.head).toMatchObject({
      id: 2, version: 2, rootQuoteId: 1, sourceQuoteId: 1,
      name: '禾味餐饮 CRM 数字化项目报价', quotationNo: 'Q-20261006-0001-R2',
      customerId: 23, opportunityId: 1, contactId: 15, ownerUserId: 8,
      status: 'draft', sentAt: null, acceptedAt: null, closedAt: null, hasShare: false,
      netCents: 7000000, discountAmountCents: 400000, totalCents: 6600000,
      publicDiscountDescription: '首期合作优惠', internalDiscountReason: '竞争性报价', remark: '交付边界',
      quoteDate: new Date('2026-10-07T16:00:00Z'), validUntil: new Date('2026-10-14T16:00:00Z'),
    })
    expect(result.share).toBeNull()
    expect(result.items.map(({ id, quotationId, createdAt, updatedAt, ...snapshot }) => snapshot))
      .toEqual(sourceItems.map(({ id, quotationId, createdAt, updatedAt, ...snapshot }) => snapshot))
    expect(result.items.every(item => item.quotationId === 2)).toBe(true)
    expect(quotes.get(1)).toEqual({ ...source, status })
    expect(items.get(1)).toEqual(sourceItems)
    expect(activities).toHaveLength(1)
    expect(activities[0]).toMatchObject({ type: 'quote_version_created', metadata: { sourceQuoteId: 1, rootQuoteId: 1, fromVersion: 1, version: 2 } })
  })
  it('uses the series maximum even when revising V1 again, including deleted versions', async () => {
    vi.spyOn(QuotationRepository, 'maxVersionWithLock').mockResolvedValue(3)
    const result = await new QuotationService().reviseQuotation(1, user)
    expect(result.head).toMatchObject({ version: 4, sourceQuoteId: 1, rootQuoteId: 1, quotationNo: 'Q-20261006-0001-R4', name: '禾味餐饮 CRM 数字化项目报价' })
  })
  it('creates V3 from confirmed V2 without changing its confirmation or content', async () => {
    const confirmed: QuotationRow = { ...source, id: 2, version: 2, sourceQuoteId: 1, status: 'accepted', acceptedAt: date, acceptedBy: 7 }
    quotes.set(2, confirmed)
    items.set(2, sourceItems.map(item => ({ ...item, quotationId: 2 })))
    vi.mocked(QuotationRepository.maxVersionWithLock).mockResolvedValue(2)
    const result = await new QuotationService().reviseQuotation(2, user)
    expect(result.head).toMatchObject({ id: 3, version: 3, sourceQuoteId: 2, rootQuoteId: 1, status: 'draft', acceptedAt: null, hasShare: false, totalCents: confirmed.totalCents })
    expect(quotes.get(2)).toEqual(confirmed)
    expect(result.items).toHaveLength(sourceItems.length)
  })
  it('rolls back the new version and its activity if copying items fails', async () => {
    vi.spyOn(QuotationRepository, 'maxVersionWithLock').mockResolvedValue(1)
    vi.mocked(QuotationRepository.replaceItems).mockRejectedValueOnce(new Error('copy failed'))
    await expect(new QuotationService().reviseQuotation(1, user)).rejects.toThrow('copy failed')
    expect([...quotes.keys()]).toEqual([1]); expect(activities).toHaveLength(0)
  })
  it('rejects unpublished drafts and quotations outside the user data scope', async () => {
    quotes.set(1, { ...source, status: 'draft', hasShare: false })
    await expect(new QuotationService().reviseQuotation(1, user)).rejects.toThrow('草稿')
    quotes.set(1, { ...source, status: 'draft', hasShare: true })
    await expect(new QuotationService().reviseQuotation(1, user)).rejects.toThrow('草稿')
    quotes.set(1, { ...source })
    await expect(new QuotationService().reviseQuotation(1, { id: 99, roleCodes: ['sales'], deptIds: [] })).rejects.toThrow('无权')
  })
})
