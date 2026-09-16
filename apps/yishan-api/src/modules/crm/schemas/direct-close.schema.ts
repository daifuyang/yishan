import { Type, type Static } from '@sinclair/typebox'

export const DIRECT_CLOSE_EVIDENCE_TYPES = [
  'payment_proof',
  'order_confirmation',
  'verbal_confirmation',
  'other',
] as const

const DirectCloseEvidenceTypeSchema = Type.String({ enum: [...DIRECT_CLOSE_EVIDENCE_TYPES] })

export const DirectCloseOpportunityIdParamSchema = Type.Object({ id: Type.Integer({ minimum: 1 }) })
export const DirectCloseIdParamSchema = Type.Object({ id: Type.Integer({ minimum: 1 }) })
export const DirectCloseConfirmReqSchema = Type.Object({
  amountCents: Type.Integer({ minimum: 0 }),
  closedAt: Type.String({ format: 'date-time' }),
  evidenceType: DirectCloseEvidenceTypeSchema,
  attachmentIds: Type.Optional(Type.Array(Type.Integer({ minimum: 1 }))),
  remark: Type.Optional(Type.String({ maxLength: 2000 })),
})
export const DirectCloseRevokeReqSchema = Type.Object({ reason: Type.String({ minLength: 1, maxLength: 500 }) })
export const DirectCloseRespSchema = Type.Object({
  id: Type.Number(),
  customerId: Type.Number(),
  opportunityId: Type.Number(),
  amountCents: Type.Number(),
  closedAt: Type.String({ format: 'date-time' }),
  evidenceType: DirectCloseEvidenceTypeSchema,
  attachmentIds: Type.Union([Type.Array(Type.Integer()), Type.Null()]),
  remark: Type.Union([Type.String(), Type.Null()]),
  revokedAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  revokedReason: Type.Union([Type.String(), Type.Null()]),
})
export const DirectCloseActionRespSchema = Type.Object({ directClose: DirectCloseRespSchema, statusCode: Type.String() })

export type DirectCloseConfirmReq = Static<typeof DirectCloseConfirmReqSchema>
export type DirectCloseRevokeReq = Static<typeof DirectCloseRevokeReqSchema>
