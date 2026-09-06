import { afterEach, describe, expect, it, vi } from 'vitest'
import { dbManager } from '@/db'
import { LeadRepository } from '../repositories/lead.repository.js'
import { LeadActivityRepository } from '../repositories/lead-activity.repository.js'
import { LeadActivityService } from '../services/lead-activity.service.js'

const salesperson = { id: 7, roleCodes: ['sales'], deptIds: [10] }
const occurredAt = new Date('2026-09-06T14:20:00.000Z')
const nextFollowUpAt = new Date('2026-09-10T06:00:00.000Z')

afterEach(() => vi.restoreAllMocks())

describe('LeadActivityService.create', () => {
  it('stores the current operator and synchronizes lead follow-up timestamps', async () => {
    vi.spyOn(LeadRepository, 'findById').mockResolvedValue({
      id: 1, name: '李伟', companyName: '上海拓维信息技术有限公司', mobile: '13800001002', phone: null, email: null,
      wechat: null, qq: null, sourceId: null, intention: null, status: 'new', ownerUserId: salesperson.id, ownerUserName: '王伟', ownerDepartmentId: 10,
      poolStatus: 'owned', createdBy: salesperson.id, lastFollowUpAt: null, nextFollowUpAt: null, disqualifyReason: null, convertedCustomerId: null, convertedContactId: null,
      convertedAt: null, createdAt: occurredAt, updatedAt: occurredAt,
    })
    vi.spyOn(dbManager, 'transaction').mockImplementation(async (callback: any) => callback({} as any))
    const create = vi.spyOn(LeadActivityRepository, 'create').mockResolvedValue({
      id: 11, leadId: 1, type: 'phone', content: '客户正在评估权限方案', occurredAt, nextFollowUpAt,
      operatorUserId: salesperson.id, createdAt: occurredAt, updatedAt: occurredAt,
    })
    vi.spyOn(LeadActivityRepository, 'listByLeadId').mockResolvedValue([])
    const update = vi.spyOn(LeadRepository, 'update').mockResolvedValue(null)

    await new LeadActivityService().create(1, {
      type: 'phone', content: '客户正在评估权限方案', occurredAt, nextFollowUpAt,
    }, salesperson)

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ leadId: 1, operatorUserId: salesperson.id }), expect.anything())
    expect(update).toHaveBeenCalledWith(1, expect.objectContaining({
      lastFollowUpAt: occurredAt, nextFollowUpAt, updaterId: salesperson.id,
    }), expect.anything())
  })
})
