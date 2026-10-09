import { Type, type Static } from '@sinclair/typebox'
import { PaginationQuerySchema } from './common.schema.js'

/**
 * Page 的 HTTP schema。
 */

export const PageRespSchema = Type.Object({
  id: Type.Number(),
  title: Type.String(),
  path: Type.String(),
  content: Type.String(),
  status: Type.Number(),
  attributes: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  publishTime: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  templateId: Type.Union([Type.Number(), Type.Null()]),
  creatorId: Type.Union([Type.Number(), Type.Null()]),
  createdAt: Type.String({ format: 'date-time' }),
  updaterId: Type.Union([Type.Number(), Type.Null()]),
  updatedAt: Type.String({ format: 'date-time' }),
})
export type PageResp = Static<typeof PageRespSchema>

export const PageListRespSchema = Type.Object({
  total: Type.Number(),
  page: Type.Number(),
  pageSize: Type.Number(),
  items: Type.Array(PageRespSchema),
})

export const PageListQuerySchema = Type.Composite([
  PaginationQuerySchema,
  Type.Object({
    status: Type.Optional(Type.Integer({ minimum: 0, maximum: 1 })),
  }),
])
export type PageListQuery = Static<typeof PageListQuerySchema>

export const PageCreateReqSchema = Type.Object({
  title: Type.String({ minLength: 1, maxLength: 200 }),
  path: Type.String({ minLength: 1, maxLength: 255 }),
  content: Type.String(),
  status: Type.Optional(Type.Integer({ minimum: 0, maximum: 1 })),
  attributes: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  publishTime: Type.Optional(Type.String({ format: 'date-time' })),
  templateId: Type.Optional(Type.Union([Type.Integer(), Type.Null()])),
})
export type PageCreateReq = Static<typeof PageCreateReqSchema>

export const PageUpdateReqSchema = Type.Partial(PageCreateReqSchema)
export type PageUpdateReq = Static<typeof PageUpdateReqSchema>
