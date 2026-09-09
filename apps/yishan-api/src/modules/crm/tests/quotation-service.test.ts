import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { dbManager } from '@/db'
import { Money, computeLineAmountCents } from '@/utils/money.js'
import { QuotationService } from '../services/quotation.service.js'
import { CrmErrorCode } from '../schemas/error-codes.js'
import {
  QuotationRepository,
  type QuotationItemRow,
  type QuotationListQuery,
  type QuotationRow,
} from '../repositories/quotation.repository.js'
import type { QuotationStatus } from '../schemas/quotation.schema.js'

const salesperson = { id: 7, roleCodes: ['sales'], deptIds: [10] }

afterEach(() => {
  vi.restoreAllMocks()
})

function buildQuotation(overrides: Partial<QuotationRow> = {}): QuotationRow {
  return {
    id: 1,
    quotationNo: 'Q-20260908-0001',
    version: 1,
    customerId: 100,
    customerName: '上海示例有限公司',
    opportunityId: 200,
    contactId: null,
    ownerUserId: salesperson.id,
    ownerUserName: '销售',
    status: 'draft',
    validUntil: null,
    netCents: 0,
    taxCents: 0,
    totalCents: 0,
    remark: null,
    creatorId: salesperson.id,
    createdAt: new Date(),
    updaterId: salesperson.id,
    updatedAt: new Date(),
    sentAt: null,
    acceptedAt: null,
    closedAt: null,
    ...overrides,
  }
}

function _buildQuotationItem(): QuotationItemRow {
  return {
    id: 1,
    quotationId: 1,
    productId: 1,
    productNameSnapshot: 'A',
    unitSnapshot: null,
    quantityCents: 10000,
    unitPriceCents: 1234,
    discountBp: 0,
    taxRateBp: 0,
    lineAmountCents: 1234,
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}
void _buildQuotationItem

describe('Money utility (报价金额预算精度)', () => {
  it('cents 加减无浮点误差', () => {
    expect(Money.sumCents([100, 200, 300])).toBe(600)
    expect(Money.yuanToCents(12.34)).toBe(1234)
    expect(Money.centsToYuan(1234)).toBe(12.34)
  })

  it('computeLineAmountCents: 1 件 × 12.34 元 × 9 折 × 13% 税', () => {
    // qty = 1 件 → quantityCents = 10000
    // unitPriceCents = 1234
    // discountBp = 1000 (10% off)
    // taxRateBp = 1300 (13%)
    const line = computeLineAmountCents({ qty: 10000, unitPriceCents: 1234, discountBp: 1000, taxRateBp: 1300 })
    // 1234 × 1 × 0.9 × 1.13 = 1234 × 1.017 = 1254.978 → 1255
    expect(line).toBe(1255)
  })

  it('computeLineAmountCents: 12.3456 件 × 100 元 × 0 折扣 × 0 税 = 123456 cents', () => {
    // qty = 12.3456 件 → quantityCents = 123456
    // unitPriceCents = 10000 (= 100.00 元)
    // discountBp = 0
    // taxRateBp = 0
    const line = computeLineAmountCents({ qty: 123456, unitPriceCents: 10000, discountBp: 0, taxRateBp: 0 })
    expect(line).toBe(Math.round(10000 * 123456 / 10000))
    expect(line).toBe(123456)
  })
})

describe('QuotationService.createDraft', () => {
  it('creates a draft quotation, computes totals from items, and binds owner = currentUser', async () => {
    vi.spyOn(dbManager, 'transaction').mockImplementation(async (callback: any) => callback({} as any))
    // countTodayByNoPrefix：今日已经 0 张
    vi.spyOn(QuotationRepository, 'countTodayByNoPrefix').mockResolvedValue(0)
    const createSpy = vi.spyOn(QuotationRepository, 'create').mockResolvedValue({ id: 99 })
    const replaceItems = vi.spyOn(QuotationRepository, 'replaceItems').mockResolvedValue([])
    vi.spyOn(QuotationRepository, 'findDetailById').mockResolvedValue({
      head: buildQuotation({
        id: 99,
        status: 'draft',
        netCents: 1110,
        taxCents: 144,
        totalCents: 1254,
      }),
      items: [],
    })

    const result = await new QuotationService().createDraft(
      {
        customerId: 100,
        items: [
          {
            productId: 1,
            productNameSnapshot: '示例产品 A',
            quantityCents: 10000, // 1 件
            unitPriceCents: 1234, // 12.34 元
            discountBp: 1000, // 9 折
            taxRateBp: 1300, // 13% 税
          },
        ],
      },
      salesperson,
    )

    expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({
      customerId: 100,
      ownerUserId: salesperson.id,
      creatorId: salesperson.id,
      updaterId: salesperson.id,
      status: 'draft',
    }))
    expect(replaceItems).toHaveBeenCalledTimes(1)
    expect(result.head.id).toBe(99)
    expect(result.head.status).toBe('draft')
  })

  it('rejects empty items', async () => {
    await expect(
      new QuotationService().createDraft(
        {
          customerId: 100,
          items: [],
        },
        salesperson,
      ),
    ).rejects.toMatchObject({ code: CrmErrorCode.CRM_QUOTATION_ITEMS_REQUIRED })
  })

  it('computes total = net + tax via lineAmount sum (consistency)', () => {
    // 直接观察 service 内部 computeItemsTotals 的结果：通过 createDraft 走一次完整路径
    vi.spyOn(dbManager, 'transaction').mockImplementation(async (callback: any) => callback({} as any))
    vi.spyOn(QuotationRepository, 'countTodayByNoPrefix').mockResolvedValue(0)
    const createSpy = vi.spyOn(QuotationRepository, 'create').mockResolvedValue({ id: 1 })
    vi.spyOn(QuotationRepository, 'replaceItems').mockResolvedValue([])
    vi.spyOn(QuotationRepository, 'findDetailById').mockResolvedValue({ head: buildQuotation(), items: [] })

    return new QuotationService().createDraft(
      {
        customerId: 1,
        items: [
          {
            productId: 1,
            productNameSnapshot: 'A',
            quantityCents: 10000,
            unitPriceCents: 10000, // 100.00 元
            discountBp: 0,
            taxRateBp: 1300,
          },
          {
            productId: 2,
            productNameSnapshot: 'B',
            quantityCents: 5000,
            unitPriceCents: 20000, // 200.00 元
            discountBp: 500,
            taxRateBp: 0,
          },
        ],
      },
      salesperson,
    ).then(() => {
      const args = createSpy.mock.calls[0]?.[0] as unknown as Record<string, unknown>
      // A: 10000 * 10000/10000 * 1 * 1.13 = 11300 cents
      // B: 20000 * 5000/10000 * 0.95 * 1 = 9500 cents
      // total = 11300 + 9500 = 20800
      expect(args.totalCents).toBe(20800)
      // net = 10000 + (20000 * 0.5 * 0.95) = 10000 + 9500 = 19500
      expect(args.netCents).toBe(19500)
      // tax = total - net = 1300
      expect(args.taxCents).toBe(1300)
    })
  })
})

describe('QuotationService.sendQuotation', () => {
  beforeEach(() => {
    vi.spyOn(dbManager, 'transaction').mockImplementation(async (callback: any) => callback({} as any))
  })

  it('refuses to send a sent quotation', async () => {
    vi.spyOn(QuotationRepository, 'findByIdWithLock').mockResolvedValue(buildQuotation({ status: 'sent' }))

    await expect(
      new QuotationService().sendQuotation(1, salesperson),
    ).rejects.toMatchObject({ code: CrmErrorCode.CRM_QUOTATION_ALREADY_SENT })
  })

  it('refuses to send a non-draft quotation (e.g. accepted)', async () => {
    vi.spyOn(QuotationRepository, 'findByIdWithLock').mockResolvedValue(buildQuotation({ status: 'accepted' }))

    await expect(
      new QuotationService().sendQuotation(1, salesperson),
    ).rejects.toMatchObject({ code: CrmErrorCode.CRM_QUOTATION_STATUS_INVALID })
  })

  it('refuses to send a draft with no items', async () => {
    vi.spyOn(QuotationRepository, 'findByIdWithLock').mockResolvedValue(buildQuotation({ status: 'draft' }))
    vi.spyOn(QuotationRepository, 'listItemsByQuotationId').mockResolvedValue([])

    await expect(
      new QuotationService().sendQuotation(1, salesperson),
    ).rejects.toMatchObject({ code: CrmErrorCode.CRM_QUOTATION_ITEMS_REQUIRED })
  })

  it('moves draft → sent and writes status log', async () => {
    vi.spyOn(QuotationRepository, 'findByIdWithLock').mockResolvedValue(buildQuotation({ status: 'draft' }))
    vi.spyOn(QuotationRepository, 'listItemsByQuotationId').mockResolvedValue([
      {
        id: 1,
        quotationId: 1,
        productId: 1,
        productNameSnapshot: 'A',
        unitSnapshot: null,
        quantityCents: 10000,
        unitPriceCents: 1234,
        discountBp: 0,
        taxRateBp: 0,
        lineAmountCents: 1234,
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ])
    const update = vi.spyOn(QuotationRepository, 'update').mockResolvedValue(
      buildQuotation({ status: 'sent', sentAt: new Date() }),
    )
    const log = vi.spyOn(QuotationRepository, 'createStatusLog').mockResolvedValue()

    await new QuotationService().sendQuotation(1, salesperson)

    expect(update).toHaveBeenCalledWith(1, expect.objectContaining({ status: 'sent' }), expect.anything())
    expect(log).toHaveBeenCalledWith(expect.objectContaining({
      fromStatus: 'draft',
      toStatus: 'sent',
      operatorUserId: salesperson.id,
    }), expect.anything())
  })
})

describe('QuotationService.updateDraft', () => {
  beforeEach(() => {
    vi.spyOn(dbManager, 'transaction').mockImplementation(async (callback: any) => callback({} as any))
  })

  it('refuses to edit a sent quotation', async () => {
    vi.spyOn(QuotationRepository, 'findByIdWithLock').mockResolvedValue(buildQuotation({ status: 'sent' }))

    await expect(
      new QuotationService().updateDraft(1, { items: [{ productId: 1, quantityCents: 10000, unitPriceCents: 100 }] }, salesperson),
    ).rejects.toMatchObject({ code: CrmErrorCode.CRM_QUOTATION_NOT_EDITABLE })
  })

  it('replaces items + recomputes totals when editing a draft', async () => {
    vi.spyOn(QuotationRepository, 'findByIdWithLock').mockResolvedValue(buildQuotation({ status: 'draft' }))
    const replaceItems = vi.spyOn(QuotationRepository, 'replaceItems').mockResolvedValue([])
    const update = vi.spyOn(QuotationRepository, 'update').mockResolvedValue(buildQuotation({ status: 'draft' }))
    vi.spyOn(QuotationRepository, 'listItemsByQuotationId').mockResolvedValue([])

    await new QuotationService().updateDraft(
      1,
      {
        items: [
          {
            productId: 2,
            productNameSnapshot: 'X',
            quantityCents: 10000,
            unitPriceCents: 10000, // 100.00 元
            discountBp: 0,
            taxRateBp: 0,
          },
        ],
      },
      salesperson,
    )

    expect(replaceItems).toHaveBeenCalledTimes(1)
    expect(update).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        totalCents: 10000,
        netCents: 10000,
        taxCents: 0,
        updaterId: salesperson.id,
      }),
      expect.anything(),
    )
  })

  it('returns 404 when quotation not found', async () => {
    vi.spyOn(QuotationRepository, 'findByIdWithLock').mockResolvedValue(null)

    await expect(
      new QuotationService().updateDraft(999, {}, salesperson),
    ).rejects.toMatchObject({ code: CrmErrorCode.CRM_QUOTATION_NOT_FOUND })
  })
})

describe('QuotationService.softDelete', () => {
  beforeEach(() => {
    vi.spyOn(dbManager, 'transaction').mockImplementation(async (callback: any) => callback({} as any))
  })

  it('refuses to delete a sent quotation', async () => {
    vi.spyOn(QuotationRepository, 'findByIdWithLock').mockResolvedValue(buildQuotation({ status: 'sent' }))

    await expect(
      new QuotationService().softDelete(1, salesperson),
    ).rejects.toMatchObject({ code: CrmErrorCode.CRM_QUOTATION_NOT_EDITABLE })
  })

  it('refuses to delete an accepted quotation', async () => {
    vi.spyOn(QuotationRepository, 'findByIdWithLock').mockResolvedValue(buildQuotation({ status: 'accepted' }))

    await expect(
      new QuotationService().softDelete(1, salesperson),
    ).rejects.toMatchObject({ code: CrmErrorCode.CRM_QUOTATION_NOT_EDITABLE })
  })

  it('soft-deletes a draft', async () => {
    vi.spyOn(QuotationRepository, 'findByIdWithLock').mockResolvedValue(buildQuotation({ status: 'draft' }))
    const softDelete = vi.spyOn(QuotationRepository, 'softDelete').mockResolvedValue(1)

    await new QuotationService().softDelete(1, salesperson)

    expect(softDelete).toHaveBeenCalledWith(1, expect.anything())
  })
})

describe('QuotationService.acceptQuotation (supersede 旧 accepted)', () => {
  beforeEach(() => {
    vi.spyOn(dbManager, 'transaction').mockImplementation(async (callback: any) => callback({} as any))
  })

  it('refuses to accept a non-sent quotation', async () => {
    vi.spyOn(QuotationRepository, 'findByIdWithLock').mockResolvedValue(buildQuotation({ status: 'draft' }))

    await expect(
      new QuotationService().acceptQuotation(1, salesperson),
    ).rejects.toMatchObject({ code: CrmErrorCode.CRM_QUOTATION_NOT_SENT })
  })

  it('refuses double-accept', async () => {
    vi.spyOn(QuotationRepository, 'findByIdWithLock').mockResolvedValue(buildQuotation({ status: 'accepted' }))

    await expect(
      new QuotationService().acceptQuotation(1, salesperson),
    ).rejects.toMatchObject({ code: CrmErrorCode.CRM_QUOTATION_ACCEPTED_IMMUTABLE })
  })

  it('supersedes older accepted quotations under the same opportunity', async () => {
    vi.spyOn(QuotationRepository, 'findByIdWithLock').mockResolvedValue(
      buildQuotation({ id: 5, status: 'sent', opportunityId: 200 }),
    )
    vi.spyOn(QuotationRepository, 'listItemsByQuotationId').mockResolvedValue([])
    const update = vi.spyOn(QuotationRepository, 'update').mockResolvedValue(
      buildQuotation({ id: 5, status: 'accepted', opportunityId: 200 }),
    )
    const log = vi.spyOn(QuotationRepository, 'createStatusLog').mockResolvedValue()
    vi.spyOn(QuotationRepository, 'findAcceptedIdsByOpportunity').mockResolvedValue([3, 4])

    await new QuotationService().acceptQuotation(5, salesperson)

    // update 主表 → accepted；update 旧 accepted #3, #4 → superseded
    expect(update).toHaveBeenCalledWith(5, expect.objectContaining({ status: 'accepted' }), expect.anything())
    expect(update).toHaveBeenCalledWith(3, expect.objectContaining({ status: 'superseded' }), expect.anything())
    expect(update).toHaveBeenCalledWith(4, expect.objectContaining({ status: 'superseded' }), expect.anything())

    // log: sent → accepted, accepted → superseded × 2
    expect(log).toHaveBeenCalledWith(expect.objectContaining({
      fromStatus: 'sent',
      toStatus: 'accepted',
      quotationId: 5,
    }), expect.anything())
    expect(log).toHaveBeenCalledWith(expect.objectContaining({
      fromStatus: 'accepted',
      toStatus: 'superseded',
      quotationId: 3,
    }), expect.anything())
    expect(log).toHaveBeenCalledWith(expect.objectContaining({
      fromStatus: 'accepted',
      toStatus: 'superseded',
      quotationId: 4,
    }), expect.anything())
  })

  it('accepting a quotation without opportunityId does not touch other accepted rows', async () => {
    vi.spyOn(QuotationRepository, 'findByIdWithLock').mockResolvedValue(
      buildQuotation({ id: 9, status: 'sent', opportunityId: null }),
    )
    vi.spyOn(QuotationRepository, 'listItemsByQuotationId').mockResolvedValue([])
    vi.spyOn(QuotationRepository, 'update').mockResolvedValue(
      buildQuotation({ id: 9, status: 'accepted', opportunityId: null }),
    )
    vi.spyOn(QuotationRepository, 'createStatusLog').mockResolvedValue()
    const findAccepted = vi.spyOn(QuotationRepository, 'findAcceptedIdsByOpportunity')

    await new QuotationService().acceptQuotation(9, salesperson)

    expect(findAccepted).not.toHaveBeenCalled()
  })
})

describe('QuotationService.rejectQuotation', () => {
  beforeEach(() => {
    vi.spyOn(dbManager, 'transaction').mockImplementation(async (callback: any) => callback({} as any))
  })

  it('refuses to reject a draft (must be sent first)', async () => {
    vi.spyOn(QuotationRepository, 'findByIdWithLock').mockResolvedValue(buildQuotation({ status: 'draft' }))

    await expect(
      new QuotationService().rejectQuotation(1, '价格太高', salesperson),
    ).rejects.toMatchObject({ code: CrmErrorCode.CRM_QUOTATION_NOT_SENT })
  })

  it('moves sent → rejected and writes log with reason', async () => {
    vi.spyOn(QuotationRepository, 'findByIdWithLock').mockResolvedValue(buildQuotation({ status: 'sent' }))
    vi.spyOn(QuotationRepository, 'listItemsByQuotationId').mockResolvedValue([])
    const update = vi.spyOn(QuotationRepository, 'update').mockResolvedValue(buildQuotation({ status: 'rejected' }))
    const log = vi.spyOn(QuotationRepository, 'createStatusLog').mockResolvedValue()

    await new QuotationService().rejectQuotation(1, '价格太高', salesperson)

    expect(update).toHaveBeenCalledWith(1, expect.objectContaining({ status: 'rejected' }), expect.anything())
    expect(log).toHaveBeenCalledWith(expect.objectContaining({
      fromStatus: 'sent',
      toStatus: 'rejected',
      reason: '价格太高',
    }), expect.anything())
  })
})

describe('QuotationService.voidQuotation', () => {
  beforeEach(() => {
    vi.spyOn(dbManager, 'transaction').mockImplementation(async (callback: any) => callback({} as any))
  })

  it('cannot void an accepted quotation', async () => {
    vi.spyOn(QuotationRepository, 'findByIdWithLock').mockResolvedValue(buildQuotation({ status: 'accepted' }))

    await expect(
      new QuotationService().voidQuotation(1, '撤回', salesperson),
    ).rejects.toMatchObject({ code: CrmErrorCode.CRM_QUOTATION_ACCEPTED_IMMUTABLE })
  })

  it('cannot void a superseded quotation', async () => {
    vi.spyOn(QuotationRepository, 'findByIdWithLock').mockResolvedValue(buildQuotation({ status: 'superseded' }))

    await expect(
      new QuotationService().voidQuotation(1, '撤回', salesperson),
    ).rejects.toMatchObject({ code: CrmErrorCode.CRM_QUOTATION_ACCEPTED_IMMUTABLE })
  })

  it('can void a sent quotation with a reason', async () => {
    vi.spyOn(QuotationRepository, 'findByIdWithLock').mockResolvedValue(buildQuotation({ status: 'sent' }))
    vi.spyOn(QuotationRepository, 'listItemsByQuotationId').mockResolvedValue([])
    const update = vi.spyOn(QuotationRepository, 'update').mockResolvedValue(buildQuotation({ status: 'voided' }))
    const log = vi.spyOn(QuotationRepository, 'createStatusLog').mockResolvedValue()

    await new QuotationService().voidQuotation(1, '客户取消', salesperson)

    expect(update).toHaveBeenCalledWith(1, expect.objectContaining({ status: 'voided' }), expect.anything())
    expect(log).toHaveBeenCalledWith(expect.objectContaining({
      fromStatus: 'sent',
      toStatus: 'voided',
      reason: '客户取消',
    }), expect.anything())
  })

  it('can void a draft without a reason', async () => {
    vi.spyOn(QuotationRepository, 'findByIdWithLock').mockResolvedValue(buildQuotation({ status: 'draft' }))
    vi.spyOn(QuotationRepository, 'listItemsByQuotationId').mockResolvedValue([])
    vi.spyOn(QuotationRepository, 'update').mockResolvedValue(buildQuotation({ status: 'voided' }))
    const log = vi.spyOn(QuotationRepository, 'createStatusLog').mockResolvedValue()

    await new QuotationService().voidQuotation(1, undefined, salesperson)

    expect(log).toHaveBeenCalledWith(expect.objectContaining({
      fromStatus: 'draft',
      toStatus: 'voided',
      reason: null,
    }), expect.anything())
  })
})

describe('QuotationService.list / data scope', () => {
  it('passes ownerUserIds scope to repository for non-super_admin user', async () => {
    const list = vi.spyOn(QuotationRepository, 'list').mockResolvedValue({ rows: [], total: 0 })

    await new QuotationService().list({ page: 1, pageSize: 10 } as QuotationListQuery, salesperson)

    expect(list).toHaveBeenCalledWith(expect.objectContaining({
      ownerUserIds: [salesperson.id],
      ownerDepartmentIds: null,
    }))
  })

  it('returns paginated wrapper from service', async () => {
    vi.spyOn(QuotationRepository, 'list').mockResolvedValue({ rows: [], total: 0 })

    const result = await new QuotationService().list({ page: 2, pageSize: 5 } as QuotationListQuery, salesperson)
    expect(result.page).toBe(2)
    expect(result.pageSize).toBe(5)
    expect(result.total).toBe(0)
    expect(result.items).toEqual([])
  })
})

describe('QuotationService.findDetailById visibility', () => {
  it('throws NOT_FOUND when quotation does not exist', async () => {
    vi.spyOn(QuotationRepository, 'findById').mockResolvedValue(null)

    await expect(
      new QuotationService().findDetailById(999, salesperson),
    ).rejects.toMatchObject({ code: CrmErrorCode.CRM_QUOTATION_NOT_FOUND })
  })

  it('throws NOT_FOUND when currentUser is not the owner', async () => {
    vi.spyOn(QuotationRepository, 'findById').mockResolvedValue(
      buildQuotation({ ownerUserId: 999 }),
    )

    await expect(
      new QuotationService().findDetailById(1, salesperson),
    ).rejects.toMatchObject({ code: CrmErrorCode.CRM_QUOTATION_NOT_FOUND })
  })

  it('returns detail with items when accessible', async () => {
    vi.spyOn(QuotationRepository, 'findById').mockResolvedValue(buildQuotation())
    vi.spyOn(QuotationRepository, 'listItemsByQuotationId').mockResolvedValue([])

    const detail = await new QuotationService().findDetailById(1, salesperson)
    expect(detail.items).toEqual([])
    expect(detail.head.id).toBe(1)
  })
})

// 避免未使用类型的 lint 警告
void (null as unknown as QuotationStatus)