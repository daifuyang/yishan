import { Type, type Static } from '@sinclair/typebox'
import { PaginationQuerySchema } from './common.schema.js'
export const PaymentIdParamSchema = Type.Object({ id: Type.Integer({ minimum: 1 }) })
export const PaymentContractParamSchema = Type.Object({ contractId: Type.Integer({ minimum: 1 }) })
export const PaymentRespSchema = Type.Object({ id: Type.Number(), contractId: Type.Number(), customerId: Type.Number(), amountCents: Type.Number(), paidAt: Type.String(), methodCode: Type.String(), remark: Type.Union([Type.String(), Type.Null()]) })
export const PaymentListQuerySchema = Type.Intersect([
  PaginationQuerySchema,
  Type.Object({
    contractId: Type.Optional(Type.Integer({ minimum: 1 })),
    customerId: Type.Optional(Type.Integer({ minimum: 1 })),
    methodCode: Type.Optional(Type.String({ maxLength: 64 })),
    paidFrom: Type.Optional(Type.String({ format: 'date-time' })),
    paidTo: Type.Optional(Type.String({ format: 'date-time' })),
  }),
])
export const PaymentListRespSchema = Type.Intersect([
  PaymentRespSchema,
  Type.Object({ contractNo: Type.String(), contractName: Type.String(), customerName: Type.String() }),
])
export const PaymentCreateReqSchema = Type.Object({ amountCents: Type.Integer({ minimum: 1 }), paidAt: Type.String({ format: 'date-time' }), methodCode: Type.String({ minLength: 1, maxLength: 64 }), remark: Type.Optional(Type.Union([Type.String({ maxLength: 500 }), Type.Null()])) })
export const PaymentUpdateReqSchema = Type.Partial(PaymentCreateReqSchema)
export type PaymentCreateReq = Static<typeof PaymentCreateReqSchema>
export type PaymentUpdateReq = Static<typeof PaymentUpdateReqSchema>
export type PaymentListQuery = Static<typeof PaymentListQuerySchema>
