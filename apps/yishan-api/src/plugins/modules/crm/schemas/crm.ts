import { Type, type Static } from '@sinclair/typebox'
import type { FastifyInstance } from 'fastify'

export const CrmIdParams = Type.Object({
  id: Type.Integer({ minimum: 1 }),
}, { $id: 'crmIdParams' })

export const CrmHospitalAccountParams = Type.Object({
  id: Type.Integer({ minimum: 1 }),
  userId: Type.Integer({ minimum: 1 }),
}, { $id: 'crmHospitalAccountParams' })

export const CrmPageQuery = Type.Object({
  page: Type.Optional(Type.Integer({ default: 1, minimum: 1 })),
  pageSize: Type.Optional(Type.Integer({ default: 10, minimum: 0, maximum: 100 })),
  keyword: Type.Optional(Type.String({ maxLength: 100 })),
  startTime: Type.Optional(Type.String({ format: 'date-time' })),
  endTime: Type.Optional(Type.String({ format: 'date-time' })),
}, { $id: 'crmPageQuery' })

export const CrmCustomerListQuery = Type.Intersect([
  CrmPageQuery,
  Type.Object({ statusId: Type.Optional(Type.Integer({ minimum: 1 })) }),
], { $id: 'crmCustomerListQuery' })

export const CrmHospitalSearchQuery = Type.Object({
  keyword: Type.Optional(Type.String({ maxLength: 100 })),
  provinceId: Type.Optional(Type.Integer({ minimum: 1 })),
  cityId: Type.Optional(Type.Integer({ minimum: 1 })),
  districtId: Type.Optional(Type.Integer({ minimum: 1 })),
}, { $id: 'crmHospitalSearchQuery' })

export const CrmHospitalReq = Type.Object({
  accountUserId: Type.Optional(Type.Union([Type.Integer({ minimum: 1 }), Type.Null()])),
  hospitalName: Type.String({ minLength: 1, maxLength: 100 }),
  provinceId: Type.Optional(Type.Integer({ minimum: 1 })), cityId: Type.Optional(Type.Integer({ minimum: 1 })), districtId: Type.Optional(Type.Integer({ minimum: 1 })),
  hospitalAddress: Type.Optional(Type.String({ maxLength: 255 })), hospitalPhone: Type.Optional(Type.String({ maxLength: 20 })),
  hospitalSelling: Type.Optional(Type.String({ maxLength: 255 })), hospitalWebsite: Type.Optional(Type.String({ maxLength: 255 })),
  hospitalNature: Type.Optional(Type.Integer()), doctorName: Type.Optional(Type.String({ maxLength: 50 })), doctorPhone: Type.Optional(Type.String({ maxLength: 20 })), doctorQq: Type.Optional(Type.String({ maxLength: 50 })),
  receptionName: Type.Optional(Type.String({ maxLength: 50 })), receptionPhone: Type.Optional(Type.String({ maxLength: 20 })), receptionQq: Type.Optional(Type.String({ maxLength: 50 })),
  busStation: Type.Optional(Type.String({ maxLength: 100 })), busAddress: Type.Optional(Type.String({ maxLength: 255 })), subwayStation: Type.Optional(Type.String({ maxLength: 100 })), subwayAddress: Type.Optional(Type.String({ maxLength: 255 })), taxiFare: Type.Optional(Type.String({ maxLength: 50 })),
  vipDiscount: Type.Optional(Type.String({ maxLength: 50 })), returnPoint: Type.Optional(Type.String({ maxLength: 50 })), hospitalIntroduction: Type.Optional(Type.String({ maxLength: 5000 })),
  contractPhotos: Type.Optional(Type.Array(Type.String({ maxLength: 500 }))), wechatOpenid: Type.Optional(Type.String({ maxLength: 100 })), status: Type.Optional(Type.Integer({ minimum: 0, maximum: 1 })),
}, { $id: 'crmHospitalReq' })
export const CrmHospitalUpdateReq = Type.Partial(CrmHospitalReq, { $id: 'crmHospitalUpdateReq', minProperties: 1 })

export const CrmCustomerReq = Type.Object({
  numberId: Type.Optional(Type.String({ maxLength: 20 })), name: Type.String({ minLength: 1, maxLength: 50 }), gender: Type.Optional(Type.Integer({ minimum: 0, maximum: 2 })), birthday: Type.Optional(Type.String({ format: 'date' })),
  telphone: Type.Optional(Type.String({ maxLength: 20 })), mobile: Type.Optional(Type.String({ maxLength: 20 })), qq: Type.Optional(Type.String({ maxLength: 50 })), wechat: Type.Optional(Type.String({ maxLength: 100 })),
  provinceId: Type.Optional(Type.Integer({ minimum: 1 })), cityId: Type.Optional(Type.Integer({ minimum: 1 })), districtId: Type.Optional(Type.Integer({ minimum: 1 })), address: Type.Optional(Type.String({ maxLength: 255 })), plastic: Type.Optional(Type.String({ maxLength: 255 })), statusId: Type.Optional(Type.Integer({ minimum: 1 })), remark: Type.Optional(Type.String({ maxLength: 1000 })), ownerUserId: Type.Optional(Type.Integer({ minimum: 1 })),
}, { $id: 'crmCustomerReq' })
export const CrmCustomerUpdateReq = Type.Partial(CrmCustomerReq, { $id: 'crmCustomerUpdateReq', minProperties: 1 })

export const CrmMemberReq = Type.Object({
  numberId: Type.Optional(Type.String({ maxLength: 20 })), name: Type.String({ minLength: 1, maxLength: 50 }), gender: Type.Optional(Type.Integer({ minimum: 0, maximum: 2 })), birthday: Type.Optional(Type.String({ format: 'date' })), address: Type.Optional(Type.String({ maxLength: 255 })), mobile: Type.Optional(Type.String({ maxLength: 20 })), project: Type.Optional(Type.String({ maxLength: 255 })), ownerUserId: Type.Optional(Type.Integer({ minimum: 1 })),
}, { $id: 'crmMemberReq' })
export const CrmMemberUpdateReq = Type.Partial(CrmMemberReq, { $id: 'crmMemberUpdateReq', minProperties: 1 })

export const CrmDispatchReq = Type.Object({ hospitalId: Type.Optional(Type.Integer({ minimum: 1 })), statusId: Type.Optional(Type.Integer({ minimum: 1 })), image: Type.Optional(Type.String({ maxLength: 500 })), receiveQq: Type.Optional(Type.String({ maxLength: 50 })), receiveWechat: Type.Optional(Type.String({ maxLength: 100 })), finishedAt: Type.Optional(Type.String({ format: 'date-time' })) }, { $id: 'crmDispatchReq', minProperties: 1 })
export const CrmDispatchCreateReq = Type.Object({ hospitalIds: Type.Array(Type.Integer({ minimum: 1 }), { minItems: 1, maxItems: 50 }), reply: Type.Optional(Type.String({ maxLength: 2000 })), statusId: Type.Optional(Type.Integer({ minimum: 1 })) }, { $id: 'crmDispatchCreateReq' })
export const CrmDispatchReplyReq = Type.Object({ content: Type.Optional(Type.String({ maxLength: 2000 })), receiveQq: Type.Optional(Type.String({ maxLength: 50 })), receiveWechat: Type.Optional(Type.String({ maxLength: 100 })), image: Type.Optional(Type.String({ maxLength: 500 })), statusId: Type.Optional(Type.Integer({ minimum: 1 })) }, { $id: 'crmDispatchReplyReq' })
export const CrmContentReq = Type.Object({ content: Type.String({ minLength: 1, maxLength: 2000 }) }, { $id: 'crmContentReq' })

export const CrmHospitalAccountCreateReq = Type.Object({ username: Type.String({ minLength: 1, maxLength: 50 }), phone: Type.String({ minLength: 1, maxLength: 20 }), realName: Type.Optional(Type.String({ maxLength: 50 })), email: Type.Optional(Type.String({ format: 'email', maxLength: 100 })), password: Type.String({ minLength: 8, maxLength: 128 }), role: Type.Optional(Type.String({ default: 'member', maxLength: 20 })), remark: Type.Optional(Type.String({ maxLength: 255 })) }, { $id: 'crmHospitalAccountCreateReq' })
export const CrmHospitalAccountAssignReq = Type.Object({ userId: Type.Integer({ minimum: 1 }), role: Type.Optional(Type.String({ default: 'member', maxLength: 20 })), remark: Type.Optional(Type.String({ maxLength: 255 })) }, { $id: 'crmHospitalAccountAssignReq' })
export const CrmHospitalAccountUpdateReq = Type.Object({ role: Type.Optional(Type.String({ maxLength: 20 })), status: Type.Optional(Type.Integer({ minimum: 0, maximum: 1 })), remark: Type.Optional(Type.String({ maxLength: 255 })), username: Type.Optional(Type.String({ minLength: 1, maxLength: 50 })), realName: Type.Optional(Type.String({ maxLength: 50 })), phone: Type.Optional(Type.String({ minLength: 1, maxLength: 20 })), email: Type.Optional(Type.String({ format: 'email', maxLength: 100 })), password: Type.Optional(Type.String({ minLength: 8, maxLength: 128 })) }, { $id: 'crmHospitalAccountUpdateReq', minProperties: 1 })

export type CrmPageQueryDto = Static<typeof CrmPageQuery>
export type CrmCustomerListQueryDto = Static<typeof CrmCustomerListQuery>
export type CrmHospitalSearchQueryDto = Static<typeof CrmHospitalSearchQuery>
export type CrmHospitalDto = Static<typeof CrmHospitalReq>
export type CrmCustomerDto = Static<typeof CrmCustomerReq>
export type CrmMemberDto = Static<typeof CrmMemberReq>
export type CrmDispatchDto = Static<typeof CrmDispatchReq>
export type CrmDispatchCreateDto = Static<typeof CrmDispatchCreateReq>
export type CrmDispatchReplyDto = Static<typeof CrmDispatchReplyReq>
export type CrmContentDto = Static<typeof CrmContentReq>
export type CrmHospitalAccountCreateDto = Static<typeof CrmHospitalAccountCreateReq>
export type CrmHospitalAccountAssignDto = Static<typeof CrmHospitalAccountAssignReq>
export type CrmHospitalAccountUpdateDto = Static<typeof CrmHospitalAccountUpdateReq>

export default function registerCrmSchemas(fastify: FastifyInstance) {
  [CrmIdParams, CrmHospitalAccountParams, CrmPageQuery, CrmCustomerListQuery, CrmHospitalSearchQuery, CrmHospitalReq, CrmHospitalUpdateReq, CrmCustomerReq, CrmCustomerUpdateReq, CrmMemberReq, CrmMemberUpdateReq, CrmDispatchReq, CrmDispatchCreateReq, CrmDispatchReplyReq, CrmContentReq, CrmHospitalAccountCreateReq, CrmHospitalAccountAssignReq, CrmHospitalAccountUpdateReq].forEach((schema) => fastify.addSchema(schema))
}
