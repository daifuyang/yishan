import { Type, type Static } from '@sinclair/typebox'
import { PaginationQuerySchema } from './common.schema.js'
export const PaymentIdParamSchema = Type.Object({ id: Type.Integer({ minimum: 1 }) })
export const PaymentContractParamSchema = Type.Object({ contractId: Type.Integer({ minimum: 1 }) })

/** 收款方式 code 字典（与 sys_enum 'crm_payment_method' seed 对齐）。 */
export const PAYMENT_METHOD_CODES = ['bank_transfer', 'alipay', 'wechat', 'cash', 'check', 'other'] as const
export const PaymentMethodSchema = Type.String({ enum: [...PAYMENT_METHOD_CODES] })

/** 回款状态 enum：MVP 仅 'confirmed'；预留 PENDING / VOIDED 扩展位。 */
export const PAYMENT_STATUS = ['confirmed', 'pending', 'voided'] as const
export const PaymentStatusSchema = Type.String({ enum: [...PAYMENT_STATUS] })

export const PaymentRespSchema = Type.Object({
  id: Type.Number(),
  paymentNo: Type.String(),
  contractId: Type.Number(),
  customerId: Type.Number(),
  amountCents: Type.Number(),
  paidAt: Type.String({ format: 'date-time' }),
  methodCode: PaymentMethodSchema,
  transactionNo: Type.Union([Type.String(), Type.Null()]),
  status: PaymentStatusSchema,
  remark: Type.Union([Type.String(), Type.Null()]),
  creatorId: Type.Union([Type.Number(), Type.Null()]),
  creatorName: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
})
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
/** 列表行响应：宽表 join 合同 / 客户 / 登记人。 */
export const PaymentListRespSchema = Type.Intersect([
  PaymentRespSchema,
  Type.Object({
    contractNo: Type.String(),
    contractName: Type.String(),
    customerName: Type.String(),
  }),
])
/** 创建请求：amountCents 由前端 transform 元 → 分；methodCode 改 optional（默认 'other'）。 */
export const PaymentCreateReqSchema = Type.Object({
  amountCents: Type.Integer({ minimum: 1 }),
  paidAt: Type.String({ format: 'date-time' }),
  methodCode: Type.Optional(PaymentMethodSchema),
  transactionNo: Type.Optional(Type.String({ maxLength: 64 })),
  remark: Type.Optional(Type.Union([Type.String({ maxLength: 500 }), Type.Null()])),
})
export const PaymentUpdateReqSchema = Type.Partial(PaymentCreateReqSchema)
export type PaymentCreateReq = Static<typeof PaymentCreateReqSchema>
export type PaymentUpdateReq = Static<typeof PaymentUpdateReqSchema>
export type PaymentListQuery = Static<typeof PaymentListQuerySchema>
