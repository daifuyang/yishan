import { dbManager } from '@/db'
import { eq } from 'drizzle-orm'
import { BusinessError } from '@/exceptions/business-error.js'
import { computeDataScope, type DataScopeUser } from '../schemas/data-scope.js'
import { CrmErrorCode } from '../schemas/error-codes.js'
import {
  allowedNextStages,
  OPPORTUNITY_STAGE_LABELS,
  type OpportunityAdvanceReq,
  type OpportunityCreateReq,
  type OpportunityLostReasonCode,
  type OpportunityMarkLostReq,
  type OpportunityMarkWonReq,
  type OpportunityStageCode,
  type OpportunityTransferReq,
  type OpportunityUpdateReq,
  isTerminalStage,
} from '../schemas/opportunity.schema.js'
import { ActivityRepository } from '../repositories/activity.repository.js'
import {
  OpportunityRepository,
  type CreateOpportunityInput,
  type OpportunityListQuery,
  type OpportunityRow,
  type UpdateOpportunityInput,
} from '../repositories/opportunity.repository.js'
import { crmOpportunity } from '../db/schema.js'

/**
 * OpportunityService —— 商机业务编排。
 *
 * 单一职责：
 *   - 状态机校验（advanceStage / rollBackStage / markWon / markLost）
 *   - 审计活动写入（crm_activity entity_type='opportunity' + crm_opportunity_stage_log）
 *   - 数据范围可见性（getAccessible / transfer 时只允许在范围内操作）
 *   - 所有 DB 写入走 dbManager.transaction，保证审计与主表原子性
 *
 * 不做：
 *   - 跨模块 join（customer/contact/user）由多次查询 + JS 合并完成；service 接受"少量 N+1"成本换取模块边界清晰。
 *   - 报价/合同/工单的副作用：当前阶段只写 crm_activity 与 crm_opportunity_stage_log；
 *     Phase 3 引入报价/合同 service 时由 orchestrator 统一触发。
 */

/* ─── 内部 helpers ─────────────────────────────────────── */

function diffValue(prev: unknown, next: unknown): string {
  const a = prev === null || prev === undefined ? '—' : String(prev)
  const b = next === null || next === undefined ? '—' : String(next)
  return `${a} → ${b}`
}

function parseDate(input: string | Date | null | undefined): Date | null {
  if (input === null || input === undefined || input === '') return null
  if (input instanceof Date) return input
  const d = new Date(input)
  return Number.isNaN(d.getTime()) ? null : d
}

function assertSafeAmountCents(n: number, field: string): void {
  if (!Number.isFinite(n) || !Number.isSafeInteger(n) || n < 0) {
    throw new BusinessError(
      CrmErrorCode.CRM_OPPORTUNITY_AMOUNT_INVALID,
      `${field} 必须是 ≥ 0 的安全整数（cents）`,
    )
  }
}

/* ─── Service ─────────────────────────────────────────── */

export interface CreateOpportunityArgs {
  input: OpportunityCreateReq
  currentUser: DataScopeUser
}

export interface UpdateOpportunityArgs {
  id: number
  input: OpportunityUpdateReq
  currentUser: DataScopeUser
}

export interface AdvanceOpportunityArgs {
  id: number
  input: OpportunityAdvanceReq
  currentUser: DataScopeUser
}

export interface MarkWonOpportunityArgs {
  id: number
  input: OpportunityMarkWonReq
  currentUser: DataScopeUser
}

export interface MarkLostOpportunityArgs {
  id: number
  input: OpportunityMarkLostReq
  currentUser: DataScopeUser
}

export interface TransferOpportunityArgs {
  id: number
  input: OpportunityTransferReq
  currentUser: DataScopeUser
}

const PROFILE_FIELDS = ['name', 'contactId', 'expectedAmountCents', 'expectedCloseDate', 'nextActionAt'] as const
type EditableProfileField = (typeof PROFILE_FIELDS)[number]

const PROFILE_FIELD_LABELS: Record<EditableProfileField, string> = {
  name: '商机名称',
  contactId: '联系人',
  expectedAmountCents: '预计金额',
  expectedCloseDate: '预计成交日期',
  nextActionAt: '下一步行动时间',
}

export class OpportunityService {
  /* ─── List / Detail ────────────────────────────────── */

  async list(
    query: OpportunityListQuery,
    currentUser: DataScopeUser,
  ): Promise<{ items: OpportunityRow[]; total: number; page: number; pageSize: number }> {
    const scope = computeDataScope(currentUser)
    const result = await OpportunityRepository.list({ ...query, ...scope })
    return {
      items: result.rows,
      total: result.total,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 10,
    }
  }

  async detail(id: number, currentUser: DataScopeUser): Promise<OpportunityRow> {
    return this.getAccessible(id, currentUser)
  }

  async kanban(pipelineCode: string, currentUser: DataScopeUser) {
    const rows = await OpportunityRepository.listByPipelineGroupedByStage(pipelineCode)
    const scope = computeDataScope(currentUser)
    const allowedOwnerIds = scope.ownerUserIds
    const allowedDeptIds = scope.ownerDepartmentIds ?? []
    const filtered = rows.filter((r) => {
      if (allowedOwnerIds === null) return true
      const inUserScope = r.ownerUserId !== null && allowedOwnerIds.includes(r.ownerUserId)
      const inDeptScope = r.ownerDepartmentId !== null && allowedDeptIds.includes(r.ownerDepartmentId)
      return inUserScope || inDeptScope
    })

    // 按 stage 分桶 + 顺序固定
    const order: OpportunityStageCode[] = [
      'discover',
      'qualify',
      'proposal',
      'negotiation',
      'won',
      'lost',
    ]
    const buckets = order.map((stage) => ({
      stageCode: stage,
      items: filtered.filter((r) => r.stageCode === stage),
      total: filtered.filter((r) => r.stageCode === stage).length,
    }))

    return { pipelineCode, buckets }
  }

  /* ─── Create ───────────────────────────────────────── */

  async create({ input, currentUser }: CreateOpportunityArgs): Promise<OpportunityRow> {
    const name = input.name.trim()
    if (!name) {
      throw new BusinessError(CrmErrorCode.CRM_OPPORTUNITY_NAME_REQUIRED, '请输入商机名称')
    }
    if (input.expectedAmountCents !== undefined) {
      assertSafeAmountCents(input.expectedAmountCents, '预计金额')
    }
    const departmentId = currentUser.deptIds?.[0] ?? null
    const payload: CreateOpportunityInput = {
      name,
      customerId: input.customerId,
      contactId: input.contactId ?? null,
      pipelineCode: input.pipelineCode ?? 'default',
      stageCode: input.stageCode ?? 'discover',
      expectedAmountCents: input.expectedAmountCents ?? 0,
      expectedCloseDate: parseDate(input.expectedCloseDate),
      nextActionAt: parseDate(input.nextActionAt),
      // 创建人即默认负责人：creatorId 与 ownerUserId 一致。
      ownerUserId: currentUser.id,
      ownerDepartmentId: departmentId,
      creatorId: currentUser.id,
      updaterId: currentUser.id,
    }
    return OpportunityRepository.create(payload)
  }

  /* ─── Update（白名单字段） ─────────────────────────── */

  async update({ id, input, currentUser }: UpdateOpportunityArgs): Promise<OpportunityRow> {
    const opp = await this.getAccessible(id, currentUser)
    if (isTerminalStage(opp.stageCode)) {
      throw new BusinessError(CrmErrorCode.CRM_OPPORTUNITY_STAGE_INVALID, '已成交或已流失的商机不可编辑')
    }
    const patch: Partial<Record<EditableProfileField, unknown>> = {}
    for (const field of PROFILE_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(input, field)) {
        patch[field] = input[field]
      }
    }
    if (patch.name !== undefined) {
      const trimmed = String(patch.name ?? '').trim()
      if (!trimmed) {
        throw new BusinessError(CrmErrorCode.CRM_OPPORTUNITY_NAME_REQUIRED, '请输入商机名称')
      }
      patch.name = trimmed
    }
    if (patch.expectedAmountCents !== undefined) {
      assertSafeAmountCents(Number(patch.expectedAmountCents), '预计金额')
    }
    if (patch.expectedCloseDate !== undefined) {
      patch.expectedCloseDate = parseDate(patch.expectedCloseDate as string | null | undefined)
    }
    if (patch.nextActionAt !== undefined) {
      patch.nextActionAt = parseDate(patch.nextActionAt as string | null | undefined)
    }

    const changed = PROFILE_FIELDS.filter((field) => {
      if (!(field in patch)) return false
      const prev = opp[field]
      const next = patch[field]
      // 日期字段直接对比 ISO 字符串，避免 Date 实例差异导致 false positive
      if (field === 'expectedCloseDate' || field === 'nextActionAt') {
        return (prev instanceof Date ? prev.toISOString() : null) !==
          (next instanceof Date ? next.toISOString() : null)
      }
      const prevNorm = prev === null || prev === undefined ? '' : String(prev)
      const nextNorm = next === null || next === undefined ? '' : String(next)
      return prevNorm !== nextNorm
    })
    if (changed.length === 0) return opp

    const payload: UpdateOpportunityInput = {
      ...(patch as Record<string, unknown>),
      version: opp.version,
      updaterId: currentUser.id,
    }
    const updated = await OpportunityRepository.update(id, payload)
    if (!updated) throw new BusinessError(CrmErrorCode.CRM_OPPORTUNITY_NOT_FOUND, '商机不存在或已删除')

    const diffLines = changed
      .map((field) => `${PROFILE_FIELD_LABELS[field]}：${diffValue(opp[field], patch[field])}`)
      .join('\n')
    await ActivityRepository.create({
      entityType: 'opportunity',
      entityId: id,
      entityRefType: 'opportunity',
      type: 'profile_edit',
      content: diffLines,
      operatorUserId: currentUser.id,
    })

    return updated
  }

  /* ─── Delete（软删） ───────────────────────────────── */

  async delete({ id, currentUser }: { id: number; currentUser: DataScopeUser }): Promise<void> {
    await this.getAccessible(id, currentUser)
    return dbManager.transaction(async (tx) => {
      const affected = await OpportunityRepository.softDelete(id, tx)
      if (affected === 0) {
        throw new BusinessError(CrmErrorCode.CRM_OPPORTUNITY_NOT_FOUND, '商机不存在或已删除')
      }
    })
  }

  /* ─── 状态机 ───────────────────────────────────────── */

  /**
   * 推进 / 回退阶段。在 service 层做显式校验，遵守 STAGE_FORWARD_TRANSITIONS +
   * STAGE_BACKWARD_TRANSITIONS 的状态机定义。
   *
   * 关键约束：
   *   - 终态（won/lost）拒绝任何 stage 切换
   *   - targetStage 不在 allowedNextStages(current) 中 → 拒绝
   *   - 推进到 won/lost 必须走 markWon/markLost（不允许直接 advance）
   */
  async advanceStage({ id, input, currentUser }: AdvanceOpportunityArgs): Promise<OpportunityRow> {
    if (input.toStage === 'won' || input.toStage === 'lost') {
      throw new BusinessError(
        CrmErrorCode.CRM_OPPORTUNITY_STAGE_INVALID,
        '请使用专门的「标为成交 / 标为流失」接口完成终态切换',
      )
    }
    return dbManager.transaction(async (tx) => {
      const opp = await OpportunityRepository.findByIdForUpdate(id, tx)
      if (!opp) throw new BusinessError(CrmErrorCode.CRM_OPPORTUNITY_NOT_FOUND, '商机不存在或已删除')
      await this.assertAccessibleInTx(opp, currentUser, tx)

      if (isTerminalStage(opp.stageCode)) {
        throw new BusinessError(CrmErrorCode.CRM_OPPORTUNITY_STAGE_INVALID, '终态商机不可再切换阶段')
      }
      const allowed = allowedNextStages(opp.stageCode)
      if (!allowed.includes(input.toStage)) {
        throw new BusinessError(
          CrmErrorCode.CRM_OPPORTUNITY_STAGE_INVALID,
          `当前阶段「${OPPORTUNITY_STAGE_LABELS[opp.stageCode]}」不允许迁移到「${OPPORTUNITY_STAGE_LABELS[input.toStage]}」`,
        )
      }

      const now = new Date()
      await tx.update(crmOpportunity)
        .set({
          stageCode: input.toStage,
          stageEnteredAt: now,
          version: opp.version + 1,
          updatedAt: now,
          updaterId: currentUser.id,
        })
        .where(eq(crmOpportunity.id, id))

      await OpportunityRepository.createStageLog(
        {
          opportunityId: id,
          fromStage: opp.stageCode,
          toStage: input.toStage,
          operatorUserId: currentUser.id,
          reason: input.reason ?? null,
        },
        tx,
      )
      await ActivityRepository.create(
        {
          entityType: 'opportunity',
          entityId: id,
          entityRefType: 'opportunity',
          type: 'status_change',
          content: `阶段变更：${OPPORTUNITY_STAGE_LABELS[opp.stageCode]} → ${OPPORTUNITY_STAGE_LABELS[input.toStage]}${
            input.reason ? `（${input.reason}）` : ''
          }`,
          operatorUserId: currentUser.id,
        },
        tx,
      )

      const updated = await OpportunityRepository.findById(id, tx)
      if (!updated) throw new BusinessError(CrmErrorCode.CRM_OPPORTUNITY_NOT_FOUND, '商机不存在或已删除')
      return updated
    })
  }

  /**
   * markWon：只允许从 negotiation 阶段发起。
   * 显式语义：advanceStage 不允许直接 target=won；这样能强制业务流程走"商务谈判 → 成交"。
   */
  async markWon({ id, input, currentUser }: MarkWonOpportunityArgs): Promise<OpportunityRow> {
    return dbManager.transaction(async (tx) => {
      const opp = await OpportunityRepository.findByIdForUpdate(id, tx)
      if (!opp) throw new BusinessError(CrmErrorCode.CRM_OPPORTUNITY_NOT_FOUND, '商机不存在或已删除')
      await this.assertAccessibleInTx(opp, currentUser, tx)

      if (opp.stageCode === 'won') {
        throw new BusinessError(CrmErrorCode.CRM_OPPORTUNITY_STAGE_INVALID, '商机已是成交状态')
      }
      if (opp.stageCode !== 'negotiation') {
        throw new BusinessError(
          CrmErrorCode.CRM_OPPORTUNITY_WON_REQUIRES_STAGE,
          `仅「商务谈判」阶段的商机可标记为成交，当前阶段：${OPPORTUNITY_STAGE_LABELS[opp.stageCode]}`,
        )
      }

      const now = new Date()
      await tx.update(crmOpportunity)
        .set({
          stageCode: 'won',
          stageEnteredAt: now,
          wonAt: now,
          lostAt: null,
          lostReasonCode: null,
          version: opp.version + 1,
          updatedAt: now,
          updaterId: currentUser.id,
        })
        .where(eq(crmOpportunity.id, id))

      await OpportunityRepository.createStageLog(
        {
          opportunityId: id,
          fromStage: opp.stageCode,
          toStage: 'won',
          operatorUserId: currentUser.id,
          reason: input.reason ?? null,
        },
        tx,
      )
      await ActivityRepository.create(
        {
          entityType: 'opportunity',
          entityId: id,
          entityRefType: 'opportunity',
          type: 'status_change',
          content: `阶段变更：${OPPORTUNITY_STAGE_LABELS[opp.stageCode]} → ${OPPORTUNITY_STAGE_LABELS.won}${
            input.reason ? `（${input.reason}）` : ''
          }`,
          operatorUserId: currentUser.id,
        },
        tx,
      )

      const updated = await OpportunityRepository.findById(id, tx)
      if (!updated) throw new BusinessError(CrmErrorCode.CRM_OPPORTUNITY_NOT_FOUND, '商机不存在或已删除')
      return updated
    })
  }

  /**
   * markLost：任意阶段都允许。必须给标准化 reasonCode + 解释。
   * 终态后再标流失：拒绝。
   */
  async markLost({ id, input, currentUser }: MarkLostOpportunityArgs): Promise<OpportunityRow> {
    const trimmedReason = input.reason.trim()
    if (!trimmedReason) {
      throw new BusinessError(CrmErrorCode.CRM_OPPORTUNITY_LOST_REASON_REQUIRED, '请填写流失原因')
    }
    return dbManager.transaction(async (tx) => {
      const opp = await OpportunityRepository.findByIdForUpdate(id, tx)
      if (!opp) throw new BusinessError(CrmErrorCode.CRM_OPPORTUNITY_NOT_FOUND, '商机不存在或已删除')
      await this.assertAccessibleInTx(opp, currentUser, tx)

      if (isTerminalStage(opp.stageCode)) {
        throw new BusinessError(CrmErrorCode.CRM_OPPORTUNITY_STAGE_INVALID, '终态商机不可再标流失')
      }

      const now = new Date()
      await tx.update(crmOpportunity)
        .set({
          stageCode: 'lost',
          stageEnteredAt: now,
          lostAt: now,
          lostReasonCode: input.reasonCode,
          wonAt: null,
          version: opp.version + 1,
          updatedAt: now,
          updaterId: currentUser.id,
        })
        .where(eq(crmOpportunity.id, id))

      await OpportunityRepository.createStageLog(
        {
          opportunityId: id,
          fromStage: opp.stageCode,
          toStage: 'lost',
          operatorUserId: currentUser.id,
          reason: trimmedReason,
        },
        tx,
      )
      await ActivityRepository.create(
        {
          entityType: 'opportunity',
          entityId: id,
          entityRefType: 'opportunity',
          type: 'status_change',
          content: `阶段变更：${OPPORTUNITY_STAGE_LABELS[opp.stageCode]} → ${OPPORTUNITY_STAGE_LABELS.lost}（${reasonLabel(
            input.reasonCode,
          )}）：${trimmedReason}`,
          operatorUserId: currentUser.id,
        },
        tx,
      )

      const updated = await OpportunityRepository.findById(id, tx)
      if (!updated) throw new BusinessError(CrmErrorCode.CRM_OPPORTUNITY_NOT_FOUND, '商机不存在或已删除')
      return updated
    })
  }

  /**
   * 转交商机 owner：不改变 stage。service 简化校验：仅要求 targetUserId > 0，
   * 目标用户的存在 / 启用状态由路由层或后续接入 sysUser 校验工具时再补齐。
   *
   * 如果是自指（targetUserId === currentUser.id），不写 owner_change 审计。
   */
  async transferOwner({ id, input, currentUser }: TransferOpportunityArgs): Promise<OpportunityRow> {
    if (!Number.isInteger(input.targetUserId) || input.targetUserId < 1) {
      throw new BusinessError(CrmErrorCode.CRM_OPPORTUNITY_TRANSFER_TARGET_INVALID, '转交目标用户无效')
    }
    return dbManager.transaction(async (tx) => {
      const opp = await OpportunityRepository.findByIdForUpdate(id, tx)
      if (!opp) throw new BusinessError(CrmErrorCode.CRM_OPPORTUNITY_NOT_FOUND, '商机不存在或已删除')
      await this.assertAccessibleInTx(opp, currentUser, tx)

      if (opp.stageCode === 'won' || opp.stageCode === 'lost') {
        throw new BusinessError(CrmErrorCode.CRM_OPPORTUNITY_STAGE_INVALID, '终态商机不可转交')
      }

      if (opp.ownerUserId === input.targetUserId) {
        return opp
      }

      const now = new Date()
      await tx.update(crmOpportunity)
        .set({
          ownerUserId: input.targetUserId,
          ownerDepartmentId: null, // 转交后部门归属由目标用户的 deptIds 重新计算时不强行保留
          version: opp.version + 1,
          updatedAt: now,
          updaterId: currentUser.id,
        })
        .where(eq(crmOpportunity.id, id))

      await ActivityRepository.create(
        {
          entityType: 'opportunity',
          entityId: id,
          entityRefType: 'opportunity',
          type: 'owner_change',
          content: `商机转交：${opp.ownerUserName ?? `用户 #${opp.ownerUserId ?? '未分配'}`} → 用户 #${input.targetUserId}${
            input.reason ? `（${input.reason}）` : ''
          }`,
          operatorUserId: currentUser.id,
        },
        tx,
      )

      const updated = await OpportunityRepository.findById(id, tx)
      if (!updated) throw new BusinessError(CrmErrorCode.CRM_OPPORTUNITY_NOT_FOUND, '商机不存在或已删除')
      return updated
    })
  }

  /* ─── 内部工具 ─────────────────────────────────────── */

  private async getAccessible(id: number, currentUser: DataScopeUser): Promise<OpportunityRow> {
    const opp = await OpportunityRepository.findById(id)
    if (!opp) throw new BusinessError(CrmErrorCode.CRM_OPPORTUNITY_NOT_FOUND, '商机不存在或已删除')
    const scope = computeDataScope(currentUser)
    const allowedUserIds = scope.ownerUserIds
    const allowedDeptIds = scope.ownerDepartmentIds ?? []
    if (allowedUserIds !== null) {
      const inUserScope = opp.ownerUserId !== null && allowedUserIds.includes(opp.ownerUserId)
      const inDeptScope = opp.ownerDepartmentId !== null && allowedDeptIds.includes(opp.ownerDepartmentId)
      if (!inUserScope && !inDeptScope) {
        throw new BusinessError(CrmErrorCode.CRM_OPPORTUNITY_NOT_FOUND, '商机不存在或已删除')
      }
    }
    return opp
  }

  private async assertAccessibleInTx(
    opp: OpportunityRow,
    currentUser: DataScopeUser,
    _tx: unknown,
  ): Promise<void> {
    const scope = computeDataScope(currentUser)
    const allowedUserIds = scope.ownerUserIds
    const allowedDeptIds = scope.ownerDepartmentIds ?? []
    if (allowedUserIds !== null) {
      const inUserScope = opp.ownerUserId !== null && allowedUserIds.includes(opp.ownerUserId)
      const inDeptScope = opp.ownerDepartmentId !== null && allowedDeptIds.includes(opp.ownerDepartmentId)
      if (!inUserScope && !inDeptScope) {
        throw new BusinessError(CrmErrorCode.CRM_OPPORTUNITY_NOT_FOUND, '商机不存在或已删除')
      }
    }
  }
}

function reasonLabel(code: OpportunityLostReasonCode): string {
  switch (code) {
    case 'price':
      return '价格因素'
    case 'competitor':
      return '竞争对手胜出'
    case 'no_budget':
      return '预算不足'
    case 'no_response':
      return '客户无回应'
    case 'project_cancelled':
      return '项目取消'
    case 'other':
    default:
      return '其他'
  }
}
