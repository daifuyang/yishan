import { Type, type Static } from '@sinclair/typebox'
import { PaginationQuerySchema } from './common.schema.js'
import {
  OPEN_OPPORTUNITY_STAGE_VALUES,
  OPPORTUNITY_STAGES as OPPORTUNITY_STAGE_DESCRIPTORS,
  type OpportunityStageCode,
} from '../domain/statuses.js'

export const OPPORTUNITY_STAGES = OPPORTUNITY_STAGE_DESCRIPTORS.map((stage) => stage.value)
export type { OpportunityStageCode }
export const opportunityStageConfig = Object.fromEntries(
  OPPORTUNITY_STAGE_DESCRIPTORS.map((stage, index) => [
    stage.value,
    { label: stage.label, probability: [20, 35, 50, 70, 100, 0][index] ?? 0 },
  ]),
) as Record<OpportunityStageCode, { label: string; probability: number }>
export const OPPORTUNITY_STAGE_LABELS = Object.fromEntries(
  OPPORTUNITY_STAGE_DESCRIPTORS.map((stage) => [stage.value, stage.label]),
) as Record<OpportunityStageCode, string>
export const OPPORTUNITY_LOST_REASONS = ['price', 'competitor', 'budget_cancelled', 'demand_cancelled', 'postponed', 'unreachable', 'other'] as const
export type OpportunityLostReason = (typeof OPPORTUNITY_LOST_REASONS)[number]
export const OPPORTUNITY_LOST_REASON_LABELS: Record<OpportunityLostReason, string> = {
  price: '价格原因',
  competitor: '竞品成交',
  budget_cancelled: '预算取消',
  demand_cancelled: '需求取消',
  postponed: '暂缓采购',
  unreachable: '无法联系',
  other: '其他',
}
const StageSchema = Type.Union(OPPORTUNITY_STAGES.map((stage) => Type.Literal(stage)))
const OpenStageSchema = Type.Union(OPEN_OPPORTUNITY_STAGE_VALUES.map((stage) => Type.Literal(stage)))
const LostReasonSchema = Type.Union(OPPORTUNITY_LOST_REASONS.map((reason) => Type.Literal(reason)))
export const OpportunityProductSchema = Type.Object({ id: Type.Integer(), code: Type.String(), name: Type.String() })
export const OpportunityRespSchema = Type.Object({
  id: Type.Integer(),
  opportunityNo: Type.String({ minLength: 1, maxLength: 32 }),
  name: Type.String(),
  customerId: Type.Integer(),
  customerName: Type.Union([Type.String(), Type.Null()]),
  primaryContactId: Type.Union([Type.Integer(), Type.Null()]),
  ownerId: Type.Union([Type.Integer(), Type.Null()]),
  ownerName: Type.Union([Type.String(), Type.Null()]),
  ownerDepartmentId: Type.Union([Type.Integer(), Type.Null()]),
  stage: StageSchema,
  amountCents: Type.Union([Type.Number(), Type.Null()]),
  expectedCloseDate: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  sourceId: Type.Union([Type.Integer(), Type.Null()]),
  requirement: Type.Union([Type.String(), Type.Null()]),
  competition: Type.Union([Type.String(), Type.Null()]),
  nextAction: Type.Union([Type.String(), Type.Null()]),
  nextFollowUpAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  lastFollowUpAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  remark: Type.Union([Type.String(), Type.Null()]),
  lostReason: Type.Union([LostReasonSchema, Type.Null()]),
  products: Type.Array(OpportunityProductSchema),
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
})
export const OpportunityListQuerySchema = Type.Composite([
  PaginationQuerySchema,
  Type.Object({
    keyword: Type.Optional(Type.String({ maxLength: 200 })),
    customerId: Type.Optional(Type.Integer()),
    primaryContactId: Type.Optional(Type.Integer()),
    stage: Type.Optional(StageSchema),
    ownerId: Type.Optional(Type.Integer()),
    expectedCloseFrom: Type.Optional(Type.String({ format: 'date-time' })),
    expectedCloseTo: Type.Optional(Type.String({ format: 'date-time' })),
  }),
])
export const OpportunityDuplicateCheckQuerySchema = Type.Object({
  customerId: Type.Integer({ minimum: 1 }),
  name: Type.String({ minLength: 1, maxLength: 100 }),
})
export const OpportunityCreateReqSchema = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 100 }),
  customerId: Type.Integer({ minimum: 1 }),
  primaryContactId: Type.Optional(Type.Union([Type.Integer(), Type.Null()])),
  ownerId: Type.Integer({ minimum: 1 }),
  stage: Type.Optional(OpenStageSchema),
  amountCents: Type.Optional(Type.Union([Type.Integer({ minimum: 0 }), Type.Null()])),
  expectedCloseDate: Type.Optional(Type.Union([Type.String({ format: 'date-time' }), Type.Null()])),
  sourceId: Type.Optional(Type.Union([Type.Integer({ minimum: 1 }), Type.Null()])),
  productIds: Type.Optional(Type.Array(Type.Integer({ minimum: 1 }), { uniqueItems: true })),
  requirement: Type.String({ minLength: 1, maxLength: 1000 }),
  competition: Type.Optional(Type.Union([Type.String({ maxLength: 1000 }), Type.Null()])),
  remark: Type.Optional(Type.String({ maxLength: 1000 })),
  nextAction: Type.Optional(Type.String({ maxLength: 500 })),
  nextFollowUpAt: Type.Optional(Type.Union([Type.String({ format: 'date-time' }), Type.Null()])),
  creationKey: Type.Optional(Type.String({ minLength: 8, maxLength: 64 })),
})
export type OpportunityCreateReq = Static<typeof OpportunityCreateReqSchema>
export const OpportunityUpdateReqSchema = Type.Object({
  name: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
  primaryContactId: Type.Optional(Type.Union([Type.Integer(), Type.Null()])),
  ownerId: Type.Optional(Type.Integer({ minimum: 1 })),
  amountCents: Type.Optional(Type.Union([Type.Integer({ minimum: 0 }), Type.Null()])),
  expectedCloseDate: Type.Optional(Type.Union([Type.String({ format: 'date-time' }), Type.Null()])),
  sourceId: Type.Optional(Type.Union([Type.Integer({ minimum: 1 }), Type.Null()])),
  productIds: Type.Optional(Type.Array(Type.Integer({ minimum: 1 }), { uniqueItems: true })),
  requirement: Type.Optional(Type.Union([Type.String({ maxLength: 1000 }), Type.Null()])),
  competition: Type.Optional(Type.Union([Type.String({ maxLength: 1000 }), Type.Null()])),
  nextAction: Type.Optional(Type.Union([Type.String({ maxLength: 500 }), Type.Null()])),
  nextFollowUpAt: Type.Optional(Type.Union([Type.String({ format: 'date-time' }), Type.Null()])),
  remark: Type.Optional(Type.Union([Type.String({ maxLength: 1000 }), Type.Null()])),
})
export type OpportunityUpdateReq = Static<typeof OpportunityUpdateReqSchema>
export const OpportunityIdParamSchema = Type.Object({ id: Type.Integer({ minimum: 1 }) })
export const OpportunityAdvanceReqSchema = Type.Object({
  toStage: Type.Union([
    Type.Literal('solution'),
    Type.Literal('quotation'),
    Type.Literal('negotiation'),
  ]),
  reason: Type.Optional(Type.String({ maxLength: 500 })),
})
export const OpportunityMarkWonReqSchema = Type.Object({ reason: Type.Optional(Type.String({ maxLength: 500 })) })
export const OpportunityMarkLostReqSchema = Type.Object({
  lostReason: LostReasonSchema,
  reason: Type.Optional(Type.String({ maxLength: 500 })),
})
export const OpportunityTransferReqSchema = Type.Object({
  ownerId: Type.Integer({ minimum: 1 }),
  reason: Type.Optional(Type.String({ maxLength: 500 })),
})
export type OpportunityAdvanceReq = Static<typeof OpportunityAdvanceReqSchema>
export type OpportunityMarkWonReq = Static<typeof OpportunityMarkWonReqSchema>
export type OpportunityMarkLostReq = Static<typeof OpportunityMarkLostReqSchema>
export type OpportunityTransferReq = Static<typeof OpportunityTransferReqSchema>
