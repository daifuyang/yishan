import { Type } from '@sinclair/typebox'
import { PaginationQuerySchema } from './common.schema.js'

export const AttributeRespSchema = Type.Object({
  id: Type.Number(),
  name: Type.String(),
  type: Type.Number(),
  sortOrder: Type.Number(),
  status: Type.Number(),
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
})

export const AttributeListRespSchema = Type.Object({
  total: Type.Number(),
  page: Type.Number(),
  pageSize: Type.Number(),
  items: Type.Array(AttributeRespSchema),
})

export const AttributeListQuerySchema = Type.Composite([
  PaginationQuerySchema,
  Type.Object({
    type: Type.Optional(Type.Integer({ minimum: 1 })),
    status: Type.Optional(Type.Integer({ minimum: 0, maximum: 1 })),
  }),
])

export const AttributeCreateReqSchema = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 50 }),
  type: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
  sortOrder: Type.Optional(Type.Integer()),
  status: Type.Optional(Type.Integer({ minimum: 0, maximum: 1 })),
})
export const AttributeUpdateReqSchema = Type.Partial(AttributeCreateReqSchema)

export const AttributeValueRespSchema = Type.Object({
  id: Type.Number(),
  attributeId: Type.Number(),
  value: Type.String(),
  image: Type.Union([Type.String(), Type.Null()]),
  sortOrder: Type.Number(),
  status: Type.Number(),
})

export const AttributeValueCreateReqSchema = Type.Object({
  value: Type.String({ minLength: 1, maxLength: 100 }),
  image: Type.Optional(Type.String({ maxLength: 500 })),
  sortOrder: Type.Optional(Type.Integer()),
  status: Type.Optional(Type.Integer({ minimum: 0, maximum: 1 })),
})
