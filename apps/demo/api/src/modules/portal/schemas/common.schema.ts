import { Type, type Static } from '@sinclair/typebox'

/**
 * portal 模块路由共用 schema。
 *
 * 分页、通用响应、ID 参数。
 */

export const PaginationQuerySchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
  pageSize: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 10 })),
  keyword: Type.Optional(Type.String({ maxLength: 100 })),
})
export type PaginationQuery = Static<typeof PaginationQuerySchema>

export const IdParamsSchema = Type.Object({
  id: Type.Integer({ minimum: 1 }),
})
export type IdParams = Static<typeof IdParamsSchema>

export const PaginationRespSchema = Type.Object({
  total: Type.Number(),
  page: Type.Number(),
  pageSize: Type.Number(),
  items: Type.Array(Type.Any()),
})

/** 通用「操作成功」响应（delete / publish 等无实体返回的动作）。 */
export const OkRespSchema = Type.Object({
  success: Type.Boolean(),
})
