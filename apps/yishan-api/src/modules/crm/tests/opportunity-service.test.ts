import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { dbManager } from '@/db'
import { OpportunityService } from '../services/opportunity.service.js'
import { CrmErrorCode } from '../schemas/error-codes.js'
import {
  OpportunityRepository,
  type OpportunityRow,
} from '../repositories/opportunity.repository.js'
import { ActivityRepository } from '../repositories/activity.repository.js'

const salesperson = { id: 7, roleCodes: ['sales'], deptIds: [10] }

afterEach(() => {
  vi.restoreAllMocks()
})

function buildOpportunity(overrides: Partial<OpportunityRow> = {}): OpportunityRow {
  return {
    id: 1,
    name: '示例商机',
    customerId: 100,
    contactId: 5,
    ownerUserId: salesperson.id,
    ownerUserName: '销售',
    ownerDepartmentId: 10,
    pipelineCode: 'default',
    stageCode: 'discover',
    stageEnteredAt: new Date('2026-09-01T00:00:00Z'),
    expectedAmountCents: 1_000_000,
    expectedCloseDate: null,
    nextActionAt: null,
    lostReasonCode: null,
    wonAt: null,
    lostAt: null,
    version: 1,
    creatorId: salesperson.id,
    createdByUserName: '销售',
    updaterId: salesperson.id,
    createdAt: new Date('2026-09-01T00:00:00Z'),
    updatedAt: new Date('2026-09-01T00:00:00Z'),
    deletedAt: null,
    ...overrides,
  }
}

describe('OpportunityService.advanceStage（阶段状态机）', () => {
  beforeEach(() => {
    vi.spyOn(dbManager, 'transaction').mockImplementation(async (callback: any) => callback({} as any))
    vi.spyOn(ActivityRepository, 'create').mockResolvedValue({
      id: 1, customerId: null, contactId: null, entityType: 'opportunity', entityId: 1, entityRefType: 'opportunity',
      type: 'status_change', content: '', occurredAt: new Date(), nextFollowUpAt: null, plannedAt: null,
      location: null, participants: null, visitResultCode: null, summary: null,
      operatorUserId: salesperson.id, createdAt: new Date(), updatedAt: new Date(),
    })
  })

  it('discover → qualify 走 happy path', async () => {
    vi.spyOn(OpportunityRepository, 'findByIdForUpdate').mockResolvedValue(buildOpportunity({ stageCode: 'discover' }))
    // 完整的可链式 mock：tx.update().set().where() + tx.insert().values()
    const chainable: any = {}
    chainable.set = vi.fn().mockReturnValue(chainable)
    chainable.where = vi.fn().mockReturnValue(chainable)
    chainable.values = vi.fn().mockReturnValue(chainable)
    const txStub: any = {
      update: vi.fn().mockReturnValue(chainable),
      insert: vi.fn().mockReturnValue(chainable),
    }
    vi.spyOn(dbManager, 'transaction').mockImplementation(async (cb: any) => cb(txStub))
    const stageLogSpy = vi.spyOn(OpportunityRepository, 'createStageLog').mockResolvedValue({
      id: 1, opportunityId: 1, fromStage: 'discover', toStage: 'qualify',
      operatorUserId: salesperson.id, reason: null, createdAt: new Date(),
    })
    // ActivityRepository.create 也被 advanceStage 调用（写 crm_activity 审计）
    vi.spyOn(ActivityRepository, 'create').mockResolvedValue({} as any)
    const refreshSpy = vi.spyOn(OpportunityRepository, 'findById').mockResolvedValue(buildOpportunity({ stageCode: 'qualify' }))

    const result = await new OpportunityService().advanceStage({
      id: 1,
      input: { toStage: 'qualify' },
      currentUser: salesperson,
    })

    expect(stageLogSpy).toHaveBeenCalledWith(expect.objectContaining({
      opportunityId: 1, fromStage: 'discover', toStage: 'qualify', operatorUserId: salesperson.id,
    }), expect.anything())
    expect(refreshSpy).toHaveBeenCalled()
    expect(result.stageCode).toBe('qualify')
  })

  it('不允许跨阶段跳跃：discover 直接跳到 negotiation 拒绝', async () => {
    vi.spyOn(OpportunityRepository, 'findByIdForUpdate').mockResolvedValue(buildOpportunity({ stageCode: 'discover' }))
    vi.spyOn(dbManager, 'transaction').mockImplementation(async (cb: any) => cb({} as any))

    await expect(
      new OpportunityService().advanceStage({
        id: 1,
        input: { toStage: 'negotiation' },
        currentUser: salesperson,
      }),
    ).rejects.toMatchObject({ code: CrmErrorCode.CRM_OPPORTUNITY_STAGE_INVALID })
  })

  it('终态（won）不允许继续 advanceStage', async () => {
    vi.spyOn(OpportunityRepository, 'findByIdForUpdate').mockResolvedValue(buildOpportunity({ stageCode: 'won' }))
    vi.spyOn(dbManager, 'transaction').mockImplementation(async (cb: any) => cb({} as any))

    await expect(
      new OpportunityService().advanceStage({
        id: 1,
        input: { toStage: 'qualify' },
        currentUser: salesperson,
      }),
    ).rejects.toMatchObject({ code: CrmErrorCode.CRM_OPPORTUNITY_STAGE_INVALID })
  })

  it('advanceStage 不允许直接 target=won（必须走 markWon 入口）', async () => {
    vi.spyOn(OpportunityRepository, 'findByIdForUpdate').mockResolvedValue(buildOpportunity({ stageCode: 'negotiation' }))
    vi.spyOn(dbManager, 'transaction').mockImplementation(async (cb: any) => cb({} as any))

    await expect(
      new OpportunityService().advanceStage({
        id: 1,
        input: { toStage: 'won' },
        currentUser: salesperson,
      }),
    ).rejects.toMatchObject({ code: CrmErrorCode.CRM_OPPORTUNITY_STAGE_INVALID })
  })

  it('不支持跨部门访问：返回 NOT_FOUND', async () => {
    const otherUser = buildOpportunity({
      ownerUserId: 999,
      ownerDepartmentId: 999,
      ownerUserName: '其他',
    })
    vi.spyOn(OpportunityRepository, 'findById').mockResolvedValue(otherUser)

    await expect(
      new OpportunityService().detail(1, salesperson),
    ).rejects.toMatchObject({ code: CrmErrorCode.CRM_OPPORTUNITY_NOT_FOUND })
  })
})

describe('OpportunityService.markWon', () => {
  beforeEach(() => {
    vi.spyOn(ActivityRepository, 'create').mockResolvedValue({
      id: 1, customerId: null, contactId: null, entityType: 'opportunity', entityId: 1, entityRefType: 'opportunity',
      type: 'status_change', content: '', occurredAt: new Date(), nextFollowUpAt: null, plannedAt: null,
      location: null, participants: null, visitResultCode: null, summary: null,
      operatorUserId: salesperson.id, createdAt: new Date(), updatedAt: new Date(),
    })
  })

  it('从 negotiation 标记为成交', async () => {
    vi.spyOn(OpportunityRepository, 'findByIdForUpdate').mockResolvedValue(buildOpportunity({ stageCode: 'negotiation' }))
    installOpportunityUpdateTxStub()
    const stageLogSpy = vi.spyOn(OpportunityRepository, 'createStageLog').mockResolvedValue({
      id: 1, opportunityId: 1, fromStage: 'negotiation', toStage: 'won',
      operatorUserId: salesperson.id, reason: '客户已签约', createdAt: new Date(),
    })
    vi.spyOn(OpportunityRepository, 'findById').mockResolvedValue(buildOpportunity({
      stageCode: 'won',
      wonAt: new Date(),
    }))

    const result = await new OpportunityService().markWon({
      id: 1,
      input: { reason: '客户已签约' },
      currentUser: salesperson,
    })

    expect(stageLogSpy).toHaveBeenCalledWith(expect.objectContaining({
      fromStage: 'negotiation',
      toStage: 'won',
    }), expect.anything())
    expect(result.stageCode).toBe('won')
    expect(result.wonAt).toBeInstanceOf(Date)
  })

  it('非 negotiation 阶段不能 markWon', async () => {
    vi.spyOn(OpportunityRepository, 'findByIdForUpdate').mockResolvedValue(buildOpportunity({ stageCode: 'qualify' }))
    installOpportunityUpdateTxStub()

    await expect(
      new OpportunityService().markWon({
        id: 1,
        input: { reason: '提前签' },
        currentUser: salesperson,
      }),
    ).rejects.toMatchObject({ code: CrmErrorCode.CRM_OPPORTUNITY_WON_REQUIRES_STAGE })
  })

  it('已经是 won 状态的商机再次 markWon 拒绝', async () => {
    vi.spyOn(OpportunityRepository, 'findByIdForUpdate').mockResolvedValue(buildOpportunity({ stageCode: 'won' }))
    installOpportunityUpdateTxStub()

    await expect(
      new OpportunityService().markWon({
        id: 1,
        input: { reason: '重复确认' },
        currentUser: salesperson,
      }),
    ).rejects.toMatchObject({ code: CrmErrorCode.CRM_OPPORTUNITY_STAGE_INVALID })
  })
})

describe('OpportunityService.markLost', () => {
  beforeEach(() => {
    vi.spyOn(ActivityRepository, 'create').mockResolvedValue({
      id: 1, customerId: null, contactId: null, entityType: 'opportunity', entityId: 1, entityRefType: 'opportunity',
      type: 'status_change', content: '', occurredAt: new Date(), nextFollowUpAt: null, plannedAt: null,
      location: null, participants: null, visitResultCode: null, summary: null,
      operatorUserId: salesperson.id, createdAt: new Date(), updatedAt: new Date(),
    })
  })

  it('缺 reason 拒绝', async () => {
    await expect(
      new OpportunityService().markLost({
        id: 1,
        input: { reasonCode: 'no_budget', reason: '   ' },
        currentUser: salesperson,
      }),
    ).rejects.toMatchObject({ code: CrmErrorCode.CRM_OPPORTUNITY_LOST_REASON_REQUIRED })
  })

  it('从 discover 阶段标为流失（任意阶段允许）', async () => {
    vi.spyOn(OpportunityRepository, 'findByIdForUpdate').mockResolvedValue(buildOpportunity({ stageCode: 'discover' }))
    installOpportunityUpdateTxStub()
    const stageLogSpy = vi.spyOn(OpportunityRepository, 'createStageLog').mockResolvedValue({
      id: 1, opportunityId: 1, fromStage: 'discover', toStage: 'lost',
      operatorUserId: salesperson.id, reason: '预算不足', createdAt: new Date(),
    })
    vi.spyOn(OpportunityRepository, 'findById').mockResolvedValue(buildOpportunity({
      stageCode: 'lost',
      lostAt: new Date(),
      lostReasonCode: 'no_budget',
    }))

    const result = await new OpportunityService().markLost({
      id: 1,
      input: { reasonCode: 'no_budget', reason: '预算不足' },
      currentUser: salesperson,
    })

    expect(stageLogSpy).toHaveBeenCalledWith(expect.objectContaining({
      fromStage: 'discover', toStage: 'lost', reason: '预算不足',
    }), expect.anything())
    expect(result.stageCode).toBe('lost')
    expect(result.lostReasonCode).toBe('no_budget')
  })

  it('终态（lost）不能再次 markLost', async () => {
    vi.spyOn(OpportunityRepository, 'findByIdForUpdate').mockResolvedValue(buildOpportunity({ stageCode: 'lost' }))
    installOpportunityUpdateTxStub()

    await expect(
      new OpportunityService().markLost({
        id: 1,
        input: { reasonCode: 'other', reason: '二次确认' },
        currentUser: salesperson,
      }),
    ).rejects.toMatchObject({ code: CrmErrorCode.CRM_OPPORTUNITY_STAGE_INVALID })
  })
})

describe('OpportunityService.transferOwner', () => {
  beforeEach(() => {
    vi.spyOn(ActivityRepository, 'create').mockResolvedValue({
      id: 1, customerId: null, contactId: null, entityType: 'opportunity', entityId: 1, entityRefType: 'opportunity',
      type: 'owner_change', content: '', occurredAt: new Date(), nextFollowUpAt: null, plannedAt: null,
      location: null, participants: null, visitResultCode: null, summary: null,
      operatorUserId: salesperson.id, createdAt: new Date(), updatedAt: new Date(),
    })
  })

  it('转交 owner 不改变 stage', async () => {
    const original = buildOpportunity({ stageCode: 'proposal', ownerUserId: salesperson.id })
    vi.spyOn(OpportunityRepository, 'findByIdForUpdate').mockResolvedValue(original)
    installOpportunityUpdateTxStub()
    const activitySpy = vi.spyOn(ActivityRepository, 'create')
    vi.spyOn(OpportunityRepository, 'findById').mockResolvedValue({
      ...original,
      ownerUserId: 8,
      version: original.version + 1,
    })

    const result = await new OpportunityService().transferOwner({
      id: 1,
      input: { targetUserId: 8, reason: '同事接手' },
      currentUser: salesperson,
    })

    expect(activitySpy).toHaveBeenCalledWith(expect.objectContaining({
      type: 'owner_change',
      entityType: 'opportunity',
      entityId: 1,
    }), expect.anything())
    expect(result.ownerUserId).toBe(8)
    // stageCode 必须保持 proposal
    expect(result.stageCode).toBe('proposal')
  })

  it('targetUserId 非法时拒绝', async () => {
    await expect(
      new OpportunityService().transferOwner({
        id: 1,
        input: { targetUserId: 0 },
        currentUser: salesperson,
      }),
    ).rejects.toMatchObject({ code: CrmErrorCode.CRM_OPPORTUNITY_TRANSFER_TARGET_INVALID })
  })

  it('自指转交不写审计', async () => {
    vi.spyOn(OpportunityRepository, 'findByIdForUpdate').mockResolvedValue(buildOpportunity({ ownerUserId: salesperson.id }))
    installOpportunityUpdateTxStub()
    const activitySpy = vi.spyOn(ActivityRepository, 'create')
    vi.spyOn(OpportunityRepository, 'findById').mockResolvedValue(buildOpportunity({ ownerUserId: salesperson.id }))

    const result = await new OpportunityService().transferOwner({
      id: 1,
      input: { targetUserId: salesperson.id },
      currentUser: salesperson,
    })

    expect(activitySpy).not.toHaveBeenCalled()
    expect(result.ownerUserId).toBe(salesperson.id)
  })
})

describe('OpportunityService.create', () => {
  it('要求商机名称', async () => {
    await expect(
      new OpportunityService().create({
        input: { name: '   ', customerId: 100 },
        currentUser: salesperson,
      }),
    ).rejects.toMatchObject({ code: CrmErrorCode.CRM_OPPORTUNITY_NAME_REQUIRED })
  })

  it('非法金额（负数）拒绝', async () => {
    await expect(
      new OpportunityService().create({
        input: { name: '示例', customerId: 100, expectedAmountCents: -1 },
        currentUser: salesperson,
      }),
    ).rejects.toMatchObject({ code: CrmErrorCode.CRM_OPPORTUNITY_AMOUNT_INVALID })
  })

  it('非安全整数（超出 Number.MAX_SAFE_INTEGER）拒绝', async () => {
    await expect(
      new OpportunityService().create({
        input: { name: '示例', customerId: 100, expectedAmountCents: Number.MAX_SAFE_INTEGER + 10 },
        currentUser: salesperson,
      }),
    ).rejects.toMatchObject({ code: CrmErrorCode.CRM_OPPORTUNITY_AMOUNT_INVALID })
  })

  it('创建人即默认负责人', async () => {
    const createSpy = vi.spyOn(OpportunityRepository, 'create').mockResolvedValue(buildOpportunity())

    await new OpportunityService().create({
      input: { name: '示例商机', customerId: 100, expectedAmountCents: 1_000_000 },
      currentUser: salesperson,
    })

    expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({
      name: '示例商机',
      customerId: 100,
      ownerUserId: salesperson.id,
      ownerDepartmentId: 10,
      creatorId: salesperson.id,
      updaterId: salesperson.id,
      expectedAmountCents: 1_000_000,
      stageCode: 'discover',
      pipelineCode: 'default',
    }))
  })
})

/**
 * Stub OpportunityRepository 内部的 tx.update 调用。
 *
 * opportunity.service 的事务里直接走 tx.update(crmOpportunity).set({...}).where(eq(id))
 * 而不是经由 repository，因此需要在 transaction mock 上挂一个
 * 可链式调用并最终调用 .where 的 stub。
 */
function installOpportunityUpdateTxStub() {
  const txStub: any = {
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(undefined),
  }
  vi.spyOn(dbManager, 'transaction').mockImplementation(async (cb: any) => cb(txStub))
}
