import { dbManager, type AppQueryDb } from '@/db'
import { BusinessError } from '@/exceptions/business-error.js'
import { computeDataScope, type DataScopeUser } from '../schemas/data-scope.js'
import { CrmErrorCode } from '../schemas/error-codes.js'
import { LeadRepository, type LeadRow } from '../repositories/lead.repository.js'
import { LeadActivityRepository } from '../repositories/lead-activity.repository.js'
import { CustomerRepository, type CustomerRow } from '../repositories/customer.repository.js'
import { ContactRepository, type ContactRow } from '../repositories/contact.repository.js'

/** 转化预览：线索 + 客户候选 + 联系人候选。 */
export interface LeadConversionPreview {
  lead: LeadRow
  customers: Array<{
    id: number
    name: string
    type: string
    ownerUserId: number | null
    ownerUserName: string | null
  }>
  contacts: Array<{
    id: number
    customerId: number
    name: string
    mobile: string | null
    email: string | null
  }>
}

/** 转化输入：客户决策 + 联系人决策。 */
export interface LeadConvertInput {
  customer:
    | { mode: 'existing'; customerId: number }
    | { mode: 'create'; name: string; type: 'enterprise' | 'individual'; phone?: string | null }
  contact:
    | { mode: 'existing'; contactId: number }
    | { mode: 'create'; name: string; mobile?: string | null; phone?: string | null; email?: string | null }
}

export interface LeadConversionResult {
  lead: LeadRow
  customer: CustomerRow
  contact: ContactRow
}

/**
 * LeadConversionService —— 把一条未转化线索安全转为客户+联系人。
 *
 * 关键约束（来自 spec）：
 *   - 所有 follow-up status 均可转换；已转化线索不可重复转换。
 *   - 单一事务：客户/联系人 create + 线索 update + status_change activity 全部 commit/rollback。
 *   - 客户/联系人的"关联现有"必须满足可见性 / 归属关系。
 *   - 不会改写现有客户的 owner / source / poolStatus；只在新创建时按线索的归属复制。
 *
 * 与 CustomerService.create 的区别：本服务避免走 CustomerService.create 的嵌套事务和完整查重流程；
 * 预览阶段已经看过了候选，转事务时只做可见性校验，不重复查重。
 */
export class LeadConversionService {
  constructor(private readonly deps: { db?: AppQueryDb } = {}) {}

  /**
   * 预览：返回线索 + 客户候选 + 联系人候选。
   * 候选是提示，不是授权——actor 仍然只能选自己数据范围内的客户/联系人。
   */
  async preview(leadId: number, currentUser: DataScopeUser): Promise<LeadConversionPreview> {
    const lead = await this.getAccessibleLead(leadId, currentUser)
    const candidates = await CustomerRepository.findConversionCandidates(
      { name: lead.companyName, phone: lead.phone ?? lead.mobile, type: 'enterprise' },
      this.deps.db,
    )
    const contacts = await ContactRepository.findConversionCandidates(
      { mobile: lead.mobile, email: lead.email },
      this.deps.db,
    )
    return {
      lead,
      customers: candidates.map((c) => ({ ...c, ownerUserName: null })),
      contacts,
    }
  }

  /**
   * 执行转化。事务内：
   *   1. 锁行 + 校验尚未转化
   *   2. 校验 customer / contact 可见性
   *   3. create customer / contact（如需）
   *   4. 把联系人设为该客户的主联系人
   *   5. update lead 仅写转换引用 + convertedAt，保留 follow-up status
   *   6. 写 status_change 审计活动
   */
  async convert(leadId: number, input: LeadConvertInput, currentUser: DataScopeUser): Promise<LeadConversionResult> {
    // 事务外做一次访问校验 + 重复转化守卫
    await this.getAccessibleLead(leadId, currentUser)

    return dbManager.transaction(async (tx) => {
      // 1) 行锁 + 重复转化守卫
      const locked = await LeadRepository.lockAvailableForConversionInTx(leadId, tx)
      if (!locked) {
        throw new BusinessError(
          CrmErrorCode.CRM_LEAD_CONVERSION_CONFLICT,
          '该线索已被其他用户转化',
        )
      }

      // 2) 客户决策：existing → 数据范围可见 + 未被软删；create → 直接走创建
      let customer: CustomerRow
      if (input.customer.mode === 'existing') {
        const existing = await CustomerRepository.findById(input.customer.customerId, tx)
        if (!existing) {
          throw new BusinessError(CrmErrorCode.CRM_LEAD_CONVERSION_SELECTION_INVALID, '所选客户不存在')
        }
        this.assertCustomerVisible(existing, currentUser)
        customer = existing
      } else {
        customer = await CustomerRepository.create({
          name: input.customer.name,
          type: input.customer.type,
          phone: input.customer.phone ?? locked.mobile ?? locked.phone ?? null,
          sourceId: locked.sourceId,
          ownerUserId: locked.ownerUserId,
          ownerDepartmentId: locked.ownerDepartmentId,
          poolStatus: locked.ownerUserId ? 'owned' : 'public',
          creatorId: currentUser.id,
          updaterId: currentUser.id,
        }, tx)
      }

      // 3) 联系人决策
      let contact: ContactRow
      if (input.contact.mode === 'existing') {
        const existing = await ContactRepository.findById(input.contact.contactId, tx)
        if (!existing) {
          throw new BusinessError(CrmErrorCode.CRM_LEAD_CONVERSION_SELECTION_INVALID, '所选联系人不存在')
        }
        if (existing.customerId !== customer.id) {
          throw new BusinessError(
            CrmErrorCode.CRM_LEAD_CONVERSION_SELECTION_INVALID,
            '所选联系人必须属于所选客户',
          )
        }
        // 设为主联系人（清空该客户其他 primary）
        await ContactRepository.setPrimaryInTx(existing.id, customer.id, tx)
        contact = existing
      } else {
        const merged = {
          customerId: customer.id,
          name: input.contact.name,
          mobile: input.contact.mobile ?? locked.mobile ?? null,
          phone: input.contact.phone ?? locked.phone ?? null,
          email: input.contact.email ?? locked.email ?? null,
          isPrimary: 1,
          creatorId: currentUser.id,
          updaterId: currentUser.id,
        }
        contact = await ContactRepository.create(merged, tx)
      }

      // 4) 锁定线索 → converted
      const convertedAt = new Date()
      const updatedLead = await LeadRepository.update(leadId, {
        convertedCustomerId: customer.id,
        convertedContactId: contact.id,
        convertedAt,
        updaterId: currentUser.id,
      }, tx)
      if (!updatedLead) {
        throw new BusinessError(CrmErrorCode.CRM_LEAD_NOT_FOUND, '线索不存在或已删除')
      }

      // 5) 审计活动
      await LeadActivityRepository.create({
        leadId,
        type: 'status_change',
        content: `关联客户：${customer.name}；联系人：${contact.name}`,
        operatorUserId: currentUser.id,
      }, tx)

      return { lead: updatedLead, customer, contact }
    })
  }

  private async getAccessibleLead(leadId: number, currentUser: DataScopeUser): Promise<LeadRow> {
    const lead = await LeadRepository.findById(leadId, this.deps.db)
    if (!lead) throw new BusinessError(CrmErrorCode.CRM_LEAD_NOT_FOUND, '线索不存在或已删除')
    if (lead.convertedCustomerId !== null) {
      throw new BusinessError(CrmErrorCode.CRM_LEAD_CONVERSION_NOT_QUALIFIED, '线索已被转化')
    }
    const scope = computeDataScope(currentUser)
    const inPublicPool = lead.poolStatus === 'public'
    const permitted = scope.ownerUserIds === null
      || inPublicPool
      || scope.ownerUserIds?.includes(lead.ownerUserId ?? -1)
      || scope.ownerDepartmentIds?.includes(lead.ownerDepartmentId ?? -1)
    if (!permitted) throw new BusinessError(CrmErrorCode.CRM_LEAD_NOT_FOUND, '线索不存在或已删除')
    return lead
  }

  /**
   * 复用 CustomerService.assertCanOperate 的核心规则（精简）：
   * super_admin 全可见；其余角色必须在用户/部门范围内，或在公海。
   */
  private assertCustomerVisible(row: CustomerRow, user: DataScopeUser): void {
    const scope = computeDataScope(user)
    if (scope.ownerUserIds === null) return
    const allowedUserIds = scope.ownerUserIds ?? []
    const allowedDeptIds = scope.ownerDepartmentIds ?? []
    const inUserScope = row.ownerUserId !== null && allowedUserIds.includes(row.ownerUserId)
    const inDeptScope = row.ownerDepartmentId !== null && allowedDeptIds.includes(row.ownerDepartmentId)
    const inPool = row.poolStatus === 'public'
    if (!inUserScope && !inDeptScope && !inPool) {
      throw new BusinessError(
        CrmErrorCode.CRM_LEAD_CONVERSION_SELECTION_INVALID,
        '所选客户不在当前用户的数据范围内',
      )
    }
  }
}
