import { Type, type Static } from '@sinclair/typebox'
import { PaginationQuerySchema } from './common.schema.js'

/**
 * 报价单 status 字段的合法取值。
 *
 * 状态机（service 层强制）：
 *   draft → sent
 *   sent → accepted | rejected | voided
 *   accepted → sent（未生成合同的误操作纠正）；报价内容始终通过新版本调整。
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
  /** 产品 id：可为 null（自定义项不绑定 Product 主数据）。 */
  productId: Type.Union([Type.Number(), Type.Null()]),
  productNameSnapshot: Type.String(),
  description: Type.Union([Type.String(), Type.Null()]),
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
  seriesId: Type.Optional(Type.String()),
  seriesNo: Type.Optional(Type.String()),
  seriesTitle: Type.Optional(Type.String()),
  currentVersion: Type.Optional(Type.Number()),
  versionCount: Type.Optional(Type.Number()),
  /** 报价单名称（前端必填；旧数据默认空字符串，UI 兜底展示 quotationNo）。 */
  name: Type.String(),
  version: Type.Number(),
  rootQuoteId: Type.Union([Type.Number(), Type.Null()]),
  sourceQuoteId: Type.Union([Type.Number(), Type.Null()]),
  customerId: Type.Number(),
  opportunityId: Type.Union([Type.Number(), Type.Null()]),
  contactId: Type.Union([Type.Number(), Type.Null()]),
  opportunityName: Type.Union([Type.String(), Type.Null()]),
  contactName: Type.Union([Type.String(), Type.Null()]),
  quoteDate: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  ownerUserId: Type.Number(),
  ownerUserName: Type.Union([Type.String(), Type.Null()]),
  ownerDepartmentId: Type.Union([Type.Number(), Type.Null()]),
  customerName: Type.Union([Type.String(), Type.Null()]),
  status: Type.Union(QUOTATION_STATUS.map((s) => Type.Literal(s))),
  validUntil: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  netCents: Type.Number(),
  taxCents: Type.Number(),
  totalCents: Type.Number(),
  /** 整单优惠（cents BIGINT）；与每行 discountBp 叠加，由 service 在 computeItemsTotals 中扣减。 */
  discountAmountCents: Type.Number(),
  remark: Type.Union([Type.String(), Type.Null()]),
  creatorId: Type.Union([Type.Number(), Type.Null()]),
  publicDiscountDescription: Type.Optional(Type.Union([Type.String({ maxLength: 50 }), Type.Null()])),
  internalDiscountReason: Type.Optional(Type.Union([Type.String({ maxLength: 500 }), Type.Null()])),
  createdAt: Type.String({ format: 'date-time' }),
  updaterId: Type.Union([Type.Number(), Type.Null()]),
  updatedAt: Type.String({ format: 'date-time' }),
  sentAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  acceptedAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  acceptedBy: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
  contractId: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
  closedAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  shareFirstViewedAt: Type.Optional(Type.Union([Type.String({ format: 'date-time' }), Type.Null()])),
  shareViewCount: Type.Optional(Type.Number()),
  hasShare: Type.Optional(Type.Boolean()),
  share: Type.Optional(Type.Union([
    Type.Object({
      id: Type.Number(),
      url: Type.Optional(Type.String()),
      status: Type.Union([Type.Literal('active'), Type.Literal('revoked')]),
      expiresAt: Type.String({ format: 'date-time' }),
      sentAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
      firstViewedAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
      lastViewedAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
      viewCount: Type.Number(),
    }),
    Type.Null(),
  ])),
  items: Type.Array(QuotationItemRespSchema),
  versions: Type.Optional(Type.Array(Type.Object({
    id: Type.Number(), quotationNo: Type.String(), version: Type.Number(), status: Type.String(),
    totalCents: Type.Number(), quoteDate: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
    createdAt: Type.String({ format: 'date-time' }), shareFirstViewedAt: Type.Optional(Type.Union([Type.String({ format: 'date-time' }), Type.Null()])),
    shareViewCount: Type.Optional(Type.Number()), hasShare: Type.Optional(Type.Boolean()),
  }))),
})
export type QuotationResp = Static<typeof QuotationRespSchema>
export const QuoteSeriesSummaryRespSchema = Type.Object({
  seriesId: Type.String(), seriesNo: Type.String(), title: Type.String(),
  customerId: Type.Number(), customerName: Type.Union([Type.String(), Type.Null()]),
  opportunityId: Type.Union([Type.Number(), Type.Null()]), opportunityName: Type.Union([Type.String(), Type.Null()]),
  opportunityNo: Type.Union([Type.String(), Type.Null()]), currentQuoteId: Type.Number(),
  currentVersion: Type.Optional(Type.Number()), versionCount: Type.Optional(Type.Number()),
  currentStatus: Type.Union(QUOTATION_STATUS.map((s) => Type.Literal(s))), currentAmount: Type.Number(),
  quoteDate: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  validUntil: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  customerViewStatus: Type.Union([Type.Literal('viewed'), Type.Literal('unviewed')]),
  lastViewedAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]), viewCount: Type.Number(),
  ownerUserId: Type.Number(), ownerUserName: Type.Union([Type.String(), Type.Null()]), hasActiveShare: Type.Boolean(),
})
export type QuoteSeriesSummaryResp = Static<typeof QuoteSeriesSummaryRespSchema>
/** 版本详情兼容列表仓库的内部响应测试；业务列表路由使用 QuoteSeriesSummaryResp。 */
export const QuotationListItemRespSchema = Type.Omit(QuotationRespSchema, ['items'])

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
 * 不可传 ownerUserId / status / version（负责人继承商机，状态与版本由服务端设置）。
 *
 * items 字段对齐 QuotationItemResp，但省略 id / quotationId / createdAt / updatedAt / sortOrder
 * （sortOrder 在 service 内按 items 顺序补；id / 时间由 DB 自动生成）。
 */
export const QuotationItemCreateSchema = Type.Object({
  /** 产品 id：可选；null 表示「自定义项」（不绑定 Product 主数据）。 */
  productId: Type.Optional(Type.Union([Type.Integer({ minimum: 1 }), Type.Null()])),
  productNameSnapshot: Type.String({ minLength: 1, maxLength: 200 }),
  description: Type.Optional(Type.String({ maxLength: 2000 })),
  unitSnapshot: Type.Optional(Type.String({ maxLength: 64 })),
  quantityCents: Type.Integer({ minimum: 1, maximum: 2147483647 }),
  unitPriceCents: Type.Integer({ minimum: 0 }),
  discountBp: Type.Optional(Type.Integer({ minimum: 0, maximum: 10000 })),
  taxRateBp: Type.Optional(Type.Integer({ minimum: 0, maximum: 10000 })),
})

export const QuotationCreateReqSchema = Type.Object({
  customerId: Type.Integer({ minimum: 1 }),
  opportunityId: Type.Integer({ minimum: 1 }),
  contactId: Type.Integer({ minimum: 1 }),
  quoteDate: Type.String({ format: 'date-time' }),
  validUntil: Type.Optional(Type.String({ format: 'date-time' })),
  /** 报价单名称（业务可见）；与 quotationNo 一起在列表展示。 */
  name: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
  publicDiscountDescription: Type.Optional(Type.String({ maxLength: 50 })),
  internalDiscountReason: Type.Optional(Type.String({ maxLength: 500 })),
  /** 整单优惠（cents）；与每行 discountBp 叠加在 service.computeItemsTotals 中扣减。 */
  discountAmountCents: Type.Optional(Type.Integer({ minimum: 0 })),
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

export const QuotationUpdateReqSchema = Type.Partial(QuotationCreateReqSchema)
export type QuotationUpdateReq = Static<typeof QuotationUpdateReqSchema>

/** 状态机迁移的 reason（可选），例如作废 / 拒绝时填理由。 */
export const QuotationReasonReqSchema = Type.Object({
  reason: Type.Optional(Type.String({ maxLength: 500 })),
})
export type QuotationReasonReq = Static<typeof QuotationReasonReqSchema>

export const QuotationRevokeConfirmationReqSchema = Type.Object({
  reason: Type.Union([Type.Literal('mistake'), Type.Literal('customer_unconfirmed'), Type.Literal('other')]),
  remark: Type.Optional(Type.String({ maxLength: 500 })),
})
export type QuotationRevokeConfirmationReq = Static<typeof QuotationRevokeConfirmationReqSchema>

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

export const QuotationShareCreateReqSchema = Type.Object({
  replaceShareId: Type.Optional(Type.Integer({ minimum: 1 })),
  durationDays: Type.Optional(Type.Union([
    Type.Literal(3), Type.Literal(7), Type.Literal(14), Type.Literal(30),
  ])),
  followQuoteValidUntil: Type.Optional(Type.Boolean()),
  customDate: Type.Optional(Type.String({ format: 'date' })),
})
export type QuotationShareCreateReq = Static<typeof QuotationShareCreateReqSchema>

export const QuotationShareIdParamSchema = Type.Object({
  id: Type.Integer({ minimum: 1 }),
  shareId: Type.Integer({ minimum: 1 }),
})

export const QuotationSendReqSchema = Type.Object({
  shareId: Type.Integer({ minimum: 1 }),
})

export const PublicQuoteTokenParamSchema = Type.Object({
  token: Type.String({ minLength: 32, maxLength: 128 }),
})

export const PublicQuoteItemSchema = Type.Object({
  name: Type.String(),
  description: Type.Union([Type.String(), Type.Null()]),
  quantity: Type.Number(),
  unit: Type.Union([Type.String(), Type.Null()]),
  unitPriceCents: Type.Number(),
  amountCents: Type.Number(),
})

export const PublicQuoteSchema = Type.Object({
  companyName: Type.String(),
  quoteTitle: Type.String(),
  quoteNumber: Type.String(),
  quoteDate: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  validUntil: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  customerName: Type.String(),
  contactDisplayName: Type.Union([Type.String(), Type.Null()]),
  items: Type.Array(PublicQuoteItemSchema),
  subtotalCents: Type.Number(),
  publicDiscountDescription: Type.Union([Type.String({ maxLength: 50 }), Type.Null()]),
  discountAmountCents: Type.Number(),
  totalAmountCents: Type.Number(),
  remark: Type.Union([Type.String(), Type.Null()]),
  salesContactName: Type.Union([Type.String(), Type.Null()]),
  salesContactPhone: Type.Union([Type.String(), Type.Null()]),
  version: Type.Number(),
})

export const PublicQuoteResponseSchema = Type.Object({
  state: Type.Union([Type.Literal('ok'), Type.Literal('expired'), Type.Literal('revoked'), Type.Literal('invalid')]),
  quote: Type.Union([PublicQuoteSchema, Type.Null()]),
})
