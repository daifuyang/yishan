import { Type, type Static } from '@sinclair/typebox'
export const PaymentIdParamSchema = Type.Object({ id: Type.Integer({ minimum: 1 }) })
export const PaymentContractParamSchema = Type.Object({ contractId: Type.Integer({ minimum: 1 }) })
export const PaymentRespSchema = Type.Object({ id: Type.Number(), contractId: Type.Number(), customerId: Type.Number(), amountCents: Type.Number(), paidAt: Type.String(), methodCode: Type.String(), remark: Type.Union([Type.String(), Type.Null()]) })
export const PaymentCreateReqSchema = Type.Object({ amountCents: Type.Integer({ minimum: 1 }), paidAt: Type.String({ format: 'date-time' }), methodCode: Type.String({ minLength: 1, maxLength: 64 }), remark: Type.Optional(Type.Union([Type.String({ maxLength: 500 }), Type.Null()])) })
export const PaymentUpdateReqSchema = Type.Partial(PaymentCreateReqSchema)
export type PaymentCreateReq = Static<typeof PaymentCreateReqSchema>
export type PaymentUpdateReq = Static<typeof PaymentUpdateReqSchema>
