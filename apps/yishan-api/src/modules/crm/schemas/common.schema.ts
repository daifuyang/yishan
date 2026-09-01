import { Type, type Static } from '@sinclair/typebox'

/**
 * CRM 模块路由共用 schema。
 *
 * 分页、通用响应、ID 参数。
 */

export const PaginationQuerySchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
  pageSize: Type.Optional(Type.Integer({ minimum: 1, maximum: 200, default: 10 })),
  keyword: Type.Optional(Type.String({ maxLength: 100 })),
})
export type PaginationQuery = Static<typeof PaginationQuerySchema>

export const IdParamsSchema = Type.Object({
  id: Type.Integer({ minimum: 1 }),
})
export type IdParams = Static<typeof IdParamsSchema>

/** 通用「操作成功」响应（delete / claim / release / transfer 等无实体返回的动作）。 */
export const OkRespSchema = Type.Object({
  success: Type.Boolean(),
})
export type OkResp = Static<typeof OkRespSchema>

export const CrmCustomerIdParamsSchema = Type.Object({
  customerId: Type.Integer({ minimum: 1 }),
})
export type CrmCustomerIdParams = Static<typeof CrmCustomerIdParamsSchema>

/** 当前登录用户上下文。 */
export interface CurrentUserLike {
  id: number
  roleIds?: number[]
  deptIds?: number[]
}
