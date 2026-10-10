import { Type } from '@sinclair/typebox'
import { PaginationQuerySchema } from './common.schema.js'

export const OrderItemRespSchema = Type.Object({
  id: Type.Number(),
  orderId: Type.Number(),
  productId: Type.Number(),
  skuId: Type.Union([Type.Number(), Type.Null()]),
  skuName: Type.Union([Type.String(), Type.Null()]),
  coverImage: Type.Union([Type.String(), Type.Null()]),
  productName: Type.String(),
  price: Type.String(),
  quantity: Type.Number(),
  subtotal: Type.String(),
})

export const OrderRespSchema = Type.Object({
  id: Type.Number(),
  orderNo: Type.String(),
  userId: Type.Number(),
  totalAmount: Type.String(),
  freightAmount: Type.String(),
  discountAmount: Type.String(),
  payAmount: Type.String(),
  payStatus: Type.Number(),
  payTime: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  payMethod: Type.Union([Type.String(), Type.Null()]),
  orderStatus: Type.Number(),
  expressCompany: Type.Union([Type.String(), Type.Null()]),
  expressNo: Type.Union([Type.String(), Type.Null()]),
  deliverTime: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  receiveTime: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  cancelReason: Type.Union([Type.String(), Type.Null()]),
  remark: Type.Union([Type.String(), Type.Null()]),
  items: Type.Optional(Type.Array(OrderItemRespSchema)),
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
})

export const OrderListRespSchema = Type.Object({
  total: Type.Number(),
  page: Type.Number(),
  pageSize: Type.Number(),
  items: Type.Array(OrderRespSchema),
})

export const OrderListQuerySchema = Type.Composite([
  PaginationQuerySchema,
  Type.Object({
    userId: Type.Optional(Type.Integer()),
    orderStatus: Type.Optional(Type.Integer()),
    payStatus: Type.Optional(Type.Integer()),
  }),
])

export const OrderItemReqSchema = Type.Object({
  productId: Type.Integer(),
  skuId: Type.Optional(Type.Union([Type.Integer(), Type.Null()])),
  skuName: Type.Optional(Type.String({ maxLength: 500 })),
  coverImage: Type.Optional(Type.String({ maxLength: 500 })),
  productName: Type.String({ minLength: 1, maxLength: 200 }),
  price: Type.String({ pattern: '^\\d+(\\.\\d{1,2})?$' }),
  quantity: Type.Integer({ minimum: 1 }),
  subtotal: Type.String(),
})

export const OrderCreateReqSchema = Type.Object({
  orderNo: Type.String({ minLength: 1, maxLength: 32 }),
  userId: Type.Integer(),
  totalAmount: Type.String(),
  freightAmount: Type.Optional(Type.String()),
  discountAmount: Type.Optional(Type.String()),
  payAmount: Type.String(),
  orderStatus: Type.Optional(Type.Integer()),
  remark: Type.Optional(Type.String({ maxLength: 500 })),
  items: Type.Array(OrderItemReqSchema, { minItems: 1 }),
})
export const OrderUpdateReqSchema = Type.Object({
  orderStatus: Type.Optional(Type.Integer()),
  payStatus: Type.Optional(Type.Integer()),
  expressCompany: Type.Optional(Type.String({ maxLength: 50 })),
  expressNo: Type.Optional(Type.String({ maxLength: 50 })),
  cancelReason: Type.Optional(Type.String({ maxLength: 255 })),
  remark: Type.Optional(Type.String({ maxLength: 500 })),
  status: Type.Optional(Type.Integer()),
})
