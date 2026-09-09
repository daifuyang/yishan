import { Type, type Static } from '@sinclair/typebox'
import { PaginationQuerySchema } from './common.schema.js'

/**
 * 报价单 status 字段的合法取值。
 *
 * 状态机（service 层强制）：
 *   draft → sent
 *   sent → accepted | rejected | voided
 *   accepted 不可变；同 opportunity 下的旧 accepted 会被新版 accepted 改写为 superseded
 */
export const QUOTATION_STATUS = [
  'draft',
  'sent',
  'accepted',
  'rejected',
  'voided',
  'superseded',
] as const
export type QuotationStatus = (typeof QUOTATION_STATUS)[number]

/**
 * 报价单明细行（item）HTTP schema。
 *
 * 数字约定与 utils/money 对齐：
 *   - unitPriceCents / lineAmountCents: BIGINT，cents
 *   - quantityCents: INT，存 ×10000 倍精度（12.3456 件 → 123456）
 *   - discountBp / taxRateBp: INT，基点（万分之）；1300 = 13%
 *
 * 不在 HTTP 层把「元」换成「分」——前端交互统一走 cents，服务端用 utils/money 计算。
 */
export const QuotationItemRespSchema = Type.Object({
  id: Type.Number(),
  quotationId: Type.Number(),
  productId: Type.Number(),
  productNameSnapshot: Type.String(),
  unitSnapshot: Type.Union([Type.String(), Type.Null()]),
  /** ×10000 倍精度整数（例：12.3456 件 → 123456）。 */
  quantityCents: Type.Number(),
  unitPriceCents: Type.Number(),
  discountBp: Type.Number(),
  taxRateBp: Type.Number(),
  lineAmountCents: Type.Number(),
  sortOrder: Type.Number(),
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
})
export type QuotationItemResp = Static<typeof QuotationItemRespSchema>

/** 报价单主表响应。 */
export const QuotationRespSchema = Type.Object({
  id: Type.Number(),
  quotationNo: Type.String(),
  version: Type.Number(),
  customerId: Type.Number(),
  opportunityId: Type.Union([Type.Number(), Type.Null()]),
  contactId: Type.Union([Type.Number(), Type.Null()]),
  ownerUserId: Type.Number(),
  ownerUserName: Type.Union([Type.String(), Type.Null()]),
  customerName: Type.Union([Type.String(), Type.Null()]),
  status: Type.Union(QUOTATION_STATUS.map((s) => Type.Literal(s))),
  validUntil: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  netCents: Type.Number(),
  taxCents: Type.Number(),
  totalCents: Type.Number(),
  remark: Type.Union([Type.String(), Type.Null()]),
  creatorId: Type.Union([Type.Number(), Type.Null()]),
  createdAt: Type.String({ format: 'date-time' }),
  updaterId: Type.Union([Type.Number(), Type.Null()]),
  updatedAt: Type.String({ format: 'date-time' }),
  sentAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  acceptedAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  closedAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  items: Type.Array(QuotationItemRespSchema),
})
export type QuotationResp = Static<typeof QuotationRespSchema>

/** 列表中按状态过滤时，把 status 限制为 QUOTATION_STATUS 之一。 */
export const QuotationListQuerySchema = Type.Composite([
  PaginationQuerySchema,
  Type.Object({
    keyword: Type.Optional(Type.String({ maxLength: 200 })),
    status: Type.Optional(Type.Union(QUOTATION_STATUS.map((s) => Type.Literal(s)))),
    customerId: Type.Optional(Type.Integer()),
    opportunityId: Type.Optional(Type.Integer()),
    ownerUserId: Type.Optional(Type.Integer()),
  }),
])
export type QuotationListQuery = Static<typeof QuotationListQuerySchema>

/**
 * 创建报价单请求。
 *
 * 必填：customerId、items[]；items 至少一条。
 * 不可传 ownerUserId / status / version（由 service 层按 currentUser 自动绑定，按状态机设置初始值）。
 *
 * items 字段对齐 QuotationItemResp，但省略 id / quotationId / createdAt / updatedAt / sortOrder
 * （sortOrder 在 service 内按 items 顺序补；id / 时间由 DB 自动生成）。
 */
export const QuotationItemCreateSchema = Type.Object({
  productId: Type.Integer({ minimum: 1 }),
  productNameSnapshot: Type.Optional(Type.String({ maxLength: 200 })),
  unitSnapshot: Type.Optional(Type.String({ maxLength: 64 })),
  quantityCents: Type.Integer({ minimum: 0 }),
  unitPriceCents: Type.Integer({ minimum: 0 }),
  discountBp: Type.Optional(Type.Integer({ minimum: 0, maximum: 10000 })),
  taxRateBp: Type.Optional(Type.Integer({ minimum: 0, maximum: 10000 })),
})

export const QuotationCreateReqSchema = Type.Object({
  customerId: Type.Integer({ minimum: 1 }),
  opportunityId: Type.Optional(Type.Union([Type.Integer(), Type.Null()])),
  contactId: Type.Optional(Type.Union([Type.Integer(), Type.Null()])),
  validUntil: Type.Optional(Type.Union([Type.String({ format: 'date-time' }), Type.Null()])),
  remark: Type.Optional(Type.String({ maxLength: 2000 })),
  items: Type.Array(QuotationItemCreateSchema, { minItems: 1, maxItems: 200 }),
})
export type QuotationCreateReq = Static<typeof QuotationCreateReqSchema>

/**
 * 编辑报价单请求（仅 draft 阶段生效）。
 *
 * 与创建请求相比：
 *   - customerId/opportunityId/contactId 改为可选；服务端兜底：未传则保留旧值。
 *   - items 不允许部分更新（部分更新会让 lineAmount 难以追溯），整体替换为新集合。
 */
export const QuotationItemUpdateSchema = QuotationItemCreateSchema

export const QuotationUpdateReqSchema = Type.Object({
  customerId: Type.Optional(Type.Integer({ minimum: 1 })),
  opportunityId: Type.Optional(Type.Union([Type.Integer(), Type.Null()])),
  contactId: Type.Optional(Type.Union([Type.Integer(), Type.Null()])),
  validUntil: Type.Optional(Type.Union([Type.String({ format: 'date-time' }), Type.Null()])),
  remark: Type.Optional(Type.String({ maxLength: 2000 })),
  items: Type.Optional(Type.Array(QuotationItemUpdateSchema, { minItems: 1, maxItems: 200 })),
})
export type QuotationUpdateReq = Static<typeof QuotationUpdateReqSchema>

/** 状态机迁移的 reason（可选），例如作废 / 拒绝时填理由。 */
export const QuotationReasonReqSchema = Type.Object({
  reason: Type.Optional(Type.String({ maxLength: 500 })),
})
export type QuotationReasonReq = Static<typeof QuotationReasonReqSchema>

/** 状态变更审计行。 */
export const QuotationStatusLogRespSchema = Type.Object({
  id: Type.Number(),
  quotationId: Type.Number(),
  fromStatus: Type.Union(QUOTATION_STATUS.map((s) => Type.Literal(s))),
  toStatus: Type.Union(QUOTATION_STATUS.map((s) => Type.Literal(s))),
  operatorUserId: Type.Number(),
  operatorUserName: Type.Union([Type.String(), Type.Null()]),
  reason: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.String({ format: 'date-time' }),
})
export type QuotationStatusLogResp = Static<typeof QuotationStatusLogRespSchema>

export const QuotationStatusLogListRespSchema = Type.Object({
  total: Type.Number(),
  items: Type.Array(QuotationStatusLogRespSchema),
})

export const QuotationIdParamSchema = Type.Object({
  id: Type.Integer({ minimum: 1 }),
})