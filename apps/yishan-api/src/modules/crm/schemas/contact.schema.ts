import { Type, type Static } from '@sinclair/typebox'
import { PaginationQuerySchema } from './common.schema.js'

/**
 * 联系人的 HTTP schema。
 */

export const ContactRespSchema = Type.Object({
  id: Type.Number(),
  customerId: Type.Number(),
  name: Type.String(),
  gender: Type.Number(),
  mobile: Type.Union([Type.String(), Type.Null()]),
  phone: Type.Union([Type.String(), Type.Null()]),
  email: Type.Union([Type.String(), Type.Null()]),
  department: Type.Union([Type.String(), Type.Null()]),
  position: Type.Union([Type.String(), Type.Null()]),
  isPrimary: Type.Number(),
  birthday: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  remark: Type.Union([Type.String(), Type.Null()]),
  creatorId: Type.Union([Type.Number(), Type.Null()]),
  createdAt: Type.String({ format: 'date-time' }),
  updaterId: Type.Union([Type.Number(), Type.Null()]),
  updatedAt: Type.String({ format: 'date-time' }),
})
export type ContactResp = Static<typeof ContactRespSchema>

export const ContactListRespSchema = Type.Object({
  total: Type.Number(),
  page: Type.Number(),
  pageSize: Type.Number(),
  items: Type.Array(ContactRespSchema),
})

export const ContactListQuerySchema = Type.Composite([
  PaginationQuerySchema,
  Type.Object({
    customerId: Type.Optional(Type.Integer()),
    isPrimary: Type.Optional(Type.Integer()),
  }),
])
export type ContactListQuery = Static<typeof ContactListQuerySchema>

export const ContactCreateReqSchema = Type.Object({
  customerId: Type.Integer({ minimum: 1 }),
  name: Type.String({ minLength: 1, maxLength: 100 }),
  gender: Type.Optional(Type.Integer({ minimum: 0, maximum: 2 })),
  mobile: Type.Optional(Type.String({ maxLength: 32 })),
  phone: Type.Optional(Type.String({ maxLength: 32 })),
  email: Type.Optional(Type.String({ format: 'email', maxLength: 100 })),
  department: Type.Optional(Type.String({ maxLength: 100 })),
  position: Type.Optional(Type.String({ maxLength: 100 })),
  isPrimary: Type.Optional(Type.Integer({ minimum: 0, maximum: 1 })),
  birthday: Type.Optional(Type.String({ format: 'date-time' })),
  remark: Type.Optional(Type.String({ maxLength: 1000 })),
})
export type ContactCreateReq = Static<typeof ContactCreateReqSchema>

export const ContactUpdateReqSchema = Type.Partial(
  Type.Object({
    name: Type.String({ minLength: 1, maxLength: 100 }),
    gender: Type.Integer({ minimum: 0, maximum: 2 }),
    mobile: Type.Union([Type.String({ maxLength: 32 }), Type.Null()]),
    phone: Type.Union([Type.String({ maxLength: 32 }), Type.Null()]),
    email: Type.Union([Type.String({ format: 'email', maxLength: 100 }), Type.Null()]),
    department: Type.Union([Type.String({ maxLength: 100 }), Type.Null()]),
    position: Type.Union([Type.String({ maxLength: 100 }), Type.Null()]),
    isPrimary: Type.Integer({ minimum: 0, maximum: 1 }),
    birthday: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
    remark: Type.Union([Type.String({ maxLength: 1000 }), Type.Null()]),
  }),
)
export type ContactUpdateReq = Static<typeof ContactUpdateReqSchema>
