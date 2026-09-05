import { Type, type Static } from '@sinclair/typebox'

/**
 * 跟进记录的 HTTP schema。
 */

export const ACTIVITY_TYPES = ['phone', 'wechat', 'visit', 'meeting', 'email', 'other'] as const

export const ActivityRespSchema = Type.Object({
  id: Type.Number(),
  customerId: Type.Number(),
  contactId: Type.Union([Type.Number(), Type.Null()]),
  type: Type.String(),
  content: Type.String(),
  occurredAt: Type.String({ format: 'date-time' }),
  nextFollowUpAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  operatorUserId: Type.Number(),
  operatorUserName: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
})
export type ActivityResp = Static<typeof ActivityRespSchema>

export const ActivityListRespSchema = Type.Object({
  total: Type.Number(),
  items: Type.Array(ActivityRespSchema),
})

export const ActivityCreateReqSchema = Type.Object({
  contactId: Type.Optional(Type.Union([Type.Integer(), Type.Null()])),
  type: Type.String({ enum: [...ACTIVITY_TYPES] }),
  content: Type.String({ minLength: 1, maxLength: 2000 }),
  occurredAt: Type.Optional(Type.String({ format: 'date-time' })),
  nextFollowUpAt: Type.Optional(Type.Union([Type.String({ format: 'date-time' }), Type.Null()])),
})
export type ActivityCreateReq = Static<typeof ActivityCreateReqSchema>

/**
 * 编辑。所有字段可选；至少要传一个（由 route 层把"全空"当作 400）。
 * 重算客户跟进时间时只看发生时间和下次跟进时间两个字段的"新值"，
 * 所以允许单独改 content / contactId 不会触发客户时间重算副作用——
 * service 仍会无脑重算一次（成本很低，换"任意字段变更都正确"的简单性）。
 */
export const ActivityUpdateReqSchema = Type.Partial(
  Type.Object({
    contactId: Type.Union([Type.Integer(), Type.Null()]),
    type: Type.String({ enum: [...ACTIVITY_TYPES] }),
    content: Type.String({ minLength: 1, maxLength: 2000 }),
    occurredAt: Type.String({ format: 'date-time' }),
    nextFollowUpAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  }),
)
export type ActivityUpdateReq = Static<typeof ActivityUpdateReqSchema>
