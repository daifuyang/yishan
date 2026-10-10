import { dbManager } from '@yishan/core-system-api/database'
import { BusinessError } from '@yishan/core-api/errors'
import type { DataScopeUser } from '../schemas/data-scope.js'
import { CrmErrorCode } from '../schemas/error-codes.js'
import { ActivityRepository } from '../repositories/activity.repository.js'
import { DirectCloseRepository, type DirectCloseEvidenceType, type DirectCloseRow } from '../repositories/direct-close.repository.js'
import { OpportunityRepository } from '../repositories/opportunity.repository.js'
import { CustomerService } from './customer.service.js'
import { CustomerLifecycleService } from './customer-lifecycle.service.js'

export interface DirectCloseConfirmInput {
  amountCents: number
  closedAt: Date
  evidenceType: DirectCloseEvidenceType
  attachmentIds?: number[]
  remark?: string
}

export interface DirectCloseRevokeInput {
  reason: string
}

export interface DirectCloseActionResult {
  directClose: DirectCloseRow
  statusCode: string
}

function normalizedEvidence(input: DirectCloseConfirmInput): { attachmentIds: number[] | null; remark: string | null } {
  const attachmentIds = [...new Set(input.attachmentIds ?? [])]
  const remark = input.remark?.trim() ?? ''
  if (attachmentIds.length === 0 && !remark) {
    throw new BusinessError(CrmErrorCode.CRM_DIRECT_CLOSE_EVIDENCE_REQUIRED, '请上传成交凭证或填写成交说明')
  }
  return { attachmentIds: attachmentIds.length ? attachmentIds : null, remark: remark || null }
}

function assertConfirmInput(input: DirectCloseConfirmInput): void {
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents < 0) {
    throw new BusinessError(CrmErrorCode.CRM_DIRECT_CLOSE_AMOUNT_INVALID, '成交金额必须是非负安全整数')
  }
  if (!(input.closedAt instanceof Date) || Number.isNaN(input.closedAt.getTime())) {
    throw new BusinessError(CrmErrorCode.CRM_DIRECT_CLOSE_AMOUNT_INVALID, '成交日期无效')
  }
}

/** Controlled no-contract close. It deliberately creates no order or contract. */
export class DirectCloseService {
  async confirm(opportunityId: number, input: DirectCloseConfirmInput, currentUser: DataScopeUser): Promise<DirectCloseActionResult> {
    assertConfirmInput(input)
    const evidence = normalizedEvidence(input)

    return dbManager.transaction(async (tx) => {
      // Locking the opportunity serializes the one-active-close business rule.
      const opportunity = await OpportunityRepository.findByIdForUpdate(opportunityId, tx)
      if (!opportunity || opportunity.stage !== 'won') {
        throw new BusinessError(CrmErrorCode.CRM_DIRECT_CLOSE_OPPORTUNITY_NOT_WON, '仅赢单商机可以确认无合同成交')
      }
      const customer = await new CustomerService({ db: tx }).detail(opportunity.customerId, currentUser)
      if (customer.relationshipStatus === 'lost') {
        throw new BusinessError(CrmErrorCode.CRM_CUSTOMER_LOST, '流失客户需重新激活后才能确认成交')
      }
      if (await DirectCloseRepository.findActiveByOpportunityId(opportunityId, tx)) {
        throw new BusinessError(CrmErrorCode.CRM_DIRECT_CLOSE_ALREADY_CONFIRMED, '该商机已有有效的无合同成交确认')
      }
      const created = await DirectCloseRepository.create({
        customerId: opportunity.customerId,
        opportunityId,
        amountCents: input.amountCents,
        closedAt: input.closedAt,
        evidenceType: input.evidenceType,
        attachmentIds: evidence.attachmentIds,
        remark: evidence.remark,
        creatorId: currentUser.id,
        updaterId: currentUser.id,
      }, tx)
      const directClose = await DirectCloseRepository.findById(created.id, tx)
      if (!directClose) throw new BusinessError(CrmErrorCode.CRM_DIRECT_CLOSE_NOT_FOUND, '无合同成交确认不存在')
      const statusCode = await CustomerLifecycleService.recalculate(opportunity.customerId, currentUser.id, tx)
      await ActivityRepository.create({
        customerId: opportunity.customerId,
        entityType: 'customer',
        entityId: opportunity.customerId,
        entityRefType: 'direct_close',
        type: 'status_change',
        content: '已确认无合同成交',
        metadata: {
          source: 'direct_close_confirmed',
          directCloseId: directClose.id,
          opportunityId,
          amountCents: directClose.amountCents,
          evidenceType: directClose.evidenceType,
          statusCode,
        },
        operatorUserId: currentUser.id,
      }, tx)
      return { directClose, statusCode }
    })
  }

  async revoke(id: number, input: DirectCloseRevokeInput, currentUser: DataScopeUser): Promise<DirectCloseActionResult> {
    const reason = input.reason.trim()
    if (!reason) {
      throw new BusinessError(CrmErrorCode.CRM_DIRECT_CLOSE_REVOKE_REASON_REQUIRED, '请填写撤销原因')
    }
    return dbManager.transaction(async (tx) => {
      const existing = await DirectCloseRepository.findByIdForUpdate(id, tx)
      if (!existing) throw new BusinessError(CrmErrorCode.CRM_DIRECT_CLOSE_NOT_FOUND, '无合同成交确认不存在')
      await new CustomerService({ db: tx }).detail(existing.customerId, currentUser)
      if (existing.revokedAt) {
        throw new BusinessError(CrmErrorCode.CRM_DIRECT_CLOSE_NOT_FOUND, '无合同成交确认已撤销')
      }
      const directClose = await DirectCloseRepository.revoke(id, reason, currentUser.id, tx)
      if (!directClose) throw new BusinessError(CrmErrorCode.CRM_DIRECT_CLOSE_NOT_FOUND, '无合同成交确认不存在')
      const statusCode = await CustomerLifecycleService.recalculate(existing.customerId, currentUser.id, tx)
      await ActivityRepository.create({
        customerId: existing.customerId,
        entityType: 'customer',
        entityId: existing.customerId,
        entityRefType: 'direct_close',
        type: 'status_change',
        content: '已撤销无合同成交确认',
        metadata: { source: 'direct_close_revoked', directCloseId: id, opportunityId: existing.opportunityId, reason, statusCode },
        operatorUserId: currentUser.id,
      }, tx)
      return { directClose, statusCode }
    })
  }
}
