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
  pending: '未处理',
  contact_valid: '联系方式有效',
  contact_invalid: '联系方式无效',
  closed: '关闭',
}

/** 兼容尚未迁移完成的历史空值，不能把技术值暴露到动态中。 */
function statusLabel(status: string | null | undefined): string {
  return STATUS_LABELS[status as LeadRow['status']] ?? STATUS_LABELS.pending
}

/**
 * 写跟进响应：activity + 最新 lead。
 *
 * 必须返回最新 lead 让前端可以原地刷新标签和操作按钮。
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
    input: Omit<CreateLeadActivityInput, 'leadId' | 'operatorUserId'> & { followUpStatus: LeadRow['status'] },
    currentUser: DataScopeUser,
  ): Promise<LeadActivityCreateServiceResult> {
    await this.getAccessibleLead(leadId, currentUser)
    if (!(ACTIVITY_TYPES as readonly string[]).includes(input.type)) {
      throw new BusinessError(CrmErrorCode.CRM_ACTIVITY_TYPE_INVALID, '跟进方式不合法')
    }
    if (!input.content.trim()) {
      throw new BusinessError(CrmErrorCode.CRM_ACTIVITY_CONTENT_REQUIRED, '请填写跟进内容')
    }
    // HTTP 入参是 ISO 字符串，仓储 / Drizzle 要求 Date 对象。
    // 在这里统一收口，避免字符串被传给 datetime 列时 Drizzle 内部调 toISOString 失败。
    const occurredAt = input.occurredAt ? new Date(input.occurredAt) : new Date()
    const nextFollowUpAt = input.nextFollowUpAt ? new Date(input.nextFollowUpAt) : null
    return dbManager.transaction(async (tx) => {
      // 重新读取当前 lead，确保 status / owner 等字段在事务内是最新值；
      // 避免访问校验通过后、并发请求之间漏过转换状态变更。
      const locked = await LeadRepository.findById(leadId, tx)
      if (!locked) throw new BusinessError(CrmErrorCode.CRM_LEAD_NOT_FOUND, '线索不存在或已删除')
      const humanActivity = await LeadActivityRepository.create({
        leadId,
        type: input.type,
        content: input.content.trim(),
        occurredAt,
        nextFollowUpAt,
        operatorUserId: currentUser.id,
      }, tx)

      const updatePayload: Parameters<typeof LeadRepository.update>[1] = {
        status: input.followUpStatus,
        lastFollowUpAt: occurredAt,
        nextFollowUpAt,
        updaterId: currentUser.id,
      }
      await LeadRepository.update(leadId, updatePayload, tx)

      // 旧记录的空 status 语义等同于“未处理”，避免补录跟进时产生“未处理 → 未处理”。
      if ((locked.status ?? 'pending') !== input.followUpStatus) {
        await LeadActivityRepository.create({
          leadId,
          type: 'status_change',
          content: `跟进状态由「${statusLabel(locked.status)}」变为「${statusLabel(input.followUpStatus)}」`,
          occurredAt,
          operatorUserId: currentUser.id,
        }, tx)
      }

      // 同一首次跟进会紧接着插入一条 status_change，二者 occurredAt 相同。
      // 不能用“最新一条”作为响应，否则前端会把状态审计误当作用户刚写的跟进。
      const recentActivities = await LeadActivityRepository.listByLeadId(leadId, { limit: 100 }, tx)
      const humanActivityWithOperator = recentActivities.find(
        (activity) => activity.id === humanActivity.id,
      )
      const refreshed = await LeadRepository.findById(leadId, tx)
      return {
        activity: humanActivityWithOperator ?? { ...humanActivity, operatorUserName: null },
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
