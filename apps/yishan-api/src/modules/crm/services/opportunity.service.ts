import { dbManager, type AppQueryDb } from '@/db'
import { BusinessError } from '@/exceptions/business-error.js'
import { computeDataScope, type DataScopeUser } from '../schemas/data-scope.js'
import { CrmErrorCode } from '../schemas/error-codes.js'
import { opportunityStageConfig, type OpportunityAdvanceReq, type OpportunityCreateReq, type OpportunityMarkLostReq, type OpportunityMarkWonReq, type OpportunityUpdateReq } from '../schemas/opportunity.schema.js'
import { ActivityRepository } from '../repositories/activity.repository.js'
import { CustomerRepository } from '../repositories/customer.repository.js'
import { OpportunityRepository, type OpportunityRow, type OpportunityStage } from '../repositories/opportunity.repository.js'
import { CustomerLifecycleService } from './customer-lifecycle.service.js'

const activeStages = ['requirement', 'proposal', 'negotiation'] as const
const trim = (value: string | null | undefined) => value?.trim() || null
const asDate = (value: string | null | undefined) => value ? new Date(value) : null
const amount = (value: number | null | undefined) => {
  if (value === undefined || value === null) return null
  if (!Number.isSafeInteger(value) || value < 0) throw new BusinessError(CrmErrorCode.CRM_OPPORTUNITY_AMOUNT_INVALID, '预计金额必须是非负整数分')
  return value
}

export class OpportunityService {
  async list(query: Parameters<typeof OpportunityRepository.list>[0], currentUser: DataScopeUser) {
    return OpportunityRepository.list({ ...query, ...computeDataScope(currentUser), ownerIds: computeDataScope(currentUser).ownerUserIds }, undefined)
  }

  async detail(id: number, currentUser: DataScopeUser): Promise<OpportunityRow> { const row = await OpportunityRepository.findById(id); if (!row) throw this.notFound(); this.assertVisible(row, currentUser); return row }

  async create({ input, currentUser }: { input: OpportunityCreateReq; currentUser: DataScopeUser }): Promise<OpportunityRow> {
    const name = trim(input.name); const nextAction = trim(input.nextAction)
    if (!name) throw new BusinessError(CrmErrorCode.CRM_OPPORTUNITY_NAME_REQUIRED, '请输入商机名称')
    const stage = input.stage ?? 'requirement'
    if (!activeStages.includes(stage)) throw new BusinessError(CrmErrorCode.CRM_OPPORTUNITY_STAGE_INVALID, '创建商机不能直接选择成交或失败')
    return dbManager.transaction(async (tx) => {
      const customer = await CustomerRepository.findById(input.customerId, tx)
      if (!customer) throw new BusinessError(CrmErrorCode.CRM_CUSTOMER_NOT_FOUND, '客户不存在')
      const row = await OpportunityRepository.create({ name, customerId: input.customerId, primaryContactId: input.primaryContactId ?? null, ownerId: input.ownerId, ownerDepartmentId: customer.ownerDepartmentId, stage, amountCents: amount(input.amountCents), expectedCloseDate: asDate(input.expectedCloseDate), requirement: trim(input.requirement), nextAction, nextFollowUpAt: asDate(input.nextFollowUpAt), remark: trim(input.remark), creatorId: currentUser.id, updaterId: currentUser.id }, tx)
      await OpportunityRepository.replaceProductIntents(row.id, input.productIds ?? [], tx)
      const statusBefore = customer.statusCode
      const statusAfter = await CustomerLifecycleService.recalculate(input.customerId, currentUser.id, tx)
      const activityLines = [`创建商机「${name}」`]
      if (row.amountCents !== null) activityLines.push(`预计金额：${formatCents(row.amountCents)}`)
      if (row.expectedCloseDate) activityLines.push(`预计成交：${formatDate(row.expectedCloseDate)}`)
      if (row.nextAction) activityLines.push(`下一步：${row.nextAction}`)
      await ActivityRepository.create({ customerId: input.customerId, entityType: 'customer', entityId: input.customerId, entityRefType: 'customer', type: 'note', content: activityLines.join('\n'), metadata: { eventType: 'opportunity_created', opportunityId: row.id, opportunityName: name, amountCents: row.amountCents, expectedCloseDate: row.expectedCloseDate?.toISOString() ?? null, stage: row.stage }, operatorUserId: currentUser.id }, tx)
      if (statusBefore !== statusAfter) await ActivityRepository.create({ customerId: input.customerId, entityType: 'customer', entityId: input.customerId, entityRefType: 'customer', type: 'status_change', content: `客户状态由「${customerStatusLabel(statusBefore ?? '')}」变更为「${customerStatusLabel(statusAfter)}」`, metadata: { eventType: 'customer_status_changed', from: statusBefore, to: statusAfter, source: 'opportunity_created' }, operatorUserId: currentUser.id }, tx)
      return (await OpportunityRepository.findById(row.id, tx))!
    })
  }

  async update({ id, input, currentUser }: { id: number; input: OpportunityUpdateReq; currentUser: DataScopeUser }): Promise<OpportunityRow> {
    return dbManager.transaction(async (tx) => {
      const old = await this.requireVisible(id, currentUser, tx)
      const updated = await OpportunityRepository.update(id, { name: input.name === undefined ? undefined : trim(input.name) ?? undefined, primaryContactId: input.primaryContactId, ownerId: input.ownerId, amountCents: input.amountCents === undefined ? undefined : amount(input.amountCents), expectedCloseDate: input.expectedCloseDate === undefined ? undefined : asDate(input.expectedCloseDate), requirement: input.requirement === undefined ? undefined : trim(input.requirement), nextAction: input.nextAction === undefined ? undefined : trim(input.nextAction), nextFollowUpAt: input.nextFollowUpAt === undefined ? undefined : asDate(input.nextFollowUpAt), remark: input.remark === undefined ? undefined : trim(input.remark), updaterId: currentUser.id }, tx)
      if (input.productIds !== undefined) await OpportunityRepository.replaceProductIntents(id, input.productIds, tx)
      await ActivityRepository.create({ customerId: old.customerId, entityType: 'customer', entityId: old.customerId, entityRefType: 'customer', type: 'note', content: `更新商机「${old.name}」`, metadata: { eventType: 'opportunity_updated', opportunityId: id }, operatorUserId: currentUser.id }, tx)
      return (await OpportunityRepository.findById(id, tx)) ?? updated ?? old
    })
  }

  async advanceStage({ id, input, currentUser }: { id: number; input: OpportunityAdvanceReq; currentUser: DataScopeUser }) { const row = await this.detail(id, currentUser); const allowed = { requirement: 'proposal', proposal: 'negotiation' } as const; if (allowed[row.stage as keyof typeof allowed] !== input.toStage) throw new BusinessError(CrmErrorCode.CRM_OPPORTUNITY_STAGE_INVALID, '不支持的商机阶段推进'); return this.changeStage(row, input.toStage, null, input.reason, currentUser) }
  async markWon({ id, input, currentUser }: { id: number; input: OpportunityMarkWonReq; currentUser: DataScopeUser }) { const row = await this.detail(id, currentUser); if (row.stage !== 'negotiation') throw new BusinessError(CrmErrorCode.CRM_OPPORTUNITY_WON_REQUIRES_STAGE, '仅商务谈判阶段可标记成交'); return this.changeStage(row, 'won', null, input.reason, currentUser) }
  async markLost({ id, input, currentUser }: { id: number; input: OpportunityMarkLostReq; currentUser: DataScopeUser }) { const row = await this.detail(id, currentUser); if (!activeStages.includes(row.stage as any)) throw new BusinessError(CrmErrorCode.CRM_OPPORTUNITY_STAGE_INVALID, '终态商机不能标记失败'); return this.changeStage(row, 'lost', input.lostReason, input.reason, currentUser) }
  async delete({ id, currentUser }: { id: number; currentUser: DataScopeUser }) { const row = await this.detail(id, currentUser); await dbManager.transaction(async (tx) => { await OpportunityRepository.softDelete(id, tx); await CustomerLifecycleService.recalculate(row.customerId, currentUser.id, tx) }) }
  async transferOwner({ id, input, currentUser }: { id: number; input: { ownerId: number; reason?: string }; currentUser: DataScopeUser }) { return this.update({ id, input: { ownerId: input.ownerId }, currentUser }) }

  private async changeStage(row: OpportunityRow, stage: OpportunityStage, lostReason: any, reason: string | undefined, currentUser: DataScopeUser) {
    return dbManager.transaction(async (tx) => {
      const updated = await OpportunityRepository.updateStage(row.id, stage, lostReason, currentUser.id, tx)
      const statusBefore = (await CustomerRepository.findById(row.customerId, tx))?.statusCode
      const statusAfter = await CustomerLifecycleService.recalculate(row.customerId, currentUser.id, tx)
      const eventType = stage === 'won' ? 'opportunity_won' : stage === 'lost' ? 'opportunity_lost' : 'opportunity_stage_changed'
      await ActivityRepository.create({ customerId: row.customerId, entityType: 'customer', entityId: row.customerId, entityRefType: 'customer', type: 'note', content: `商机「${row.name}」阶段由「${opportunityStageConfig[row.stage].label}」变更为「${opportunityStageConfig[stage].label}」${reason ? `：${reason}` : ''}`, metadata: { eventType, opportunityId: row.id, fromStage: row.stage, toStage: stage, lostReason }, operatorUserId: currentUser.id }, tx)
      if (statusBefore && statusBefore !== statusAfter) await ActivityRepository.create({ customerId: row.customerId, entityType: 'customer', entityId: row.customerId, entityRefType: 'customer', type: 'status_change', content: `客户状态由「${customerStatusLabel(statusBefore)}」变更为「${customerStatusLabel(statusAfter)}」`, metadata: { eventType: 'customer_status_changed', from: statusBefore, to: statusAfter }, operatorUserId: currentUser.id }, tx)
      return updated!
    })
  }
  private async requireVisible(id: number, user: DataScopeUser, db: AppQueryDb) { const row = await OpportunityRepository.findById(id, db); if (!row) throw this.notFound(); this.assertVisible(row, user); return row }
  private assertVisible(row: OpportunityRow, user: DataScopeUser) { const scope = computeDataScope(user); if (scope.ownerUserIds === null) return; if (scope.ownerUserIds.includes(row.ownerId ?? -1) || (scope.ownerDepartmentIds ?? []).includes(row.ownerDepartmentId ?? -1)) return; throw this.notFound() }
  private notFound() { return new BusinessError(CrmErrorCode.CRM_OPPORTUNITY_NOT_FOUND, '商机不存在或无权访问') }
}
function formatCents(cents: number) { return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', maximumFractionDigits: 0 }).format(cents / 100) }
function formatDate(value: Date | null) { return value ? `${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}` : '-' }
function customerStatusLabel(status: string) { return ({ potential: '潜在', following: '跟进中', opportunity: '有商机', won: '已成交', customer: '已成交', lost: '已流失' } as Record<string, string>)[status] ?? status }
