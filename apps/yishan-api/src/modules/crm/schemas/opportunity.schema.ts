import { Type, type Static } from '@sinclair/typebox'
import { PaginationQuerySchema } from './common.schema.js'

/**
 * Phase 2：商机（Opportunity）HTTP schema。
 *
 * 设计要点：
 *   - 阶段、pipeline、lost_reason 全部用 `Type.Union([Type.Literal(...])` 严格校验；
 *     `Type.String({ enum: [...] })` 在 TypeBox Value.Check 下不严格（与 lead.schema 注释一致）。
 *   - 金额统一用「分」整数 cents（与 utils/money 约定一致）。
 *   - time 字段统一 `format: 'date-time'`。
 *   - update 接口白名单字段；owner / stage / won / lost / transfer 全部走专门业务接口。
 */

export const OPPORTUNITY_STAGES = [
  'discover',
  'qualify',
  'proposal',
  'negotiation',
  'won',
  'lost',
] as const
export type OpportunityStageCode = (typeof OPPORTUNITY_STAGES)[number]

/**
 * 阶段展示顺序：用于 Kanban 桶渲染。
 * 注意：lost 与 won 都是终态，Kanban 通常并列放在最右侧。
 */
export const OPPORTUNITY_STAGE_ORDER: readonly OpportunityStageCode[] = [
  'discover',
  'qualify',
  'proposal',
  'negotiation',
  'won',
  'lost',
] as const

/** 中文标签：用于审计活动与前端兜底展示。 */
export const OPPORTUNITY_STAGE_LABELS: Record<OpportunityStageCode, string> = {
  discover: '初步接洽',
  qualify: '需求确认',
  proposal: '方案报价',
  negotiation: '商务谈判',
  won: '已成交',
  lost: '已流失',
}

export const OPPORTUNITY_LOST_REASON_CODES = [
  'price',
  'competitor',
  'no_budget',
  'no_response',
  'project_cancelled',
  'other',
] as const
export type OpportunityLostReasonCode = (typeof OPPORTUNITY_LOST_REASON_CODES)[number]

export const OPPORTUNITY_LOST_REASON_LABELS: Record<OpportunityLostReasonCode, string> = {
  price: '价格因素',
  competitor: '竞争对手胜出',
  no_budget: '预算不足',
  no_response: '客户无回应',
  project_cancelled: '项目取消',
  other: '其他',
}

/**
 * 阶段状态机：显式常量映射，便于 service / 测试共同引用。
 *
 * discover   → qualify
 * qualify    → proposal
 * proposal   → negotiation
 * negotiation → won | lost
 * discover / qualify / proposal / negotiation 任意阶段都允许 rollBack 到前一个非终态阶段；
 * won / lost 不可再迁移（终态）。
 *
 * 业务约束：
 *   - markWon 只允许从 negotiation 阶段发起。
 *   - markLost 任意阶段都允许（商机进展不顺随时可标流失）。
 */
export const STAGE_FORWARD_TRANSITIONS: Record<OpportunityStageCode, readonly OpportunityStageCode[]> = {
  discover: ['qualify'],
  qualify: ['proposal'],
  proposal: ['negotiation'],
  negotiation: ['won', 'lost'],
  won: [],
  lost: [],
}

export const STAGE_BACKWARD_TRANSITIONS: Record<OpportunityStageCode, readonly OpportunityStageCode[]> = {
  discover: [],
  qualify: ['discover'],
  proposal: ['qualify'],
  negotiation: ['proposal'],
  won: [],
  lost: [],
}

/** 列出某阶段允许前往的所有 next stages（forward + rollBack）。 */
export function allowedNextStages(current: OpportunityStageCode): readonly OpportunityStageCode[] {
  return [...STAGE_FORWARD_TRANSITIONS[current], ...STAGE_BACKWARD_TRANSITIONS[current]]
}

export function isTerminalStage(stage: OpportunityStageCode): boolean {
  return stage === 'won' || stage === 'lost'
}

export const OpportunityRespSchema = Type.Object({
  id: Type.Number(),
  name: Type.String(),
  customerId: Type.Number(),
  contactId: Type.Union([Type.Number(), Type.Null()]),
  ownerUserId: Type.Union([Type.Number(), Type.Null()]),
  ownerUserName: Type.Union([Type.String(), Type.Null()]),
  ownerDepartmentId: Type.Union([Type.Number(), Type.Null()]),
  pipelineCode: Type.String(),
  stageCode: Type.Union(OPPORTUNITY_STAGES.map((s) => Type.Literal(s))),
  stageEnteredAt: Type.String({ format: 'date-time' }),
  expectedAmountCents: Type.Number(),
  expectedCloseDate: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  nextActionAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  lostReasonCode: Type.Union([
    Type.Union(OPPORTUNITY_LOST_REASON_CODES.map((c) => Type.Literal(c))),
    Type.Null(),
  ]),
  wonAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  lostAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  version: Type.Number(),
  creatorId: Type.Union([Type.Number(), Type.Null()]),
  createdByUserName: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
})

export const OpportunityListQuerySchema = Type.Composite([
  PaginationQuerySchema,
  Type.Object({
    keyword: Type.Optional(Type.String({ maxLength: 200 })),
    customerId: Type.Optional(Type.Integer()),
    contactId: Type.Optional(Type.Integer()),
    stageCode: Type.Optional(Type.Union(OPPORTUNITY_STAGES.map((s) => Type.Literal(s)))),
    pipelineCode: Type.Optional(Type.String({ maxLength: 64 })),
    ownerUserId: Type.Optional(Type.Integer()),
  }),
])

export const OpportunityKanbanQuerySchema = Type.Object({
  pipelineCode: Type.String({ minLength: 1, maxLength: 64 }),
})

export const OpportunityKanbanBucketSchema = Type.Object({
  stageCode: Type.Union(OPPORTUNITY_STAGES.map((s) => Type.Literal(s))),
  items: Type.Array(OpportunityRespSchema),
  total: Type.Number(),
})

export const OpportunityKanbanRespSchema = Type.Object({
  pipelineCode: Type.String(),
  buckets: Type.Array(OpportunityKanbanBucketSchema),
})

/**
 * 创建请求：不接受 ownerUserId/ownerDepartmentId/version/wonAt/lostAt/nextActionAt 等。
 * 服务层按 currentUser 绑定 creatorId/updaterId；stageCode 默认 'discover'。
 *
 * amount 用 cents 整数，0..Number.MAX_SAFE_INTEGER 由 service 校验。
 */
export const OpportunityCreateReqSchema = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 200 }),
  customerId: Type.Integer({ minimum: 1 }),
  contactId: Type.Optional(Type.Union([Type.Integer(), Type.Null()])),
  pipelineCode: Type.Optional(Type.String({ maxLength: 64 })),
  stageCode: Type.Optional(Type.Union(OPPORTUNITY_STAGES.map((s) => Type.Literal(s)))),
  expectedAmountCents: Type.Optional(Type.Integer({ minimum: 0 })),
  expectedCloseDate: Type.Optional(Type.Union([Type.String({ format: 'date-time' }), Type.Null()])),
  nextActionAt: Type.Optional(Type.Union([Type.String({ format: 'date-time' }), Type.Null()])),
})
export type OpportunityCreateReq = Static<typeof OpportunityCreateReqSchema>

/**
 * PATCH /opportunities/:id 白名单字段。
 *
 * 严禁在此接收（必须走专门业务接口）：
 *   - ownerUserId / ownerDepartmentId → transfer
 *   - stageCode / stageEnteredAt      → advance / rollBack / markWon / markLost
 *   - wonAt / lostAt                  → markWon / markLost
 *   - lostReasonCode                  → markLost
 *   - version                         → service 内部维护
 */
export const OpportunityUpdateReqSchema = Type.Object({
  name: Type.Optional(Type.String({ minLength: 1, maxLength: 200 })),
  contactId: Type.Optional(Type.Union([Type.Integer(), Type.Null()])),
  expectedAmountCents: Type.Optional(Type.Integer({ minimum: 0 })),
  expectedCloseDate: Type.Optional(Type.Union([Type.String({ format: 'date-time' }), Type.Null()])),
  nextActionAt: Type.Optional(Type.Union([Type.String({ format: 'date-time' }), Type.Null()])),
})
export type OpportunityUpdateReq = Static<typeof OpportunityUpdateReqSchema>

export const OpportunityIdParamSchema = Type.Object({ id: Type.Integer({ minimum: 1 }) })

/**
 * 推进阶段：必须显式给出 targetStage；service 会再校验转移合法性。
 */
export const OpportunityAdvanceReqSchema = Type.Object({
  toStage: Type.Union(OPPORTUNITY_STAGES.map((s) => Type.Literal(s))),
  reason: Type.Optional(Type.String({ maxLength: 500 })),
})
export type OpportunityAdvanceReq = Static<typeof OpportunityAdvanceReqSchema>

/**
 * 标为成交：只能从 negotiation 阶段发起。
 */
export const OpportunityMarkWonReqSchema = Type.Object({
  reason: Type.Optional(Type.String({ maxLength: 500 })),
})
export type OpportunityMarkWonReq = Static<typeof OpportunityMarkWonReqSchema>

/**
 * 标为流失：必须给标准化 lostReasonCode + 解释。
 */
export const OpportunityMarkLostReqSchema = Type.Object({
  reasonCode: Type.Union(OPPORTUNITY_LOST_REASON_CODES.map((c) => Type.Literal(c))),
  reason: Type.String({ minLength: 1, maxLength: 500 }),
})
export type OpportunityMarkLostReq = Static<typeof OpportunityMarkLostReqSchema>

/**
 * 转交商机：targetUserId 必须存在（service 层做用户存在校验）。
 */
export const OpportunityTransferReqSchema = Type.Object({
  targetUserId: Type.Integer({ minimum: 1 }),
  reason: Type.Optional(Type.String({ maxLength: 500 })),
})
export type OpportunityTransferReq = Static<typeof OpportunityTransferReqSchema>

export const OpportunityStageLogRespSchema = Type.Object({
  id: Type.Number(),
  opportunityId: Type.Number(),
  fromStage: Type.String(),
  toStage: Type.String(),
  operatorUserId: Type.Number(),
  operatorUserName: Type.Union([Type.String(), Type.Null()]),
  reason: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.String({ format: 'date-time' }),
})
export const OpportunityStageLogListRespSchema = Type.Object({
  total: Type.Number(),
  items: Type.Array(OpportunityStageLogRespSchema),
})
