import { afterEach, describe, expect, it, vi } from 'vitest'
import { dbManager } from '@/db'
import { LeadRepository, type LeadRow } from '../repositories/lead.repository.js'
import { LeadActivityRepository } from '../repositories/lead-activity.repository.js'
import { LeadActivityService } from '../services/lead-activity.service.js'

const salesperson = { id: 7, roleCodes: ['sales'], deptIds: [10] }
const occurredAt = new Date('2026-09-06T14:20:00.000Z')
const nextFollowUpAt = new Date('2026-09-10T06:00:00.000Z')

afterEach(() => vi.restoreAllMocks())

function buildLead(overrides: Partial<LeadRow> = {}): LeadRow {
  return {
    id: 1, name: '李伟', companyName: '上海拓维信息技术有限公司', mobile: '13800001002', phone: null, email: null,
    wechat: null, qq: null, sourceId: null, intention: null, status: 'new', ownerUserId: salesperson.id, ownerUserName: '王伟', ownerDepartmentId: 10,
    poolStatus: 'owned', createdBy: salesperson.id, lastFollowUpAt: null, nextFollowUpAt: null, disqualifyReason: null, disqualifyCode: null, convertedCustomerId: null, convertedContactId: null,
    convertedAt: null, createdAt: occurredAt, updatedAt: occurredAt,
    ...overrides,
  }
}

describe('LeadActivityService.create', () => {
  it('stores the current operator and synchronizes lead follow-up timestamps', async () => {
    vi.spyOn(LeadRepository, 'findById').mockResolvedValue(buildLead())
    vi.spyOn(dbManager, 'transaction').mockImplementation(async (callback: any) => callback({} as any))
    const create = vi.spyOn(LeadActivityRepository, 'create').mockResolvedValue({
      id: 11, leadId: 1, type: 'phone', content: '客户正在评估权限方案', occurredAt, nextFollowUpAt,
      operatorUserId: salesperson.id, createdAt: occurredAt, updatedAt: occurredAt,
    })
    vi.spyOn(LeadActivityRepository, 'listByLeadId').mockResolvedValue([])
    const update = vi.spyOn(LeadRepository, 'update').mockResolvedValue(null)

    const result = await new LeadActivityService().create(1, {
      type: 'phone', content: '客户正在评估权限方案', occurredAt, nextFollowUpAt,
    }, salesperson)

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ leadId: 1, operatorUserId: salesperson.id }), expect.anything())
    expect(update).toHaveBeenCalledWith(1, expect.objectContaining({
      lastFollowUpAt: occurredAt, nextFollowUpAt, updaterId: salesperson.id,
    }), expect.anything())
    expect(result.activity).toMatchObject({ id: 11, leadId: 1, type: 'phone' })
    expect(result.lead).toMatchObject({ id: 1, status: 'new' })
  })

  it('写入首条跟进时回写 status=processing 并追加 status_change 活动（同事务）', async () => {
    // 服务在事务里会再次调用 findById —— 返回"事务内读取时"的最新 lead。
    const findByIdSpy = vi.spyOn(LeadRepository, 'findById')
      .mockResolvedValueOnce(buildLead({ status: 'new' })) // 访问校验（事务前）
      .mockResolvedValueOnce(buildLead({ status: 'new' })) // 事务内回读
      .mockResolvedValueOnce(buildLead({ status: 'processing', lastFollowUpAt: occurredAt, nextFollowUpAt })) // 事务结束前回读 result
    vi.spyOn(dbManager, 'transaction').mockImplementation(async (callback: any) => callback({} as any))
    const activityCreate = vi.spyOn(LeadActivityRepository, 'create').mockResolvedValue({
      id: 11, leadId: 1, type: 'phone', content: '客户正在评估权限方案', occurredAt, nextFollowUpAt,
      operatorUserId: salesperson.id, createdAt: occurredAt, updatedAt: occurredAt,
    })
    vi.spyOn(LeadActivityRepository, 'listByLeadId').mockResolvedValue([])
    const update = vi.spyOn(LeadRepository, 'update').mockResolvedValue(null)

    const result = await new LeadActivityService().create(1, {
      type: 'phone', content: '客户正在评估权限方案', occurredAt, nextFollowUpAt,
    }, salesperson)

    // 写跟进 + 回写 timestamps + 转 status 字段必须出现在同一 LeadRepository.update 调用里。
    expect(update).toHaveBeenCalledWith(1, expect.objectContaining({
      status: 'processing',
      lastFollowUpAt: occurredAt,
      nextFollowUpAt,
      updaterId: salesperson.id,
    }), expect.anything())

    // activity.create 收到两条记录：原始跟进 + 系统状态变更。
    expect(activityCreate).toHaveBeenCalledTimes(2)
    expect(activityCreate).toHaveBeenNthCalledWith(2, expect.objectContaining({
      type: 'status_change',
      content: '待处理 → 跟进中',
      operatorUserId: salesperson.id,
    }), expect.anything())

    expect(result.lead).toMatchObject({ status: 'processing' })
    expect(findByIdSpy).toHaveBeenCalled()
  })

  it('已 processing 的跟进不会再次产生 status_change 活动', async () => {
    vi.spyOn(LeadRepository, 'findById').mockResolvedValue(buildLead({ status: 'processing' }))
    vi.spyOn(dbManager, 'transaction').mockImplementation(async (callback: any) => callback({} as any))
    vi.spyOn(LeadActivityRepository, 'create').mockResolvedValue({
      id: 22, leadId: 1, type: 'wechat', content: '复访', occurredAt, nextFollowUpAt,
      operatorUserId: salesperson.id, createdAt: occurredAt, updatedAt: occurredAt,
    })
    vi.spyOn(LeadActivityRepository, 'listByLeadId').mockResolvedValue([])
    const update = vi.spyOn(LeadRepository, 'update').mockResolvedValue(null)

    const result = await new LeadActivityService().create(1, {
      type: 'wechat', content: '复访', occurredAt, nextFollowUpAt,
    }, salesperson)

    // 仅一次 activity 写入（人类跟进），且 update 不包含 status 字段。
    expect(update).toHaveBeenCalledWith(1, expect.objectContaining({
      lastFollowUpAt: occurredAt, nextFollowUpAt, updaterId: salesperson.id,
    }), expect.anything())
    const updateArgs = update.mock.calls[0]?.[1] as unknown as Record<string, unknown> | undefined
    expect(updateArgs).not.toHaveProperty('status')

    expect(result.lead.status).toBe('processing')
  })
})
