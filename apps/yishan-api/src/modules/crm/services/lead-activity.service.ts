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

/** 状态本地化标签（与前端 lifecycle 标签一致）。 */
const STATUS_LABELS: Record<LeadRow['status'], string> = {
  new: '待处理',
  processing: '跟进中',
  qualified: '有效',
  disqualified: '无效',
  converted: '已转化',
}

/**
 * 写跟进响应：activity + 最新 lead。
 *
 * 在 first follow-up（status='new' → 'processing'）场景下，lead 状态会变，
 * 必须返回最新 lead 让前端可以原地刷新标签和操作按钮。
 * 终态线索（converted / disqualified）不得进入跟进流程。
 */
export interface LeadActivityCreateServiceResult {
  activity: LeadActivityRowWithOperator
  lead: LeadRow
}

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
  ): Promise<LeadActivityCreateServiceResult> {
    const initial = await this.getAccessibleLead(leadId, currentUser)
    if (!(ACTIVITY_TYPES as readonly string[]).includes(input.type)) {
      throw new BusinessError(CrmErrorCode.CRM_ACTIVITY_TYPE_INVALID, '跟进方式不合法')
    }
    if (!input.content.trim()) {
      throw new BusinessError(CrmErrorCode.CRM_ACTIVITY_CONTENT_REQUIRED, '请填写跟进内容')
    }
    // 终态守卫：无效 / 已转化线索不允许新增跟进。
    if (initial.status === 'converted' || initial.status === 'disqualified') {
      throw new BusinessError(CrmErrorCode.CRM_LEAD_STATUS_INVALID, '当前状态不能新增跟进')
    }

    const occurredAt = input.occurredAt ?? new Date()
    const nextFollowUpAt = input.nextFollowUpAt ?? null
    return dbManager.transaction(async (tx) => {
      // 重新读取当前 lead，确保 status / owner 等字段在事务内是最新值；
      // 避免访问校验通过后、并发请求之间漏过转换状态变更。
      const locked = await LeadRepository.findById(leadId, tx)
      if (!locked) throw new BusinessError(CrmErrorCode.CRM_LEAD_NOT_FOUND, '线索不存在或已删除')
      if (locked.status === 'converted' || locked.status === 'disqualified') {
        throw new BusinessError(CrmErrorCode.CRM_LEAD_STATUS_INVALID, '当前状态不能新增跟进')
      }

      const humanActivity = await LeadActivityRepository.create({
        leadId,
        type: input.type,
        content: input.content.trim(),
        occurredAt,
        nextFollowUpAt,
        operatorUserId: currentUser.id,
      }, tx)

      // 决定是否同时推进状态：仅在"new → processing"这一次写首次跟进时推进。
      const shouldAdvanceToProcessing = locked.status === 'new'
      const updatePayload: Parameters<typeof LeadRepository.update>[1] = {
        lastFollowUpAt: occurredAt,
        nextFollowUpAt,
        updaterId: currentUser.id,
      }
      if (shouldAdvanceToProcessing) {
        updatePayload.status = 'processing'
      }
      await LeadRepository.update(leadId, updatePayload, tx)

      let transitionActivity: Awaited<ReturnType<typeof LeadActivityRepository.create>> | null = null
      if (shouldAdvanceToProcessing) {
        transitionActivity = await LeadActivityRepository.create({
          leadId,
          type: 'status_change',
          content: `${STATUS_LABELS.new} → ${STATUS_LABELS.processing}`,
          occurredAt,
          operatorUserId: currentUser.id,
        }, tx)
      }

      const [withOperator] = await LeadActivityRepository.listByLeadId(leadId, { limit: 1 }, tx)
      const refreshed = await LeadRepository.findById(leadId, tx)
      return {
        activity: withOperator ?? { ...(transitionActivity ?? humanActivity), operatorUserName: null },
        lead: refreshed ?? locked,
      }
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
