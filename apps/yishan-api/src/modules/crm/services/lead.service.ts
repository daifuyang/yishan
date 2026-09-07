import { BusinessError } from '@/exceptions/business-error.js'
import { dbManager } from '@/db'
import type { DataScopeUser } from '../schemas/data-scope.js'
import { CrmErrorCode } from '../schemas/error-codes.js'
import {
  LEAD_DISQUALIFY_CODE_LABELS,
  type LeadDisqualifyCode,
} from '../schemas/lead.schema.js'
import { LeadRepository, type LeadListQuery, type LeadRow } from '../repositories/lead.repository.js'
import { LeadActivityRepository } from '../repositories/lead-activity.repository.js'
import { computeDataScope } from '../schemas/data-scope.js'

const STATUS_LABELS: Record<LeadRow['status'], string> = {
  pending: '未处理', contact_valid: '联系方式有效',
  contact_invalid: '联系方式无效', closed: '已关闭',
}

/**
 * 「创建」输入：不含 ownerUserId/ownerDepartmentId/poolStatus。
 * 服务层根据当前认证用户自动绑定 createdBy/ownerUserId/poolStatus，
 * 避免前端伪造归属。createdBy 与 ownerUserId 是两个独立概念。
 */
export interface CreateLeadArgs {
  input: {
    name?: string | null
    companyName?: string | null
    mobile?: string | null
    phone?: string | null
    email?: string | null
    wechat?: string | null
    qq?: string | null
    sourceId?: number | null
    intention?: string | null
  }
  currentUser: DataScopeUser
}

/**
 * 「编辑资料」输入：仅允许白名单字段。
 *
 * 不允许在此出现的字段（必须走专门业务接口）：
 *   - ownerUserId / ownerDepartmentId / poolStatus → assign / returnToPool
 *   - status                                    → qualify / disqualify / reactivate
 *   - convertedCustomerId / convertedAt          → convert
 *   - disqualifyReason / disqualifyCode         → disqualify
 *
 * 字段变化以 diff 形式写入 crm_lead_activity，type='profile_edit'，
 * Activity Timeline UI 会过滤该类型，普通编辑不会污染业务动态。
 */
export interface UpdateLeadArgs {
  leadId: number
  input: {
    name?: string | null
    companyName?: string | null
    mobile?: string | null
    phone?: string | null
    email?: string | null
    wechat?: string | null
    qq?: string | null
    sourceId?: number | null
    intention?: string | null
  }
  currentUser: DataScopeUser
}

const EDITABLE_PROFILE_FIELDS = [
  'name', 'companyName', 'mobile', 'phone', 'email', 'wechat', 'qq', 'sourceId', 'intention',
] as const
type EditableProfileField = (typeof EDITABLE_PROFILE_FIELDS)[number]

const PROFILE_FIELD_LABELS: Record<EditableProfileField, string> = {
  name: '联系人',
  companyName: '公司',
  mobile: '手机',
  phone: '电话',
  email: '邮箱',
  wechat: '微信',
  qq: 'QQ',
  sourceId: '来源',
  intention: '意向说明',
}

function diffValue(prev: unknown, next: unknown): string {
  const a = prev === null || prev === undefined ? '—' : String(prev)
  const b = next === null || next === undefined ? '—' : String(next)
  return `${a} → ${b}`
}

/** 任一联系方式非空即视为"可联系"。 */
function hasUsableContactChannel(lead: LeadRow): boolean {
  return Boolean(
    (lead.mobile && lead.mobile.trim()) ||
    (lead.phone && lead.phone.trim()) ||
    (lead.email && lead.email.trim()) ||
    (lead.wechat && lead.wechat.trim()),
  )
}

/**
 * Lead business rules. Persistence and lifecycle operations are added in the
 * following slices; this first boundary prevents un-actionable records from
 * ever entering the lead pipeline.
 */
export class LeadService {
  async list(query: LeadListQuery, currentUser: DataScopeUser): Promise<{ items: LeadRow[]; total: number; page: number; pageSize: number }> {
    const scope = computeDataScope(currentUser)
    const result = await LeadRepository.list({ ...query, ...scope })
    return { items: result.rows, total: result.total, page: query.page ?? 1, pageSize: query.pageSize ?? 10 }
  }

  async create({ input, currentUser }: CreateLeadArgs): Promise<LeadRow> {
    const name = input.name?.trim() ?? ''
    if (!name) {
      throw new BusinessError(
        CrmErrorCode.CRM_LEAD_CONTACT_REQUIRED,
        '请输入联系人姓名',
      )
    }
    const departmentId = currentUser.deptIds?.[0] ?? null
    return LeadRepository.create({
      ...input,
      name,
      // 创建人即默认负责人：createdBy/ownerUserId 一致，poolStatus='owned'
      ownerUserId: currentUser.id,
      ownerDepartmentId: departmentId,
      createdBy: currentUser.id,
      creatorId: currentUser.id,
      updaterId: currentUser.id,
      poolStatus: 'owned',
    })
  }

  /**
   * 作废线索。允许：new / processing / qualified → disqualified。
   * 必须给标准化 code + 解释；不允许处理 converted 线索。
   */
  async disqualify({
    leadId,
    code,
    reason,
    currentUser,
  }: {
    leadId: number
    code: LeadDisqualifyCode
    reason: string
    currentUser: DataScopeUser
  }): Promise<LeadRow> {
    const trimmedReason = reason.trim()
    if (!trimmedReason) {
      throw new BusinessError(CrmErrorCode.CRM_LEAD_DISQUALIFY_REASON_REQUIRED, '请填写作废原因')
    }
    return dbManager.transaction(async (tx) => {
      const lead = await this.getAccessibleLead(leadId, currentUser, tx)
      if (lead.convertedCustomerId !== null || lead.status === 'contact_invalid') {
        throw new BusinessError(CrmErrorCode.CRM_LEAD_STATUS_INVALID, '当前状态不能作废线索')
      }
      const updated = await LeadRepository.update(leadId, {
        status: 'contact_invalid',
        disqualifyReason: trimmedReason,
        disqualifyCode: code,
        updaterId: currentUser.id,
      }, tx)
      if (!updated) throw new BusinessError(CrmErrorCode.CRM_LEAD_NOT_FOUND, '线索不存在或已删除')
      const codeLabel = LEAD_DISQUALIFY_CODE_LABELS[code] ?? code
      await LeadActivityRepository.create({
        leadId,
        type: 'status_change',
        content: `${STATUS_LABELS[lead.status]} → ${STATUS_LABELS.contact_invalid}（${codeLabel}）：${trimmedReason}`,
        operatorUserId: currentUser.id,
      }, tx)
      return updated
    })
  }

  /**
   * 编辑线索普通资料。
   *
   * 边界：
   *   - 仅白名单字段会被写入；其余字段被忽略（owner/status/pool/converted 不允许）。
   *   - 联系人姓名为空时不通过。
   *   - 终态线索（已转化 / 已无效）不可编辑。
   *   - 没有字段实际变化时不写库、不写审计。
   *   - 字段变化以 crm_lead_activity type='profile_edit' 形式记录，UI Timeline 过滤。
   */
  async update({ leadId, input, currentUser }: UpdateLeadArgs): Promise<LeadRow> {
    const lead = await this.getAccessibleLead(leadId, currentUser)
    if (lead.convertedCustomerId !== null || lead.status === 'contact_invalid') {
      throw new BusinessError(CrmErrorCode.CRM_LEAD_STATUS_INVALID, '已转化或无效线索不可编辑')
    }
    const patch: Partial<Record<EditableProfileField, unknown>> = {}
    for (const field of EDITABLE_PROFILE_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(input, field)) {
        patch[field] = input[field]
      }
    }
    if (patch.name !== undefined) {
      const trimmed = String(patch.name ?? '').trim()
      if (!trimmed) {
        throw new BusinessError(CrmErrorCode.CRM_LEAD_CONTACT_REQUIRED, '请输入联系人姓名')
      }
      patch.name = trimmed
    }
    const changed = EDITABLE_PROFILE_FIELDS.filter((field) => {
      if (!(field in patch)) return false
      const prev = lead[field]
      const next = patch[field]
      // 简化比较：null/undefined/空字符串视为同一「空」状态
      const prevNorm = prev === null || prev === undefined ? '' : String(prev)
      const nextNorm = next === null || next === undefined ? '' : String(next)
      return prevNorm !== nextNorm
    })
    if (changed.length === 0) return lead

    const updated = await LeadRepository.update(leadId, {
      ...(patch as Record<string, unknown>),
      updaterId: currentUser.id,
    } as Parameters<typeof LeadRepository.update>[1])
    if (!updated) throw new BusinessError(CrmErrorCode.CRM_LEAD_NOT_FOUND, '线索不存在或已删除')

    const diffLines = changed
      .map((field) => `${PROFILE_FIELD_LABELS[field]}：${diffValue(lead[field], patch[field])}`)
      .join('\n')
    await LeadActivityRepository.create({
      leadId,
      type: 'profile_edit',
      content: diffLines,
      operatorUserId: currentUser.id,
    })
    return updated
  }

  /**
   * 判为有效（qualified）。要求：
   *   - 终态（converted / disqualified）拒绝。
   *   - 必须有可联系通道。
   *   - evidence + nextAction 必须 trim 后非空。
   */
  async qualify({
    leadId,
    evidence,
    nextAction,
    currentUser,
  }: {
    leadId: number
    evidence: string
    nextAction: string
    currentUser: DataScopeUser
  }): Promise<LeadRow> {
    const trimmedEvidence = evidence.trim()
    const trimmedNextAction = nextAction.trim()
    if (!trimmedEvidence || !trimmedNextAction) {
      throw new BusinessError(CrmErrorCode.CRM_LEAD_QUALIFICATION_REQUIRED, '请填写资格证据和下一步')
    }
    return dbManager.transaction(async (tx) => {
      const lead = await this.getAccessibleLead(leadId, currentUser, tx)
      if (lead.convertedCustomerId !== null || lead.status === 'contact_invalid') {
        throw new BusinessError(CrmErrorCode.CRM_LEAD_STATUS_INVALID, '当前状态不能判为有效')
      }
      if (!hasUsableContactChannel(lead)) {
        throw new BusinessError(
          CrmErrorCode.CRM_LEAD_QUALIFICATION_REQUIRED,
          '请先补全至少一个可联系的渠道（手机/电话/邮箱/微信）',
        )
      }
      const updated = await LeadRepository.update(leadId, {
        status: 'contact_valid',
        updaterId: currentUser.id,
      }, tx)
      if (!updated) throw new BusinessError(CrmErrorCode.CRM_LEAD_NOT_FOUND, '线索不存在或已删除')
      await LeadActivityRepository.create({
        leadId,
        type: 'status_change',
        content: [
          `${STATUS_LABELS[lead.status]} → ${STATUS_LABELS.contact_valid}`,
          `资格证据：${trimmedEvidence}`,
          `下一步：${trimmedNextAction}`,
        ].join('\n'),
        operatorUserId: currentUser.id,
      }, tx)
      return updated
    })
  }

  /**
   * 重新激活（disqualified → processing）。是受权限控制的纠正动作：
   *   - 仅 disqualified 状态允许；其他任何状态（含 converted）一律拒绝。
   *   - 必须给出原因；清空历史 disqualifyCode / disqualifyReason。
   *   - 写一条 status_change 审计事件，说明"重新激活 + 原因"。
   */
  async reactivate({
    leadId,
    reason,
    currentUser,
  }: {
    leadId: number
    reason: string
    currentUser: DataScopeUser
  }): Promise<LeadRow> {
    const trimmedReason = reason.trim()
    if (!trimmedReason) {
      throw new BusinessError(CrmErrorCode.CRM_LEAD_REACTIVATE_REASON_REQUIRED, '请填写重新激活原因')
    }
    return dbManager.transaction(async (tx) => {
      const lead = await this.getAccessibleLead(leadId, currentUser, tx)
      if (lead.status !== 'contact_invalid') {
        throw new BusinessError(CrmErrorCode.CRM_LEAD_REACTIVATE_INVALID_STATE, '仅无效线索可重新激活')
      }
      const updated = await LeadRepository.update(leadId, {
        status: 'pending',
        disqualifyReason: null,
        disqualifyCode: null,
        updaterId: currentUser.id,
      }, tx)
      if (!updated) throw new BusinessError(CrmErrorCode.CRM_LEAD_NOT_FOUND, '线索不存在或已删除')
      await LeadActivityRepository.create({
        leadId,
        type: 'status_change',
        content: `${STATUS_LABELS.contact_invalid} → ${STATUS_LABELS.pending}（重新激活）：${trimmedReason}`,
        operatorUserId: currentUser.id,
      }, tx)
      return updated
    })
  }

  async assign({ leadId, targetUserId, currentUser }: { leadId: number; targetUserId: number | null; currentUser: DataScopeUser }): Promise<LeadRow> {
    const lead = await this.getAccessibleLead(leadId, currentUser)
    if (lead.convertedCustomerId !== null || lead.status === 'contact_invalid') throw new BusinessError(CrmErrorCode.CRM_LEAD_STATUS_INVALID, '当前状态不能分配线索')
    // 进入公海 ownerUserId 必须置 null，同时显式标注 poolStatus='public'
    const nextOwner = targetUserId
    const updated = await LeadRepository.update(leadId, {
      ownerUserId: nextOwner,
      ownerDepartmentId: nextOwner === null ? null : lead.ownerDepartmentId,
      poolStatus: nextOwner === null ? 'public' : 'owned',
      updaterId: currentUser.id,
    })
    if (!updated) throw new BusinessError(CrmErrorCode.CRM_LEAD_NOT_FOUND, '线索不存在或已删除')
    // 仅在 ownerUserId 实际发生变化时记录 owner_change，避免"自指"噪音。
    if (lead.ownerUserId !== nextOwner) {
      const detail = nextOwner === null
        ? `${lead.ownerUserName ?? '暂未分配'} → 退回公海`
        : `${lead.ownerUserName ?? '暂未分配'} → 用户 #${nextOwner}`
      await this.recordSystemEvent(leadId, 'owner_change', detail, currentUser.id)
    }
    return updated
  }

  async claim({ leadId, currentUser }: { leadId: number; currentUser: DataScopeUser }): Promise<LeadRow> {
    const departmentId = currentUser.deptIds?.[0] ?? null
    return dbManager.transaction(async (tx) => {
      const affected = await LeadRepository.claimInTx(leadId, currentUser.id, departmentId, currentUser.id, tx)
      if (affected === 0) {
        const lead = await LeadRepository.findById(leadId, tx)
        if (!lead) throw new BusinessError(CrmErrorCode.CRM_LEAD_NOT_FOUND, '线索不存在或已删除')
        throw new BusinessError(CrmErrorCode.CRM_LEAD_ALREADY_OWNED, '线索已被领取或当前不能领取')
      }
      const lead = await LeadRepository.findById(leadId, tx)
      if (!lead) throw new BusinessError(CrmErrorCode.CRM_LEAD_NOT_FOUND, '线索不存在或已删除')
      await LeadActivityRepository.create({
        leadId,
        type: 'owner_change',
        content: `公海 → ${lead.ownerUserName ?? `用户 #${currentUser.id}`}`,
        operatorUserId: currentUser.id,
      }, tx)
      return lead
    })
  }

  private async getAccessibleLead(
    leadId: number,
    currentUser: DataScopeUser,
    db?: Parameters<typeof LeadRepository.findById>[1],
  ): Promise<LeadRow> {
    const lead = await LeadRepository.findById(leadId, db)
    if (!lead) throw new BusinessError(CrmErrorCode.CRM_LEAD_NOT_FOUND, '线索不存在或已删除')
    const scope = computeDataScope(currentUser)
    // 公海线索（poolStatus='public'）按显式归属状态判断可见，不依赖 ownerUserId。
    const inPublicPool = lead.poolStatus === 'public'
    const permitted = scope.ownerUserIds === null || inPublicPool || scope.ownerUserIds?.includes(lead.ownerUserId ?? -1) || scope.ownerDepartmentIds?.includes(lead.ownerDepartmentId ?? -1)
    if (!permitted) throw new BusinessError(CrmErrorCode.CRM_LEAD_NOT_FOUND, '线索不存在或已删除')
    return lead
  }

  private async recordSystemEvent(leadId: number, type: 'status_change' | 'owner_change', content: string, operatorUserId: number): Promise<void> {
    await LeadActivityRepository.create({ leadId, type, content, operatorUserId })
  }
}
