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
