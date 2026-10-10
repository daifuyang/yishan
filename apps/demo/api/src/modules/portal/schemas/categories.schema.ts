import { Type, type Static } from '@sinclair/typebox'
import { PaginationQuerySchema } from './common.schema.js'

/**
 * Category 的 HTTP schema。
 *
 * 入参 + 响应 + 列表包装。
 */

export const CategoryRespSchema = Type.Object({
  id: Type.Number(),
  name: Type.String(),
  slug: Type.Union([Type.String(), Type.Null()]),
  parentId: Type.Union([Type.Number(), Type.Null()]),
  status: Type.Number(),
  sortOrder: Type.Number(),
  description: Type.Union([Type.String(), Type.Null()]),
  creatorId: Type.Union([Type.Number(), Type.Null()]),
  createdAt: Type.String({ format: 'date-time' }),
  updaterId: Type.Union([Type.Number(), Type.Null()]),
  updatedAt: Type.String({ format: 'date-time' }),
})
export type CategoryResp = Static<typeof CategoryRespSchema>

export const CategoryListRespSchema = Type.Object({
  total: Type.Number(),
  page: Type.Number(),
  pageSize: Type.Number(),
  items: Type.Array(CategoryRespSchema),
})

export const CategoryListQuerySchema = Type.Composite([
  PaginationQuerySchema,
  Type.Object({
    parentId: Type.Optional(Type.Integer()),
    status: Type.Optional(Type.Integer()),
  }),
])
export type CategoryListQuery = Static<typeof CategoryListQuerySchema>

export const CategoryCreateReqSchema = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 100 }),
  slug: Type.Optional(Type.String({ maxLength: 100 })),
  parentId: Type.Optional(Type.Union([Type.Integer(), Type.Null()])),
  status: Type.Optional(Type.Integer({ minimum: 0, maximum: 1 })),
  sortOrder: Type.Optional(Type.Integer()),
  description: Type.Optional(Type.String({ maxLength: 255 })),
})
export type CategoryCreateReq = Static<typeof CategoryCreateReqSchema>

export const CategoryUpdateReqSchema = Type.Partial(CategoryCreateReqSchema)
export type CategoryUpdateReq = Static<typeof CategoryUpdateReqSchema>
