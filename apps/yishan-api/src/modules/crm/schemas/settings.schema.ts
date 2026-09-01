import { Type, type Static } from '@sinclair/typebox'
import { PaginationQuerySchema } from './common.schema.js'

/**
 * 设置相关（标签 / 状态 / 来源）的 HTTP schema。
 */

/* ─── Tag ───────────────────────────────────────── */

export const TagRespSchema = Type.Object({
  id: Type.Number(),
  name: Type.String(),
  color: Type.Union([Type.String(), Type.Null()]),
  enabled: Type.Number(),
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
})
export type TagResp = Static<typeof TagRespSchema>

export const TagListRespSchema = Type.Object({
  total: Type.Number(),
  items: Type.Array(TagRespSchema),
})

export const TagCreateReqSchema = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 50 }),
  color: Type.Optional(Type.String({ maxLength: 16 })),
  enabled: Type.Optional(Type.Integer({ minimum: 0, maximum: 1 })),
})
export type TagCreateReq = Static<typeof TagCreateReqSchema>

export const TagUpdateReqSchema = Type.Partial(
  Type.Object({
    name: Type.String({ minLength: 1, maxLength: 50 }),
    color: Type.Union([Type.String({ maxLength: 16 }), Type.Null()]),
    enabled: Type.Integer({ minimum: 0, maximum: 1 }),
  }),
)
export type TagUpdateReq = Static<typeof TagUpdateReqSchema>

export const TagListQuerySchema = PaginationQuerySchema
export type TagListQuery = Static<typeof TagListQuerySchema>

/* ─── Status ────────────────────────────────────── */

export const StatusRespSchema = Type.Object({
  id: Type.Number(),
  name: Type.String(),
  code: Type.Union([Type.String(), Type.Null()]),
  type: Type.String(),
  sort: Type.Number(),
  enabled: Type.Number(),
  isSystem: Type.Number(),
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
})
export type StatusResp = Static<typeof StatusRespSchema>

export const StatusListRespSchema = Type.Object({
  total: Type.Number(),
  items: Type.Array(StatusRespSchema),
})

/** 第一版允许修改的字段：名称 / 排序 / 是否启用。系统预置不可改 code / type / isSystem。 */
export const StatusCreateReqSchema = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 50 }),
  code: Type.Optional(Type.String({ maxLength: 50 })),
  type: Type.Optional(Type.String({ maxLength: 16 })),
  sort: Type.Optional(Type.Integer()),
  enabled: Type.Optional(Type.Integer({ minimum: 0, maximum: 1 })),
})
export type StatusCreateReq = Static<typeof StatusCreateReqSchema>

export const StatusUpdateReqSchema = Type.Partial(
  Type.Object({
    name: Type.String({ minLength: 1, maxLength: 50 }),
    sort: Type.Integer(),
    enabled: Type.Integer({ minimum: 0, maximum: 1 }),
  }),
)
export type StatusUpdateReq = Static<typeof StatusUpdateReqSchema>

/* ─── Source ────────────────────────────────────── */

export const SourceRespSchema = Type.Object({
  id: Type.Number(),
  name: Type.String(),
  code: Type.Union([Type.String(), Type.Null()]),
  sort: Type.Number(),
  enabled: Type.Number(),
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
})
export type SourceResp = Static<typeof SourceRespSchema>

export const SourceListRespSchema = Type.Object({
  total: Type.Number(),
  items: Type.Array(SourceRespSchema),
})

export const SourceCreateReqSchema = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 50 }),
  code: Type.Optional(Type.String({ maxLength: 50 })),
  sort: Type.Optional(Type.Integer()),
  enabled: Type.Optional(Type.Integer({ minimum: 0, maximum: 1 })),
})
export type SourceCreateReq = Static<typeof SourceCreateReqSchema>

export const SourceUpdateReqSchema = Type.Partial(
  Type.Object({
    name: Type.String({ minLength: 1, maxLength: 50 }),
    sort: Type.Integer(),
    enabled: Type.Integer({ minimum: 0, maximum: 1 }),
  }),
)
export type SourceUpdateReq = Static<typeof SourceUpdateReqSchema>
