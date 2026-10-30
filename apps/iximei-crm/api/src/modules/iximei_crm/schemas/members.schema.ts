import { Type } from '@sinclair/typebox'
import { CrmPageQuerySchema } from './shared.schema.js'

// ──────────────────────────────────────────────
// 会员顾客查询
// ──────────────────────────────────────────────

export const CrmMemberListQuerySchema = Type.Intersect([
  CrmPageQuerySchema,
  Type.Object({
    stage: Type.Optional(Type.String({ maxLength: 30 })),
    businessCategory: Type.Optional(Type.String({ maxLength: 50 })),
    intentionLevel: Type.Optional(Type.String({ maxLength: 20 })),
    ownerUserId: Type.Optional(Type.Integer({ minimum: 1 })),
    sourceChannel: Type.Optional(Type.String({ maxLength: 20 })),
    memberStatus: Type.Optional(Type.String({ maxLength: 20 })),
    nextFollowUpStart: Type.Optional(Type.String({ format: 'date-time' })),
    nextFollowUpEnd: Type.Optional(Type.String({ format: 'date-time' })),
    createdStart: Type.Optional(Type.String({ format: 'date-time' })),
    createdEnd: Type.Optional(Type.String({ format: 'date-time' })),
    isOverdue: Type.Optional(Type.Integer({ minimum: 0, maximum: 1 })),
    tagIds: Type.Optional(Type.Array(Type.Integer({ minimum: 1 }))),
  }),
], { $id: 'crmMemberListQuery' })

// ──────────────────────────────────────────────
// 从客户转会员
// ──────────────────────────────────────────────

export const CrmMemberFromCustomerReqSchema = Type.Object({
  customerId: Type.Integer({ minimum: 1 }),
  businessCategory: Type.Optional(Type.String({ maxLength: 50 })),
  intentionProject: Type.Optional(Type.String({ maxLength: 255 })),
  memberStage: Type.Optional(Type.String({ maxLength: 30 })),
  intentionLevel: Type.Optional(Type.String({ maxLength: 20 })),
  budgetRange: Type.Optional(Type.String({ maxLength: 50 })),
  expectedDate: Type.Optional(Type.String({ format: 'date' })),
  preferredHospitalId: Type.Optional(Type.Integer({ minimum: 1 })),
  ownerUserId: Type.Optional(Type.Integer({ minimum: 1 })),
  // 顾客标签：纯文本输入；多个标签用 , / ， / 、 / 换行 分隔；空字符串视为空
  tagsText: Type.Optional(Type.String({ maxLength: 2000 })),
  // 兼容旧调用方：仍可显式传 tag IDs 或 name 数组
  tagIds: Type.Optional(Type.Array(Type.Integer({ minimum: 1 }))),
  tagNames: Type.Optional(Type.Array(Type.String({ minLength: 1, maxLength: 50 }))),
  firstContactRecord: Type.Optional(Type.String({ maxLength: 2000 })),
  nextFollowUpAt: Type.Optional(Type.String({ format: 'date-time' })),
  remark: Type.Optional(Type.String({ maxLength: 2000 })),
}, { $id: 'crmMemberFromCustomerReq' })

// ──────────────────────────────────────────────
// 直接新增会员
// ──────────────────────────────────────────────

export const CrmMemberDirectReqSchema = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 50 }),
  mobile: Type.Optional(Type.String({ maxLength: 20 })),
  wechat: Type.Optional(Type.String({ maxLength: 50 })),
  qq: Type.Optional(Type.String({ maxLength: 20 })),
  gender: Type.Optional(Type.Integer({ minimum: 0, maximum: 2 })),
  birthday: Type.Optional(Type.String({ format: 'date' })),
  provinceId: Type.Optional(Type.Integer()),
  cityId: Type.Optional(Type.Integer()),
  districtId: Type.Optional(Type.Integer()),
  address: Type.Optional(Type.String({ maxLength: 255 })),
  sourceChannel: Type.Optional(Type.String({ maxLength: 20 })),
  // 会员信息
  businessCategory: Type.Optional(Type.String({ maxLength: 50 })),
  intentionProject: Type.Optional(Type.String({ maxLength: 255 })),
  memberStage: Type.Optional(Type.String({ maxLength: 30 })),
  intentionLevel: Type.Optional(Type.String({ maxLength: 20 })),
  budgetRange: Type.Optional(Type.String({ maxLength: 50 })),
  expectedDate: Type.Optional(Type.String({ format: 'date' })),
  preferredHospitalId: Type.Optional(Type.Integer({ minimum: 1 })),
  ownerUserId: Type.Optional(Type.Integer({ minimum: 1 })),
  // 顾客标签：纯文本输入；多个标签用 , / ， / 、 / 换行 分隔
  tagsText: Type.Optional(Type.String({ maxLength: 2000 })),
  // 兼容旧调用方
  tagIds: Type.Optional(Type.Array(Type.Integer({ minimum: 1 }))),
  tagNames: Type.Optional(Type.Array(Type.String({ minLength: 1, maxLength: 50 }))),
  firstContactRecord: Type.Optional(Type.String({ maxLength: 2000 })),
  nextFollowUpAt: Type.Optional(Type.String({ format: 'date-time' })),
  remark: Type.Optional(Type.String({ maxLength: 2000 })),
}, { $id: 'crmMemberDirectReq' })

// ──────────────────────────────────────────────
// 更新会员
// ──────────────────────────────────────────────

export const CrmMemberUpdateReqSchema = Type.Object({
  name: Type.Optional(Type.String({ minLength: 1, maxLength: 50 })),
  mobile: Type.Optional(Type.String({ maxLength: 20 })),
  wechat: Type.Optional(Type.String({ maxLength: 50 })),
  qq: Type.Optional(Type.String({ maxLength: 20 })),
  gender: Type.Optional(Type.Integer({ minimum: 0, maximum: 2 })),
  birthday: Type.Optional(Type.String({ format: 'date' })),
  provinceId: Type.Optional(Type.Integer()),
  cityId: Type.Optional(Type.Integer()),
  districtId: Type.Optional(Type.Integer()),
  address: Type.Optional(Type.String({ maxLength: 255 })),
  sourceChannel: Type.Optional(Type.String({ maxLength: 20 })),
  businessCategory: Type.Optional(Type.String({ maxLength: 50 })),
  intentionProject: Type.Optional(Type.String({ maxLength: 255 })),
  memberStage: Type.Optional(Type.String({ maxLength: 30 })),
  intentionLevel: Type.Optional(Type.String({ maxLength: 20 })),
  budgetRange: Type.Optional(Type.String({ maxLength: 50 })),
  expectedDate: Type.Optional(Type.String({ format: 'date' })),
  preferredHospitalId: Type.Optional(Type.Integer({ minimum: 1 })),
  ownerUserId: Type.Optional(Type.Integer({ minimum: 1 })),
  // 顾客标签：纯文本输入；多个标签用 , / ， / 、 / 换行 分隔
  tagsText: Type.Optional(Type.String({ maxLength: 2000 })),
  // 兼容旧调用方
  tagIds: Type.Optional(Type.Array(Type.Integer({ minimum: 1 }))),
  tagNames: Type.Optional(Type.Array(Type.String({ minLength: 1, maxLength: 50 }))),
  nextFollowUpAt: Type.Optional(Type.String({ format: 'date-time' })),
  remark: Type.Optional(Type.String({ maxLength: 2000 })),
}, { $id: 'crmMemberUpdateReq', minProperties: 1 })

// ──────────────────────────────────────────────
// 添加跟进
// ──────────────────────────────────────────────

export const CrmMemberFollowUpReqSchema = Type.Object({
  followUpMethod: Type.Optional(Type.String({ maxLength: 20 })),
  content: Type.String({ minLength: 1, maxLength: 5000 }),
  result: Type.Optional(Type.String({ maxLength: 30 })),
  memberStage: Type.Optional(Type.String({ maxLength: 30 })),
  intentionLevel: Type.Optional(Type.String({ maxLength: 20 })),
  nextFollowUpAt: Type.Optional(Type.String({ format: 'date-time' })),
}, { $id: 'crmMemberFollowUpReq' })

// ──────────────────────────────────────────────
// 创建派单（复用现有 crm 派单逻辑简化版）
// ──────────────────────────────────────────────

export const CrmMemberDispatchReqSchema = Type.Object({
  hospitalId: Type.Integer({ minimum: 1 }),
  statusId: Type.Optional(Type.Integer({ minimum: 1 })),
  content: Type.Optional(Type.String({ maxLength: 2000 })),
}, { $id: 'crmMemberDispatchReq' })

// ──────────────────────────────────────────────
// 批量操作
// ──────────────────────────────────────────────

export const CrmMemberBatchAssignReqSchema = Type.Object({
  memberIds: Type.Array(Type.Integer({ minimum: 1 }), { minItems: 1 }),
  toUserId: Type.Integer({ minimum: 1 }),
  reason: Type.Optional(Type.String({ maxLength: 255 })),
}, { $id: 'crmMemberBatchAssignReq' })

export const CrmMemberBatchTagReqSchema = Type.Object({
  memberIds: Type.Array(Type.Integer({ minimum: 1 }), { minItems: 1 }),
  // 顾客标签：纯文本输入；多个标签用 , / ， / 、 / 换行 分隔
  tagsText: Type.Optional(Type.String({ maxLength: 2000 })),
  // 兼容旧调用方
  tagNames: Type.Optional(Type.Array(Type.String({ minLength: 1, maxLength: 50 }))),
  tagIds: Type.Optional(Type.Array(Type.Integer({ minimum: 1 }))),
}, { $id: 'crmMemberBatchTagReq' })

export const CrmMemberBatchInvalidateReqSchema = Type.Object({
  memberIds: Type.Array(Type.Integer({ minimum: 1 }), { minItems: 1 }),
}, { $id: 'crmMemberBatchInvalidateReq' })

// ──────────────────────────────────────────────
// 恢复会员
// ──────────────────────────────────────────────

export const CrmMemberRestoreReqSchema = Type.Object({
  memberStage: Type.Optional(Type.String({ maxLength: 30 })),
}, { $id: 'crmMemberRestoreReq' })

// ──────────────────────────────────────────────
// 标签
// ──────────────────────────────────────────────

export const CrmMemberTagReqSchema = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 50 }),
  color: Type.Optional(Type.String({ maxLength: 20 })),
}, { $id: 'crmMemberTagReq' })

// ──────────────────────────────────────────────
// 可搜索客户（用于转会员）
// ──────────────────────────────────────────────

export const CrmCustomerSelectableQuerySchema = Type.Intersect([
  CrmPageQuerySchema,
  Type.Object({
    excludeMember: Type.Optional(Type.Integer({ minimum: 0, maximum: 1 })),
    mobile: Type.Optional(Type.String({ pattern: '^1[3-9]\\d{9}$', maxLength: 11 })),
    name: Type.Optional(Type.String({ maxLength: 50 })),
  }),
], { $id: 'crmCustomerSelectableQuery' })

// ──────────────────────────────────────────────
// 会员概览（顶部指标卡）
// ──────────────────────────────────────────────

export const CrmMemberOverviewRespSchema = Type.Object({
  total: Type.Number(),
  todayNew: Type.Number(),
  pendingFollowUp: Type.Number(),
  overdueFollowUp: Type.Number(),
  monthDispatched: Type.Number(),
  monthConverted: Type.Number(),
  monthConversionRate: Type.Union([Type.Number(), Type.Null()]),
  generatedAt: Type.String({ format: 'date-time' }),
}, { $id: 'crmMemberOverviewResp' })

export type CrmMemberOverviewResp = import('@sinclair/typebox').Static<typeof CrmMemberOverviewRespSchema>

// ──────────────────────────────────────────────
// TypeScript types
// ──────────────────────────────────────────────

export type CrmMemberListQuery = import('@sinclair/typebox').Static<typeof CrmMemberListQuerySchema>
export type CrmMemberFromCustomerReq = import('@sinclair/typebox').Static<typeof CrmMemberFromCustomerReqSchema>
export type CrmMemberDirectReq = import('@sinclair/typebox').Static<typeof CrmMemberDirectReqSchema>
export type CrmMemberUpdateReq = import('@sinclair/typebox').Static<typeof CrmMemberUpdateReqSchema>
export type CrmMemberFollowUpReq = import('@sinclair/typebox').Static<typeof CrmMemberFollowUpReqSchema>
export type CrmMemberDispatchReq = import('@sinclair/typebox').Static<typeof CrmMemberDispatchReqSchema>
export type CrmMemberBatchAssignReq = import('@sinclair/typebox').Static<typeof CrmMemberBatchAssignReqSchema>
export type CrmMemberBatchTagReq = import('@sinclair/typebox').Static<typeof CrmMemberBatchTagReqSchema>
export type CrmMemberBatchInvalidateReq = import('@sinclair/typebox').Static<typeof CrmMemberBatchInvalidateReqSchema>
export type CrmMemberRestoreReq = import('@sinclair/typebox').Static<typeof CrmMemberRestoreReqSchema>
export type CrmMemberTagReq = import('@sinclair/typebox').Static<typeof CrmMemberTagReqSchema>
export type CrmCustomerSelectableQuery = import('@sinclair/typebox').Static<typeof CrmCustomerSelectableQuerySchema>
