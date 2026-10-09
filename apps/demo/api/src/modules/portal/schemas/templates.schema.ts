import { Type, type Static } from '@sinclair/typebox'
import { PaginationQuerySchema } from './common.schema.js'

/**
 * Template 的 HTTP schema。
 *
 * type: 0=文章模板、1=页面模板。
 */

export const TemplateRespSchema = Type.Object({
  id: Type.Number(),
  name: Type.String(),
  description: Type.Union([Type.String(), Type.Null()]),
  type: Type.Integer(),
  schema: Type.Optional(Type.Any()),
  config: Type.Optional(Type.Any()),
  status: Type.Number(),
  isSystemDefault: Type.Boolean(),
  creatorId: Type.Union([Type.Number(), Type.Null()]),
  createdAt: Type.String({ format: 'date-time' }),
  updaterId: Type.Union([Type.Number(), Type.Null()]),
  updatedAt: Type.String({ format: 'date-time' }),
})
export type TemplateResp = Static<typeof TemplateRespSchema>

export const TemplateListRespSchema = Type.Object({
  total: Type.Number(),
  page: Type.Number(),
  pageSize: Type.Number(),
  items: Type.Array(TemplateRespSchema),
})

export const TemplateListQuerySchema = Type.Composite([
  PaginationQuerySchema,
  Type.Object({
    type: Type.Optional(Type.Integer({ minimum: 0, maximum: 1 })),
    status: Type.Optional(Type.Integer({ minimum: 0, maximum: 1 })),
  }),
])
export type TemplateListQuery = Static<typeof TemplateListQuerySchema>

export const TemplateCreateReqSchema = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 100 }),
  description: Type.Optional(Type.String({ maxLength: 255 })),
  type: Type.Integer({ minimum: 0, maximum: 1 }),
  schema: Type.Optional(Type.Any()),
  config: Type.Optional(Type.Any()),
  status: Type.Optional(Type.Integer({ minimum: 0, maximum: 1 })),
  isSystemDefault: Type.Optional(Type.Boolean()),
})
export type TemplateCreateReq = Static<typeof TemplateCreateReqSchema>

export const TemplateUpdateReqSchema = Type.Partial(TemplateCreateReqSchema)
export type TemplateUpdateReq = Static<typeof TemplateUpdateReqSchema>
