import { dbManager, type AppQueryDb } from '@/db'
import { BusinessError } from '@/exceptions/business-error.js'
import { ACTIVITY_TYPES } from '../schemas/activity.schema.js'
import type { DataScopeUser } from '../schemas/data-scope.js'
import { computeDataScope } from '../schemas/data-scope.js'
import { CrmErrorCode } from '../schemas/error-codes.js'
import {
  LeadActivityRepository,
  type CreateLeadActivityInput,
  type LeadActivityRowWithOperator,
} from '../repositories/lead-activity.repository.js'
import { LeadRepository, type LeadRow } from '../repositories/lead.repository.js'

export class LeadActivityService {
  constructor(private readonly deps: { db?: AppQueryDb } = {}) {}

  async listByLeadId(leadId: number, currentUser: DataScopeUser): Promise<{ total: number; items: LeadActivityRowWithOperator[] }> {
    await this.getAccessibleLead(leadId, currentUser)
    const items = await LeadActivityRepository.listByLeadId(leadId, {}, this.deps.db)
    return { total: items.length, items }
  }

  async create(
    leadId: number,
    input: Omit<CreateLeadActivityInput, 'leadId' | 'operatorUserId'>,
    currentUser: DataScopeUser,
  ): Promise<LeadActivityRowWithOperator> {
    await this.getAccessibleLead(leadId, currentUser)
    if (!(ACTIVITY_TYPES as readonly string[]).includes(input.type)) {
      throw new BusinessError(CrmErrorCode.CRM_ACTIVITY_TYPE_INVALID, '跟进方式不合法')
    }
    if (!input.content.trim()) {
      throw new BusinessError(CrmErrorCode.CRM_ACTIVITY_CONTENT_REQUIRED, '请填写跟进内容')
    }

    const occurredAt = input.occurredAt ?? new Date()
    const nextFollowUpAt = input.nextFollowUpAt ?? null
    return dbManager.transaction(async (tx) => {
      const activity = await LeadActivityRepository.create({
        leadId,
        type: input.type,
        content: input.content.trim(),
        occurredAt,
        nextFollowUpAt,
        operatorUserId: currentUser.id,
      }, tx)
      await LeadRepository.update(leadId, {
        lastFollowUpAt: occurredAt,
        nextFollowUpAt,
        updaterId: currentUser.id,
      }, tx)
      const [withOperator] = await LeadActivityRepository.listByLeadId(leadId, { limit: 1 }, tx)
      return withOperator ?? { ...activity, operatorUserName: null }
    })
  }

  private async getAccessibleLead(leadId: number, currentUser: DataScopeUser): Promise<LeadRow> {
    const lead = await LeadRepository.findById(leadId, this.deps.db)
    if (!lead) throw new BusinessError(CrmErrorCode.CRM_LEAD_NOT_FOUND, '线索不存在或已删除')
    const scope = computeDataScope(currentUser)
    const permitted = scope.ownerUserIds === null
      || lead.ownerUserId === null
      || scope.ownerUserIds?.includes(lead.ownerUserId)
      || scope.ownerDepartmentIds?.includes(lead.ownerDepartmentId ?? -1)
    if (!permitted) throw new BusinessError(CrmErrorCode.CRM_LEAD_NOT_FOUND, '线索不存在或已删除')
    return lead
  }
}
