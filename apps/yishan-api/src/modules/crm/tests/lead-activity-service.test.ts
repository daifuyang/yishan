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
    wechat: null, qq: null, sourceId: null, intention: null, status: 'pending', ownerUserId: salesperson.id, ownerUserName: '王伟', ownerDepartmentId: 10,
    poolStatus: 'owned', createdBy: salesperson.id, lastFollowUpAt: null, nextFollowUpAt: null, disqualifyReason: null, disqualifyCode: null, convertedCustomerId: null, convertedContactId: null,
    convertedAt: null, createdAt: occurredAt, updatedAt: occurredAt,
    ...overrides,
  }
}

function mockTransactionLead(status: LeadRow['status'], refreshed = status) {
  vi.spyOn(LeadRepository, 'findById')
    .mockResolvedValueOnce(buildLead({ status }))
    .mockResolvedValueOnce(buildLead({ status }))
    .mockResolvedValueOnce(buildLead({ status: refreshed, lastFollowUpAt: occurredAt, nextFollowUpAt }))
  vi.spyOn(dbManager, 'transaction').mockImplementation(async (callback: any) => callback({} as any))
  vi.spyOn(LeadRepository, 'update').mockResolvedValue(null)
}

describe('LeadActivityService.create', () => {
  it('updates the selected status and appends a status audit after the human follow-up', async () => {
    mockTransactionLead('pending', 'contact_valid')
    const create = vi.spyOn(LeadActivityRepository, 'create')
      .mockResolvedValueOnce({ id: 11, leadId: 1, type: 'phone', content: '客户正在评估权限方案', occurredAt, nextFollowUpAt, operatorUserId: salesperson.id, createdAt: occurredAt, updatedAt: occurredAt })
      .mockResolvedValueOnce({ id: 12, leadId: 1, type: 'status_change', content: '跟进状态由「未处理」变为「联系方式有效」', occurredAt, nextFollowUpAt: null, operatorUserId: salesperson.id, createdAt: occurredAt, updatedAt: occurredAt })
    vi.spyOn(LeadActivityRepository, 'listByLeadId').mockResolvedValue([])

    const result = await new LeadActivityService().create(1, {
      type: 'phone', content: '客户正在评估权限方案', followUpStatus: 'contact_valid', occurredAt, nextFollowUpAt,
    }, salesperson)

    expect(create).toHaveBeenNthCalledWith(1, expect.objectContaining({ type: 'phone', content: '客户正在评估权限方案' }), expect.anything())
    expect(LeadRepository.update).toHaveBeenCalledWith(1, expect.objectContaining({ status: 'contact_valid', lastFollowUpAt: occurredAt, nextFollowUpAt, updaterId: salesperson.id }), expect.anything())
    expect(create).toHaveBeenNthCalledWith(2, expect.objectContaining({ type: 'status_change', content: '跟进状态由「未处理」变为「联系方式有效」' }), expect.anything())
    expect(result.lead.status).toBe('contact_valid')
  })

  it('writes no audit when the selected status is unchanged', async () => {
    mockTransactionLead('contact_valid')
    const create = vi.spyOn(LeadActivityRepository, 'create').mockResolvedValue({ id: 22, leadId: 1, type: 'wechat', content: '复访', occurredAt, nextFollowUpAt, operatorUserId: salesperson.id, createdAt: occurredAt, updatedAt: occurredAt })
    vi.spyOn(LeadActivityRepository, 'listByLeadId').mockResolvedValue([])

    await new LeadActivityService().create(1, { type: 'wechat', content: '复访', followUpStatus: 'contact_valid', occurredAt, nextFollowUpAt }, salesperson)

    expect(create).toHaveBeenCalledTimes(1)
    expect(LeadRepository.update).toHaveBeenCalledWith(1, expect.objectContaining({ status: 'contact_valid' }), expect.anything())
  })

  it.each(['contact_invalid', 'closed'] as const)('allows a %s lead to record a follow-up', async (status) => {
    mockTransactionLead(status)
    vi.spyOn(LeadActivityRepository, 'create').mockResolvedValue({ id: 23, leadId: 1, type: 'phone', content: '继续跟进', occurredAt, nextFollowUpAt, operatorUserId: salesperson.id, createdAt: occurredAt, updatedAt: occurredAt })
    vi.spyOn(LeadActivityRepository, 'listByLeadId').mockResolvedValue([])

    await expect(new LeadActivityService().create(1, { type: 'phone', content: '继续跟进', followUpStatus: status, occurredAt, nextFollowUpAt }, salesperson)).resolves.toMatchObject({ lead: { status } })
  })

  it('normalizes ISO request timestamps before handing them to the repository', async () => {
    mockTransactionLead('contact_valid')
    vi.spyOn(LeadActivityRepository, 'create').mockResolvedValue({ id: 24, leadId: 1, type: 'phone', content: '字符串时间', occurredAt, nextFollowUpAt, operatorUserId: salesperson.id, createdAt: occurredAt, updatedAt: occurredAt })
    vi.spyOn(LeadActivityRepository, 'listByLeadId').mockResolvedValue([])

    await new LeadActivityService().create(1, {
      type: 'phone', content: '字符串时间', followUpStatus: 'contact_valid',
      nextFollowUpAt: '2026-09-10T06:00:00.000Z',
    }, salesperson)

    expect(LeadRepository.update).toHaveBeenCalledWith(1, expect.objectContaining({
      lastFollowUpAt: expect.any(Date),
      nextFollowUpAt: new Date('2026-09-10T06:00:00.000Z'),
    }), expect.anything())
  })

  it('returns the human follow-up when a same-time audit is listed first', async () => {
    mockTransactionLead('pending', 'contact_valid')
    vi.spyOn(LeadActivityRepository, 'create')
      .mockResolvedValueOnce({ id: 31, leadId: 1, type: 'phone', content: '确认试用', occurredAt, nextFollowUpAt, operatorUserId: salesperson.id, createdAt: occurredAt, updatedAt: occurredAt })
      .mockResolvedValueOnce({ id: 32, leadId: 1, type: 'status_change', content: '跟进状态由「未处理」变为「联系方式有效」', occurredAt, nextFollowUpAt: null, operatorUserId: salesperson.id, createdAt: occurredAt, updatedAt: occurredAt })
    vi.spyOn(LeadActivityRepository, 'listByLeadId').mockResolvedValue([
      { id: 32, leadId: 1, type: 'status_change', content: '跟进状态由「未处理」变为「联系方式有效」', occurredAt, nextFollowUpAt: null, operatorUserId: salesperson.id, operatorUserName: '愚公', createdAt: occurredAt, updatedAt: occurredAt },
    ])

    const result = await new LeadActivityService().create(1, { type: 'phone', content: '确认试用', followUpStatus: 'contact_valid', occurredAt, nextFollowUpAt }, salesperson)

    expect(result.activity).toMatchObject({ id: 31, type: 'phone', content: '确认试用' })
  })
})
