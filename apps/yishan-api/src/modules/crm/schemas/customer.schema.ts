import { Type, type Static } from '@sinclair/typebox'
import { PaginationQuerySchema } from './common.schema.js'

/**
 * 客户的 HTTP schema。
 */

export const CUSTOMER_TYPE = ['enterprise', 'individual'] as const
export const POOL_STATUS = ['owned', 'public'] as const

export const CustomerRespSchema = Type.Object({
  id: Type.Number(),
  code: Type.Union([Type.String(), Type.Null()]),
  name: Type.String(),
  type: Type.String(),
  statusId: Type.Union([Type.Number(), Type.Null()]),
  sourceId: Type.Union([Type.Number(), Type.Null()]),
  level: Type.Union([Type.String(), Type.Null()]),
  industry: Type.Union([Type.String(), Type.Null()]),
  phone: Type.Union([Type.String(), Type.Null()]),
  website: Type.Union([Type.String(), Type.Null()]),
  province: Type.Union([Type.String(), Type.Null()]),
  city: Type.Union([Type.String(), Type.Null()]),
  address: Type.Union([Type.String(), Type.Null()]),
  ownerUserId: Type.Union([Type.Number(), Type.Null()]),
  ownerDepartmentId: Type.Union([Type.Number(), Type.Null()]),
  poolStatus: Type.String(),
  lastFollowUpAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  nextFollowUpAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  remark: Type.Union([Type.String(), Type.Null()]),
  creatorId: Type.Union([Type.Number(), Type.Null()]),
  createdAt: Type.String({ format: 'date-time' }),
  updaterId: Type.Union([Type.Number(), Type.Null()]),
  updatedAt: Type.String({ format: 'date-time' }),
})
export type CustomerResp = Static<typeof CustomerRespSchema>

export const CustomerDetailRespSchema = Type.Object({
  ...CustomerRespSchema.properties,
  tagIds: Type.Array(Type.Number()),
  ownerUserName: Type.Union([Type.String(), Type.Null()]),
  statusName: Type.Union([Type.String(), Type.Null()]),
  sourceName: Type.Union([Type.String(), Type.Null()]),
  primaryContactId: Type.Union([Type.Number(), Type.Null()]),
  primaryContactName: Type.Union([Type.String(), Type.Null()]),
})
export type CustomerDetailResp = Static<typeof CustomerDetailRespSchema>

export const CustomerListRespSchema = Type.Object({
  total: Type.Number(),
  page: Type.Number(),
  pageSize: Type.Number(),
  items: Type.Array(CustomerRespSchema),
})

export const CustomerListQuerySchema = Type.Composite([
  PaginationQuerySchema,
  Type.Object({
    statusId: Type.Optional(Type.Integer()),
    sourceId: Type.Optional(Type.Integer()),
    level: Type.Optional(Type.String({ maxLength: 16 })),
    type: Type.Optional(Type.String({ maxLength: 16 })),
    ownerUserId: Type.Optional(Type.Integer()),
    poolStatus: Type.Optional(Type.String({ maxLength: 16 })),
  }),
])
export type CustomerListQuery = Static<typeof CustomerListQuerySchema>

export const CustomerCreateReqSchema = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 200 }),
  type: Type.Optional(Type.String({ enum: [...CUSTOMER_TYPE] })),
  statusId: Type.Optional(Type.Union([Type.Integer(), Type.Null()])),
  sourceId: Type.Optional(Type.Union([Type.Integer(), Type.Null()])),
  level: Type.Optional(Type.String({ maxLength: 16 })),
  industry: Type.Optional(Type.String({ maxLength: 64 })),
  phone: Type.Optional(Type.String({ maxLength: 32 })),
  website: Type.Optional(Type.String({ maxLength: 200 })),
  province: Type.Optional(Type.String({ maxLength: 64 })),
  city: Type.Optional(Type.String({ maxLength: 64 })),
  address: Type.Optional(Type.String({ maxLength: 255 })),
  ownerUserId: Type.Optional(Type.Union([Type.Integer(), Type.Null()])),
  ownerDepartmentId: Type.Optional(Type.Union([Type.Integer(), Type.Null()])),
  tagIds: Type.Optional(Type.Array(Type.Integer())),
  remark: Type.Optional(Type.String({ maxLength: 2000 })),
})
export type CustomerCreateReq = Static<typeof CustomerCreateReqSchema>

export const CustomerUpdateReqSchema = Type.Partial(
  Type.Object({
    name: Type.String({ minLength: 1, maxLength: 200 }),
    type: Type.String({ enum: [...CUSTOMER_TYPE] }),
    statusId: Type.Union([Type.Integer(), Type.Null()]),
    sourceId: Type.Union([Type.Integer(), Type.Null()]),
    level: Type.String({ maxLength: 16 }),
    industry: Type.String({ maxLength: 64 }),
    phone: Type.String({ maxLength: 32 }),
    website: Type.String({ maxLength: 200 }),
    province: Type.String({ maxLength: 64 }),
    city: Type.String({ maxLength: 64 }),
    address: Type.String({ maxLength: 255 }),
    ownerUserId: Type.Union([Type.Integer(), Type.Null()]),
    ownerDepartmentId: Type.Union([Type.Integer(), Type.Null()]),
    tagIds: Type.Array(Type.Integer()),
    remark: Type.String({ maxLength: 2000 }),
  }),
)
export type CustomerUpdateReq = Static<typeof CustomerUpdateReqSchema>

export const CustomerReleaseReqSchema = Type.Object({
  reason: Type.Optional(Type.String({ maxLength: 500 })),
})
export type CustomerReleaseReq = Static<typeof CustomerReleaseReqSchema>

export const CustomerTransferReqSchema = Type.Object({
  targetUserId: Type.Integer({ minimum: 1 }),
  reason: Type.Optional(Type.String({ maxLength: 500 })),
})
export type CustomerTransferReq = Static<typeof CustomerTransferReqSchema>

export const DuplicateCustomerHintSchema = Type.Object({
  existingCustomerId: Type.Number(),
  existingCustomerName: Type.String(),
  ownerUserId: Type.Union([Type.Number(), Type.Null()]),
  ownerUserName: Type.Union([Type.String(), Type.Null()]),
})
export type DuplicateCustomerHint = Static<typeof DuplicateCustomerHintSchema>

export const CustomerCreateRespSchema = Type.Object({
  customer: CustomerRespSchema,
  duplicate: Type.Union([DuplicateCustomerHintSchema, Type.Null()]),
})
export type CustomerCreateResp = Static<typeof CustomerCreateRespSchema>
