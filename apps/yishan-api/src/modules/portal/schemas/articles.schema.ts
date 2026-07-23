import { Type, type Static } from '@sinclair/typebox'
import { PaginationQuerySchema } from './common.schema.js'

/**
 * Article 的 HTTP schema。
 */

export const ArticleRespSchema = Type.Object({
  id: Type.Number(),
  title: Type.String(),
  slug: Type.Union([Type.String(), Type.Null()]),
  summary: Type.Union([Type.String(), Type.Null()]),
  content: Type.String(),
  coverImage: Type.Union([Type.String(), Type.Null()]),
  status: Type.Number(),
  isPinned: Type.Boolean(),
  publishTime: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  tags: Type.Optional(Type.Array(Type.String())),
  templateId: Type.Union([Type.Number(), Type.Null()]),
  categoryIds: Type.Optional(Type.Array(Type.Number())),
  creatorId: Type.Union([Type.Number(), Type.Null()]),
  createdAt: Type.String({ format: 'date-time' }),
  updaterId: Type.Union([Type.Number(), Type.Null()]),
  updatedAt: Type.String({ format: 'date-time' }),
})
export type ArticleResp = Static<typeof ArticleRespSchema>

export const ArticleListRespSchema = Type.Object({
  total: Type.Number(),
  page: Type.Number(),
  pageSize: Type.Number(),
  items: Type.Array(ArticleRespSchema),
})

export const ArticleListQuerySchema = Type.Composite([
  PaginationQuerySchema,
  Type.Object({
    status: Type.Optional(Type.Integer({ minimum: 0, maximum: 1 })),
    categoryId: Type.Optional(Type.Integer()),
    templateId: Type.Optional(Type.Integer()),
  }),
])
export type ArticleListQuery = Static<typeof ArticleListQuerySchema>

export const ArticleCreateReqSchema = Type.Object({
  title: Type.String({ minLength: 1, maxLength: 200 }),
  slug: Type.Optional(Type.String({ maxLength: 200 })),
  summary: Type.Optional(Type.String({ maxLength: 500 })),
  content: Type.String(),
  coverImage: Type.Optional(Type.String({ maxLength: 500 })),
  status: Type.Optional(Type.Integer({ minimum: 0, maximum: 1 })),
  isPinned: Type.Optional(Type.Boolean()),
  publishTime: Type.Optional(Type.String({ format: 'date-time' })),
  tags: Type.Optional(Type.Array(Type.String())),
  templateId: Type.Optional(Type.Union([Type.Integer(), Type.Null()])),
  categoryIds: Type.Optional(Type.Array(Type.Integer())),
})
export type ArticleCreateReq = Static<typeof ArticleCreateReqSchema>

export const ArticleUpdateReqSchema = Type.Partial(ArticleCreateReqSchema)
export type ArticleUpdateReq = Static<typeof ArticleUpdateReqSchema>
