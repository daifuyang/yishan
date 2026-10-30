import { Type } from '@sinclair/typebox'
import { passwordTypeBoxProps } from '@/modules/iximei_crm/utils/password-policy'
import { CrmPageQuerySchema } from './shared.schema.js'

export const CrmHospitalListQuerySchema = Type.Intersect([
  CrmPageQuerySchema,
  Type.Object({
    status: Type.Optional(Type.Integer({ minimum: 0, maximum: 1 })),
    category: Type.Optional(Type.Union([
      Type.Literal('oral'),
      Type.Literal('plastic'),
      Type.Literal('unknown'),
    ])),
  }),
], { $id: 'crmHospitalListQuery' })

/**
 * 医院搜索下拉查询 schema。
 */
export const CrmHospitalSearchQuerySchema = Type.Object(
  {
    keyword: Type.Optional(Type.String({ maxLength: 100 })),
    provinceId: Type.Optional(Type.Integer({ minimum: 1 })),
    cityId: Type.Optional(Type.Integer({ minimum: 1 })),
    districtId: Type.Optional(Type.Integer({ minimum: 1 })),
  },
  { $id: 'crmHospitalSearchQuery' },
)

/**
 * 医院档案基础字段（不含账号字段、不含 hospitalName）。
 * CrmHospitalReqSchema（create）在其之外单独补充 hospitalName，避免改名字段被
 * CrmHospitalUpdateReqSchema（由本 schema 推导）意外暴露。
 *
 * 改名走独立 POST /hospitals/:id/rename 接口，由 crm:hospitals:rename 权限保护。
 */
const CrmHospitalFieldsSchema = Type.Object(
  {
    provinceId: Type.Optional(Type.Integer()),
    cityId: Type.Optional(Type.Integer()),
    districtId: Type.Optional(Type.Integer()),
    hospitalAddress: Type.Optional(Type.String({ maxLength: 255 })),
    hospitalPhone: Type.Optional(Type.String({ maxLength: 50 })),
    hospitalSelling: Type.Optional(Type.String({ maxLength: 255 })),
    hospitalWebsite: Type.Optional(Type.String({ maxLength: 255 })),
    hospitalNature: Type.Optional(Type.Integer()),
    // 医院分类：'oral' 口腔 / 'plastic' 整形。
    // 'unknown' 是 dashboard 派生值（NULL 或其它值归入），不允许显式写入。
    category: Type.Optional(Type.Union([
      Type.Literal('oral'),
      Type.Literal('plastic'),
    ])),
    doctorName: Type.Optional(Type.String({ maxLength: 50 })),
    doctorPhone: Type.Optional(Type.String({ maxLength: 50 })),
    doctorQq: Type.Optional(Type.String({ maxLength: 50 })),
    receptionName: Type.Optional(Type.String({ maxLength: 50 })),
    receptionPhone: Type.Optional(Type.String({ maxLength: 50 })),
    receptionQq: Type.Optional(Type.String({ maxLength: 50 })),
    busStation: Type.Optional(Type.String({ maxLength: 100 })),
    busAddress: Type.Optional(Type.String({ maxLength: 255 })),
    subwayStation: Type.Optional(Type.String({ maxLength: 100 })),
    subwayAddress: Type.Optional(Type.String({ maxLength: 255 })),
    taxiFare: Type.Optional(Type.String({ maxLength: 50 })),
    vipDiscount: Type.Optional(Type.String({ maxLength: 255 })),
    returnPoint: Type.Optional(Type.String({ maxLength: 50 })),
    hospitalIntroduction: Type.Optional(Type.String({ maxLength: 5000 })),
    contractPhotos: Type.Optional(Type.Array(Type.String({ maxLength: 500 }))),
    wechatOpenid: Type.Optional(Type.String({ maxLength: 64 })),
    status: Type.Optional(Type.Integer({ minimum: 0, maximum: 1 })),
  },
  { $id: 'crmHospitalFields' },
)

/**
 * 创建医院：医院档案 + 唯一账号字段。
 * 服务端忽略任何由客户端传来的 username / accountUserId；用户名固定取 hospitalName。
 *
 * hospitalName 在 CrmHospitalFieldsSchema 之外单独声明，是为了避免 UPDATE schema
 * （CrmHospitalUpdateReqSchema 由 CrmHospitalFieldsSchema 推导）意外暴露改名字段。
 * 改名走独立 POST /hospitals/:id/rename 接口。
 */
export const CrmHospitalReqSchema = Type.Object(
  {
    ...CrmHospitalFieldsSchema.properties,
    hospitalName: Type.String({ minLength: 1, maxLength: 50 }),
    accountPassword: Type.String({ description: '医院账号密码', ...passwordTypeBoxProps }),
    accountEmail: Type.Optional(Type.String({ format: 'email', maxLength: 100 })),
    accountPhone: Type.Optional(Type.String({ maxLength: 20 })),
  },
  { $id: 'crmHospitalReq' },
)

/**
 * 更新医院：仅档案字段（保留 schema 兼容性；实际不允许通过本接口改名）。
 * 账号联系方式、状态、密码由 /hospitals/:id/account 单独维护。
 * 医院改名走独立 POST /hospitals/:id/rename（要求 crm:hospitals:rename 权限）。
 */
export const CrmHospitalUpdateReqSchema = Type.Partial(CrmHospitalFieldsSchema, {
  $id: 'crmHospitalUpdateReq',
  minProperties: 1,
})

/**
 * POST /hospitals/:id/rename 请求：仅接收新的医院名称。
 * 仅系统管理员（持有 crm:hospitals:rename 权限）可调用。
 */
export const CrmHospitalRenameReqSchema = Type.Object(
  {
    newHospitalName: Type.String({ minLength: 1, maxLength: 50 }),
  },
  { $id: 'crmHospitalRenameReq' },
)

/**
 * GET /hospitals/:id/account 响应：唯一账号只读信息。
 */
export const CrmHospitalAccountRespSchema = Type.Object(
  {
    userId: Type.Integer(),
    username: Type.String(),
    email: Type.Union([Type.String(), Type.Null()]),
    phone: Type.Union([Type.String(), Type.Null()]),
    status: Type.Integer({ minimum: 0, maximum: 1 }),
    lastLoginTime: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  },
  { $id: 'crmHospitalAccountResp' },
)

/**
 * PATCH /hospitals/:id/account 请求：仅联系方式与启停状态，不修改用户名。
 */
export const CrmHospitalAccountUpdateReqSchema = Type.Object(
  {
    email: Type.Optional(Type.Union([Type.String({ format: 'email', maxLength: 100 }), Type.Null()])),
    phone: Type.Optional(Type.Union([Type.String({ maxLength: 20 }), Type.Null()])),
    status: Type.Optional(Type.Integer({ minimum: 0, maximum: 1 })),
  },
  { $id: 'crmHospitalAccountUpdateReq', minProperties: 1 },
)

/**
 * POST /hospitals/:id/account/reset-password 请求：仅接收新密码。
 */
export const CrmHospitalAccountResetPasswordReqSchema = Type.Object(
  {
    newPassword: Type.String({ description: '医院账号新密码', ...passwordTypeBoxProps }),
  },
  { $id: 'crmHospitalAccountResetPasswordReq' },
)

export type CrmHospitalReq = import('@sinclair/typebox').Static<typeof CrmHospitalReqSchema>
export type CrmHospitalUpdateReq = import('@sinclair/typebox').Static<typeof CrmHospitalUpdateReqSchema>
export type CrmHospitalSearchQuery = import('@sinclair/typebox').Static<typeof CrmHospitalSearchQuerySchema>
export type CrmHospitalListQuery = import('@sinclair/typebox').Static<typeof CrmHospitalListQuerySchema>
export type CrmHospitalAccountResp = import('@sinclair/typebox').Static<typeof CrmHospitalAccountRespSchema>
export type CrmHospitalAccountUpdateReq = import('@sinclair/typebox').Static<typeof CrmHospitalAccountUpdateReqSchema>
export type CrmHospitalAccountResetPasswordReq = import('@sinclair/typebox').Static<typeof CrmHospitalAccountResetPasswordReqSchema>
