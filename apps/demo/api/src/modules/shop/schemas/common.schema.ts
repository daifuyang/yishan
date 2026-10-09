import { Type } from '@sinclair/typebox'

export const PaginationQuerySchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
  pageSize: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 10 })),
  keyword: Type.Optional(Type.String({ maxLength: 100 })),
})

export const IdParamsSchema = Type.Object({
  id: Type.Integer({ minimum: 1 }),
})

export const PaginationRespSchema = Type.Object({
  total: Type.Number(),
  page: Type.Number(),
  pageSize: Type.Number(),
  items: Type.Array(Type.Any()),
})

/** 通用「操作成功」响应（delete / 清空属性值 等无实体返回的动作）。 */
export const OkRespSchema = Type.Object({
  success: Type.Boolean(),
})
