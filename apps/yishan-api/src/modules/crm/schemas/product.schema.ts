/**
 * 产品目录（Phase 2）HTTP schema。
 *
 * 设计要点：
 *   - 所有金额字段在 wire 上都是 integer cents（JSON number，safe integer）。
 *   - 税率字段是 integer 基点（basis points）：1300 = 13%；前端按需展示百分比。
 *   - 必填字段用 Type.Literal / Type.Integer({ minimum }) 做严格校验，
 *     与 lead.schema 风格一致。
 */
import { Type, type Static } from '@sinclair/typebox'
import { IdParamsSchema, PaginationQuerySchema } from './common.schema.js'

/* ─── Product ─────────────────────────────────────── */

export const ProductRespSchema = Type.Object({
  id: Type.Number(),
  code: Type.String(),
  name: Type.String(),
  categoryCode: Type.Union([Type.String(), Type.Null()]),
  categoryName: Type.Union([Type.String(), Type.Null()]),
  unitCode: Type.Union([Type.String(), Type.Null()]),
  unitName: Type.Union([Type.String(), Type.Null()]),
  standardPriceCents: Type.Number(),
  taxRateBp: Type.Number(),
  enabled: Type.Number(),
  description: Type.Union([Type.String(), Type.Null()]),
  creatorId: Type.Union([Type.Number(), Type.Null()]),
  createdAt: Type.String({ format: 'date-time' }),
  updaterId: Type.Union([Type.Number(), Type.Null()]),
  updatedAt: Type.String({ format: 'date-time' }),
})
export type ProductResp = Static<typeof ProductRespSchema>

export const ProductListRespSchema = Type.Object({
  total: Type.Number(),
  page: Type.Number(),
  pageSize: Type.Number(),
  items: Type.Array(ProductRespSchema),
})
export type ProductListResp = Static<typeof ProductListRespSchema>

export const ProductListQuerySchema = Type.Composite([
  PaginationQuerySchema,
  Type.Object({
    keyword: Type.Optional(Type.String({ maxLength: 100 })),
    categoryCode: Type.Optional(Type.String({ maxLength: 64 })),
    enabled: Type.Optional(Type.Integer({ minimum: 0, maximum: 1 })),
    includeDisabled: Type.Optional(Type.Boolean()),
  }),
])
export type ProductListQuery = Static<typeof ProductListQuerySchema>

/**
 * 创建请求：code / name 必填，金额 / 税率可选（默认 0）。
 *
 * 不允许在创建时携带 createdBy / creatorId 等字段 —— 服务层从 currentUser 推导。
 */
export const ProductCreateReqSchema = Type.Object({
  code: Type.String({ minLength: 1, maxLength: 64 }),
  name: Type.String({ minLength: 1, maxLength: 200 }),
  categoryCode: Type.Optional(Type.Union([Type.String({ maxLength: 64 }), Type.Null()])),
  unitCode: Type.Optional(Type.Union([Type.String({ maxLength: 64 }), Type.Null()])),
  standardPriceCents: Type.Optional(Type.Number()),
  taxRateBp: Type.Optional(Type.Integer({ minimum: 0, maximum: 10000 })),
  enabled: Type.Optional(Type.Integer({ minimum: 0, maximum: 1 })),
  description: Type.Optional(Type.Union([Type.String({ maxLength: 2000 }), Type.Null()])),
})
export type ProductCreateReq = Static<typeof ProductCreateReqSchema>

/**
 * 更新请求：仅白名单字段。
 *
 * 注意：code 一旦创建不可改（被 crm_quotation_item.product_code 引用），
 * 因此 update 接口不接受 code。前端"修改编码"语义应通过"创建新编码 + 禁用旧编码"实现。
 */
export const ProductUpdateReqSchema = Type.Partial(
  Type.Object({
    name: Type.String({ minLength: 1, maxLength: 200 }),
    categoryCode: Type.Union([Type.String({ maxLength: 64 }), Type.Null()]),
    unitCode: Type.Union([Type.String({ maxLength: 64 }), Type.Null()]),
    standardPriceCents: Type.Number(),
    taxRateBp: Type.Integer({ minimum: 0, maximum: 10000 }),
    enabled: Type.Integer({ minimum: 0, maximum: 1 }),
    description: Type.Union([Type.String({ maxLength: 2000 }), Type.Null()]),
  }),
)
export type ProductUpdateReq = Static<typeof ProductUpdateReqSchema>

export const ProductIdParamsSchema = IdParamsSchema
export type ProductIdParams = Static<typeof ProductIdParamsSchema>

/* ─── ProductCategory ─────────────────────────────── */

export const ProductCategoryRespSchema = Type.Object({
  id: Type.Number(),
  code: Type.String(),
  name: Type.String(),
  parentCode: Type.Union([Type.String(), Type.Null()]),
  sort: Type.Number(),
  enabled: Type.Number(),
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
})
export type ProductCategoryResp = Static<typeof ProductCategoryRespSchema>

export const ProductCategoryListRespSchema = Type.Object({
  total: Type.Number(),
  page: Type.Number(),
  pageSize: Type.Number(),
  items: Type.Array(ProductCategoryRespSchema),
})
export type ProductCategoryListResp = Static<typeof ProductCategoryListRespSchema>

export const ProductCategoryListQuerySchema = Type.Composite([
  PaginationQuerySchema,
  Type.Object({
    keyword: Type.Optional(Type.String({ maxLength: 100 })),
    enabled: Type.Optional(Type.Integer({ minimum: 0, maximum: 1 })),
    includeDisabled: Type.Optional(Type.Boolean()),
  }),
])
export type ProductCategoryListQuery = Static<typeof ProductCategoryListQuerySchema>

export const ProductCategoryCreateReqSchema = Type.Object({
  code: Type.String({ minLength: 1, maxLength: 64 }),
  name: Type.String({ minLength: 1, maxLength: 100 }),
  parentCode: Type.Optional(Type.Union([Type.String({ maxLength: 64 }), Type.Null()])),
  sort: Type.Optional(Type.Integer()),
  enabled: Type.Optional(Type.Integer({ minimum: 0, maximum: 1 })),
})
export type ProductCategoryCreateReq = Static<typeof ProductCategoryCreateReqSchema>

export const ProductCategoryUpdateReqSchema = Type.Partial(
  Type.Object({
    name: Type.String({ minLength: 1, maxLength: 100 }),
    parentCode: Type.Union([Type.String({ maxLength: 64 }), Type.Null()]),
    sort: Type.Integer(),
    enabled: Type.Integer({ minimum: 0, maximum: 1 }),
  }),
)
export type ProductCategoryUpdateReq = Static<typeof ProductCategoryUpdateReqSchema>

export const ProductCategoryIdParamsSchema = IdParamsSchema
export type ProductCategoryIdParams = Static<typeof ProductCategoryIdParamsSchema>

/* ─── Unit ────────────────────────────────────────── */

export const UnitRespSchema = Type.Object({
  id: Type.Number(),
  code: Type.String(),
  name: Type.String(),
  sort: Type.Number(),
  enabled: Type.Number(),
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
})
export type UnitResp = Static<typeof UnitRespSchema>

export const UnitListRespSchema = Type.Object({
  total: Type.Number(),
  page: Type.Number(),
  pageSize: Type.Number(),
  items: Type.Array(UnitRespSchema),
})
export type UnitListResp = Static<typeof UnitListRespSchema>

export const UnitListQuerySchema = Type.Composite([
  PaginationQuerySchema,
  Type.Object({
    keyword: Type.Optional(Type.String({ maxLength: 100 })),
    enabled: Type.Optional(Type.Integer({ minimum: 0, maximum: 1 })),
    includeDisabled: Type.Optional(Type.Boolean()),
  }),
])
export type UnitListQuery = Static<typeof UnitListQuerySchema>

export const UnitCreateReqSchema = Type.Object({
  code: Type.String({ minLength: 1, maxLength: 64 }),
  name: Type.String({ minLength: 1, maxLength: 64 }),
  sort: Type.Optional(Type.Integer()),
  enabled: Type.Optional(Type.Integer({ minimum: 0, maximum: 1 })),
})
export type UnitCreateReq = Static<typeof UnitCreateReqSchema>

export const UnitUpdateReqSchema = Type.Partial(
  Type.Object({
    name: Type.String({ minLength: 1, maxLength: 64 }),
    sort: Type.Integer(),
    enabled: Type.Integer({ minimum: 0, maximum: 1 }),
  }),
)
export type UnitUpdateReq = Static<typeof UnitUpdateReqSchema>

export const UnitIdParamsSchema = IdParamsSchema
export type UnitIdParams = Static<typeof UnitIdParamsSchema>