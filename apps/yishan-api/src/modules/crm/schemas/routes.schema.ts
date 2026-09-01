/**
 * CRM 模块路由共用 response schema。
 *
 * 仅用于让路由在 swagger UI 里显示（hideUntagged:true 下，没 schema+tags 的路由被过滤）。
 * 入参 schema 见 customer.schema / contact.schema / activity.schema / settings.schema。
 */

import { Type, type TSchema } from '@sinclair/typebox'

/** 路由 tags 集中常量，方便 swagger 顶层 tag 列表对齐。 */
export const ROUTE_TAG = 'crm'

/**
 * 把 CRM 路由的真实响应形状（{success, code, message, data, timestamp}）
 * 包装到 TypeBox Schema 中，让 fast-json-stringify 在序列化时通过校验。
 */
function withEnvelope(dataSchema: TSchema) {
  return Type.Object({
    success: Type.Literal(true),
    code: Type.Literal(10000),
    message: Type.String(),
    data: dataSchema,
    timestamp: Type.String({ format: 'date-time' }),
  })
}

/** 列表响应（带分页）。 */
function withPaginatedEnvelope(itemSchema: TSchema) {
  return Type.Object({
    success: Type.Literal(true),
    code: Type.Literal(10000),
    message: Type.String(),
    data: Type.Array(itemSchema),
    pagination: Type.Object({
      page: Type.Number(),
      pageSize: Type.Number(),
      total: Type.Number(),
      totalPages: Type.Number(),
    }),
    timestamp: Type.String({ format: 'date-time' }),
  })
}

/** 操作成功（delete / claim / release 等），data 为 null。 */
export const OkEnvelopeSchema = Type.Object({
  success: Type.Literal(true),
  code: Type.Literal(10000),
  message: Type.String(),
  data: Type.Null(),
  timestamp: Type.String({ format: 'date-time' }),
})

export const EnvelopeSchema = withEnvelope
export const PaginatedEnvelopeSchema = withPaginatedEnvelope
