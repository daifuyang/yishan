import { dbManager, type AppQueryDb } from '@/db'
import { BusinessError } from '@/exceptions/business-error.js'
import { computeDataScope, type DataScopeUser } from '../schemas/data-scope.js'
import { CrmErrorCode } from '../schemas/error-codes.js'
import { opportunityStageConfig, type OpportunityAdvanceReq, type OpportunityCreateReq, type OpportunityMarkLostReq, type OpportunityMarkWonReq, type OpportunityUpdateReq } from '../schemas/opportunity.schema.js'
import { OPEN_OPPORTUNITY_STAGE_VALUES } from '../domain/statuses.js'
import { ActivityRepository } from '../repositories/activity.repository.js'
import { ContactRepository } from '../repositories/contact.repository.js'
import { CustomerRepository } from '../repositories/customer.repository.js'
import { OpportunityRepository, type OpportunityLostReason, type OpportunityRow, type OpportunityStage } from '../repositories/opportunity.repository.js'
import { SourceRepository } from '../repositories/source.repository.js'
import { CustomerLifecycleService } from './customer-lifecycle.service.js'
import { BusinessNumberRepository } from '../repositories/business-number.repository.js'

const activeStages = OPEN_OPPORTUNITY_STAGE_VALUES
const trim = (value: string | null | undefined) => value?.trim() || null
const asDate = (value: string | null | undefined) => value ? new Date(value) : null
const amount = (value: number | null | undefined) => {
  if (value === undefined || value === null) return null
  if (!Number.isSafeInteger(value) || value < 0) throw new BusinessError(CrmErrorCode.CRM_OPPORTUNITY_AMOUNT_INVALID, '预计金额必须是非负整数分')
  return value
}
const normalizeOpportunityName = (value: string) => value.replace(/[\s\u3000]+/g, '').toLocaleLowerCase()
const sameCreationPayload = (existing: OpportunityRow, input: OpportunityCreateReq, name: string, currentUser: DataScopeUser) => {
  if (existing.customerId !== input.customerId || normalizeOpportunityName(existing.name) !== normalizeOpportunityName(name)) return false
  if (existing.creatorId !== currentUser.id && existing.ownerId !== input.ownerId) return false
  if (input.amountCents !== undefined && (existing.amountCents ?? null) !== (input.amountCents ?? null)) return false
  if (input.expectedCloseDate !== undefined) {
    const expected = input.expectedCloseDate ? new Date(input.expectedCloseDate).getTime() : null
    if ((existing.expectedCloseDate?.getTime() ?? null) !== expected) return false
  }
  return true
}
const opportunityNumberPrefix = () => {
  const now = new Date()
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
  return `OPP-${ym}-`
}
const duplicateConstraint = (error: unknown, constraint: string) => {
  if (!error || typeof error !== 'object') return false
  const candidate = error as { code?: string; sqlMessage?: string; cause?: unknown }
  const code = candidate.code ?? (candidate.cause && typeof candidate.cause === 'object' ? (candidate.cause as { code?: string }).code : undefined)
  const message = `${candidate.sqlMessage ?? ''} ${candidate.cause && typeof candidate.cause === 'object' ? (candidate.cause as { sqlMessage?: string }).sqlMessage ?? '' : ''}`
  return code === 'ER_DUP_ENTRY' && message.includes(constraint)
}

export class OpportunityService {
  async duplicateCandidates({ customerId, name, currentUser }: { customerId: number; name: string; currentUser: DataScopeUser }) {
    const normalized = normalizeOpportunityName(name.trim())
    if (!normalized) return []
    // Fetch all open candidates before normalization: SQL LIKE/pagination can
    // miss names whose only difference is full-width/ASCII whitespace.
    const rows = await OpportunityRepository.findOpenByCustomerId(customerId)
    return rows.filter((row) => {
      try {
        this.assertVisible(row, currentUser)
        return normalizeOpportunityName(row.name) === normalized
      } catch {
        return false
      }
    })
  }
  async list(
    query: Parameters<typeof OpportunityRepository.list>[0] & { expectedCloseFrom?: Date | string; expectedCloseTo?: Date | string },
    currentUser: DataScopeUser,
  ) {
    return OpportunityRepository.list({
      ...query,
      expectedCloseFrom: typeof query.expectedCloseFrom === 'string' ? new Date(query.expectedCloseFrom) : query.expectedCloseFrom,
      expectedCloseTo: typeof query.expectedCloseTo === 'string' ? new Date(query.expectedCloseTo) : query.expectedCloseTo,
      ...computeDataScope(currentUser),
      ownerIds: computeDataScope(currentUser).ownerUserIds,
    }, undefined)
  }

  async detail(id: number, currentUser: DataScopeUser): Promise<OpportunityRow> { const row = await OpportunityRepository.findById(id); if (!row) throw this.notFound(); this.assertVisible(row, currentUser); return row }

  async create({ input, currentUser }: { input: OpportunityCreateReq; currentUser: DataScopeUser }): Promise<OpportunityRow> {
    const name = trim(input.name); const nextAction = trim(input.nextAction)
    const requirement = trim(input.requirement)
    if (!name) throw new BusinessError(CrmErrorCode.CRM_OPPORTUNITY_NAME_REQUIRED, '请输入商机名称')
    if (!requirement) throw new BusinessError(CrmErrorCode.CRM_OPPORTUNITY_NAME_REQUIRED, '请填写需求摘要')
    const stage = input.stage ?? 'needs_confirmation'
    if (!(activeStages as readonly string[]).includes(stage)) throw new BusinessError(CrmErrorCode.CRM_OPPORTUNITY_STAGE_INVALID, '创建商机不能直接选择赢单或输单')
    if (input.creationKey) {
      const existing = await OpportunityRepository.findByCreationKey(input.creationKey)
      if (existing) {
        if (sameCreationPayload(existing, input, name, currentUser)) return existing
        throw new BusinessError(CrmErrorCode.CRM_OPPORTUNITY_IDEMPOTENCY_CONFLICT, '创建请求幂等键已被使用')
      }
    }
    const createInTransaction = () => dbManager.transaction(async (tx) => {
      const customer = await CustomerRepository.findById(input.customerId, tx)
      if (!customer) throw new BusinessError(CrmErrorCode.CRM_CUSTOMER_NOT_FOUND, '客户不存在')
      if (input.primaryContactId) {
        const contact = await ContactRepository.findById(input.primaryContactId, tx)
        if (!contact || contact.customerId !== input.customerId) {
          throw new BusinessError(CrmErrorCode.CRM_CONTACT_CUSTOMER_MISMATCH, '主要联系人必须属于当前客户')
        }
      }
      const sourceId = input.sourceId !== undefined ? input.sourceId : customer.sourceId
      if (sourceId) {
        const source = await SourceRepository.findById(sourceId, tx)
        if (!source) throw new BusinessError(CrmErrorCode.CRM_SOURCE_NOT_FOUND, '商机来源不存在')
      }
      const prefix = opportunityNumberPrefix()
      const row = await OpportunityRepository.create({
        opportunityNo: `${prefix}${String(await BusinessNumberRepository.next(prefix, tx)).padStart(4, '0')}`,
        creationKey: input.creationKey ?? null,
        name,
        customerId: input.customerId,
        primaryContactId: input.primaryContactId ?? null,
        ownerId: input.ownerId,
        ownerDepartmentId: customer.ownerDepartmentId,
        stage,
        amountCents: amount(input.amountCents),
        expectedCloseDate: asDate(input.expectedCloseDate),
        sourceId: sourceId ?? null,
        requirement,
        competition: trim(input.competition),
        nextAction,
        nextFollowUpAt: asDate(input.nextFollowUpAt),
        remark: trim(input.remark),
        creatorId: currentUser.id,
        updaterId: currentUser.id,
      }, tx)
      await OpportunityRepository.replaceProductIntents(row.id, input.productIds ?? [], tx)
      const statusBefore = customer.statusCode
      const statusAfter = await CustomerLifecycleService.recalculate(input.customerId, currentUser.id, tx)
      const activityLines = [`创建商机「${name}」`]
      if (row.amountCents !== null) activityLines.push(`预计金额 ${formatCents(row.amountCents)}`)
      activityLines.push(`阶段：${opportunityStageConfig[row.stage].label}`)
      await ActivityRepository.create({
        customerId: input.customerId,
        entityType: 'customer',
        entityId: input.customerId,
        entityRefType: 'customer',
        category: 'business',
        type: 'opportunity_created',
        content: activityLines.join('\n'),
        metadata: {
          eventType: 'opportunity_created',
          category: 'BUSINESS',
          opportunityId: row.id,
          opportunityName: name,
          amountCents: row.amountCents,
          expectedCloseDate: row.expectedCloseDate?.toISOString() ?? null,
          stage: row.stage,
        },
        operatorUserId: currentUser.id,
      }, tx)
      if (statusBefore !== statusAfter) await ActivityRepository.create({
        customerId: input.customerId,
        entityType: 'customer',
        entityId: input.customerId,
        entityRefType: 'customer',
        type: 'status_change',
        content: `客户状态由「${customerStatusLabel(statusBefore ?? '')}」变更为「${customerStatusLabel(statusAfter)}」`,
        metadata: { eventType: 'customer_status_changed', from: statusBefore, to: statusAfter, source: 'opportunity_created' },
        operatorUserId: currentUser.id,
      }, tx)
      return (await OpportunityRepository.findById(row.id, tx))!
    })
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        return await createInTransaction()
      } catch (error) {
        const duplicateNo = duplicateConstraint(error, 'opportunity_no')
        const duplicateKey = duplicateConstraint(error, 'creation_key')
        if (duplicateKey && input.creationKey) {
          const existing = await OpportunityRepository.findByCreationKey(input.creationKey)
          if (existing && sameCreationPayload(existing, input, name, currentUser)) return existing
        }
        if (!duplicateNo || attempt === 4) throw error
      }
    }
    throw new Error('Unable to create opportunity')
  }

  async update({ id, input, currentUser }: { id: number; input: OpportunityUpdateReq; currentUser: DataScopeUser }): Promise<OpportunityRow> {
    return dbManager.transaction(async (tx) => {
      const old = await this.requireVisible(id, currentUser, tx)
      if (input.sourceId != null && !await SourceRepository.findById(input.sourceId, tx)) {
        throw new BusinessError(CrmErrorCode.CRM_SOURCE_NOT_FOUND, '商机来源不存在')
      }
      const updated = await OpportunityRepository.update(id, { name: input.name === undefined ? undefined : trim(input.name) ?? undefined, primaryContactId: input.primaryContactId, ownerId: input.ownerId, amountCents: input.amountCents === undefined ? undefined : amount(input.amountCents), expectedCloseDate: input.expectedCloseDate === undefined ? undefined : asDate(input.expectedCloseDate), sourceId: input.sourceId, competition: input.competition === undefined ? undefined : trim(input.competition), requirement: input.requirement === undefined ? undefined : trim(input.requirement), nextAction: input.nextAction === undefined ? undefined : trim(input.nextAction), nextFollowUpAt: input.nextFollowUpAt === undefined ? undefined : asDate(input.nextFollowUpAt), remark: input.remark === undefined ? undefined : trim(input.remark), updaterId: currentUser.id }, tx)
      if (input.productIds !== undefined) await OpportunityRepository.replaceProductIntents(id, input.productIds, tx)
      await ActivityRepository.create({ customerId: old.customerId, entityType: 'customer', entityId: old.customerId, entityRefType: 'customer', type: 'note', content: `更新商机「${old.name}」`, metadata: { eventType: 'opportunity_updated', opportunityId: id }, operatorUserId: currentUser.id }, tx)
      return (await OpportunityRepository.findById(id, tx)) ?? updated ?? old
    })
  }

  async advanceStage({ id, input, currentUser, tx }: { id: number; input: OpportunityAdvanceReq; currentUser: DataScopeUser; tx?: AppQueryDb }) {
    const advance = async (db: AppQueryDb) => {
      const row = await OpportunityRepository.findByIdWithLock(id, db)
      if (!row) throw this.notFound()
      this.assertVisible(row, currentUser)
      const allowed = { needs_confirmation: 'solution', solution: 'quotation', quotation: 'negotiation' } as const
      if (allowed[row.stage as keyof typeof allowed] !== input.toStage) {
        throw new BusinessError(CrmErrorCode.CRM_OPPORTUNITY_STAGE_INVALID, '不支持的商机阶段推进')
      }
      return this.changeStage(row, input.toStage, null, input.reason, currentUser, db)
    }
    return tx ? advance(tx) : dbManager.transaction(advance)
  }
  async markWon({ id, input, currentUser }: { id: number; input: OpportunityMarkWonReq; currentUser: DataScopeUser }) {
    const row = await this.detail(id, currentUser)
    if (row.stage !== 'negotiation') throw new BusinessError(CrmErrorCode.CRM_OPPORTUNITY_WON_REQUIRES_STAGE, '仅商务谈判阶段可标记赢单')
    return this.changeStage(row, 'won', null, input.reason, currentUser)
  }
  async markLost({ id, input, currentUser }: { id: number; input: OpportunityMarkLostReq; currentUser: DataScopeUser }) {
    const row = await this.detail(id, currentUser)
    if (!(activeStages as readonly string[]).includes(row.stage)) {
      throw new BusinessError(CrmErrorCode.CRM_OPPORTUNITY_STAGE_INVALID, '终态商机不能标记输单')
    }
    return this.changeStage(row, 'lost', input.lostReason, input.reason, currentUser)
  }
  async delete({ id, currentUser }: { id: number; currentUser: DataScopeUser }) { const row = await this.detail(id, currentUser); await dbManager.transaction(async (tx) => { await OpportunityRepository.softDelete(id, tx); await CustomerLifecycleService.recalculate(row.customerId, currentUser.id, tx) }) }
  async transferOwner({ id, input, currentUser }: { id: number; input: { ownerId: number; reason?: string }; currentUser: DataScopeUser }) { return this.update({ id, input: { ownerId: input.ownerId }, currentUser }) }

  private async changeStage(row: OpportunityRow, stage: OpportunityStage, lostReason: OpportunityLostReason | null, reason: string | undefined, currentUser: DataScopeUser, tx?: AppQueryDb) {
    const change = async (tx: AppQueryDb) => {
      const updated = await OpportunityRepository.updateStage(row.id, stage, lostReason, currentUser.id, tx)
      const statusBefore = (await CustomerRepository.findById(row.customerId, tx))?.statusCode
      const statusAfter = await CustomerLifecycleService.recalculate(row.customerId, currentUser.id, tx)
      const eventType = stage === 'won' ? 'opportunity_won' : stage === 'lost' ? 'opportunity_lost' : 'opportunity_stage_changed'
      await ActivityRepository.create({ customerId: row.customerId, entityType: 'customer', entityId: row.customerId, entityRefType: 'customer', category: 'business', type: eventType, content: `商机「${row.name}」阶段由「${opportunityStageConfig[row.stage].label}」变更为「${opportunityStageConfig[stage].label}」${reason ? `：${reason}` : ''}`, metadata: { eventType, opportunityId: row.id, fromStage: row.stage, toStage: stage, lostReason }, operatorUserId: currentUser.id }, tx)
      if (statusBefore && statusBefore !== statusAfter) await ActivityRepository.create({ customerId: row.customerId, entityType: 'customer', entityId: row.customerId, entityRefType: 'customer', type: 'status_change', content: `客户状态由「${customerStatusLabel(statusBefore)}」变更为「${customerStatusLabel(statusAfter)}」`, metadata: { eventType: 'customer_status_changed', from: statusBefore, to: statusAfter }, operatorUserId: currentUser.id }, tx)
      return updated!
    }
    return tx ? change(tx) : dbManager.transaction(change)
  }
  private async requireVisible(id: number, user: DataScopeUser, db: AppQueryDb) { const row = await OpportunityRepository.findById(id, db); if (!row) throw this.notFound(); this.assertVisible(row, user); return row }
  private assertVisible(row: OpportunityRow, user: DataScopeUser) { const scope = computeDataScope(user); if (scope.ownerUserIds === null) return; if (scope.ownerUserIds.includes(row.ownerId ?? -1) || (scope.ownerDepartmentIds ?? []).includes(row.ownerDepartmentId ?? -1)) return; throw this.notFound() }
  private notFound() { return new BusinessError(CrmErrorCode.CRM_OPPORTUNITY_NOT_FOUND, '商机不存在或无权访问') }
}
function formatCents(cents: number) { return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', maximumFractionDigits: 0 }).format(cents / 100) }
function customerStatusLabel(status: string) { return ({ potential: '潜在', following: '跟进中', opportunity: '有商机', won: '已成交', customer: '已成交', lost: '已流失' } as Record<string, string>)[status] ?? status }
