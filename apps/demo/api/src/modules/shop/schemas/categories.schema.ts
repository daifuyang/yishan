import { Type } from '@sinclair/typebox'
import { PaginationQuerySchema } from './common.schema.js'

export const CategoryRespSchema = Type.Object({
  id: Type.Number(),
  name: Type.String(),
  parentId: Type.Union([Type.Number(), Type.Null()]),
  coverImage: Type.Union([Type.String(), Type.Null()]),
  icon: Type.Union([Type.String(), Type.Null()]),
  description: Type.Union([Type.String(), Type.Null()]),
  sortOrder: Type.Number(),
  status: Type.Number(),
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
})

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

export const CategoryCreateReqSchema = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 100 }),
  parentId: Type.Optional(Type.Union([Type.Integer(), Type.Null()])),
  coverImage: Type.Optional(Type.String({ maxLength: 500 })),
  icon: Type.Optional(Type.String({ maxLength: 100 })),
  description: Type.Optional(Type.String({ maxLength: 500 })),
  sortOrder: Type.Optional(Type.Integer()),
  status: Type.Optional(Type.Integer({ minimum: 0, maximum: 1 })),
})
export const CategoryUpdateReqSchema = Type.Partial(CategoryCreateReqSchema)
