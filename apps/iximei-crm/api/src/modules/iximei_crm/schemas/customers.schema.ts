import { Type } from '@sinclair/typebox'
import { CrmPageQuerySchema } from './shared.schema.js'
export const CrmCustomerListQuerySchema = Type.Intersect([CrmPageQuerySchema, Type.Object({ statusId: Type.Optional(Type.Integer({ minimum: 1 })), ownerUserId: Type.Optional(Type.Integer({ minimum: 1 })) })], { $id: 'crmCustomerListQuery' })
// PATCH 语义：null = 显式清空字段，undefined = 不修改。前端表单总是把所有字段都发出来，
// 未填的字段是 null；后端必须接受 null 字符串字段，否则空 QQ/微信/手机无法保存。
const optStr = (cfg: Parameters<typeof Type.String>[0] = {}) => Type.Optional(Type.Union([Type.Null(), Type.String(cfg)]))

export const CrmCustomerReqSchema = Type.Object({
  // 客户编号：业务约定为"创建由系统生成，保存后不可修改"——不入参。
  // 前端表单字段已 disabled，后端 service 也忽略任何客户端误传。
  name: Type.String({ minLength: 1, maxLength: 50 }),
  gender: Type.Optional(Type.Integer({ minimum: 0, maximum: 2 })),
  birthday: Type.Optional(Type.Union([Type.Null(), Type.String({ format: 'date' })])),
  telphone: optStr({ maxLength: 20 }),
  mobile: optStr({ maxLength: 20, pattern: '^1[3-9]\\d{9}$' }),
  qq: optStr({ maxLength: 20, pattern: '^[1-9]\\d{4,14}$' }),
  wechat: optStr({ maxLength: 50, pattern: '^[a-zA-Z][a-zA-Z0-9_-]{5,49}$' }),
  provinceId: Type.Optional(Type.Union([Type.Null(), Type.Integer()])),
  cityId: Type.Optional(Type.Union([Type.Null(), Type.Integer()])),
  districtId: Type.Optional(Type.Union([Type.Null(), Type.Integer()])),
  address: optStr({ maxLength: 255 }),
  plastic: optStr({ maxLength: 255 }),
  statusId: Type.Optional(Type.Integer({ minimum: 1 })),
  remark: optStr({ maxLength: 5000 }),
  ownerUserId: Type.Optional(Type.Integer({ minimum: 1 })),
}, { $id: 'crmCustomerReq' })
export const CrmCustomerUpdateReqSchema = Type.Partial(CrmCustomerReqSchema, { $id: 'crmCustomerUpdateReq', minProperties: 1 })
export const CrmCustomerDispatchReqSchema = Type.Object({ hospitalIds: Type.Array(Type.Integer({ minimum: 1 }), { minItems: 1, maxItems: 50 }), reply: Type.Optional(Type.String({ maxLength: 2000 })), statusId: Type.Optional(Type.Integer({ minimum: 1 })) }, { $id: 'crmCustomerDispatchReq' })
export const CrmCustomerRemarkReqSchema = Type.Object({ content: Type.String({ minLength: 1, maxLength: 2000 }) }, { $id: 'crmCustomerRemarkReq' })
export type CrmCustomerReq = import('@sinclair/typebox').Static<typeof CrmCustomerReqSchema>
export type CrmCustomerUpdateReq = import('@sinclair/typebox').Static<typeof CrmCustomerUpdateReqSchema>
export type CrmCustomerListQuery = import('@sinclair/typebox').Static<typeof CrmCustomerListQuerySchema>
export type CrmCustomerDispatchReq = import('@sinclair/typebox').Static<typeof CrmCustomerDispatchReqSchema>
export type CrmCustomerRemarkReq = import('@sinclair/typebox').Static<typeof CrmCustomerRemarkReqSchema>
