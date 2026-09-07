import { Type, type Static } from '@sinclair/typebox'
import { PaginationQuerySchema } from './common.schema.js'
import { ACTIVITY_TYPES } from './activity.schema.js'
export const LEAD_FOLLOW_UP_STATUS = ['pending', 'contact_valid', 'contact_invalid', 'closed'] as const

/**
 * 标准化作废原因码：除了代码本身的语义价值，禁止自由文本替代 code。
 * 解释（reason）字段仍保留 1..500 字自由文本，但 code 必须在下列范围内。
 */
export const LEAD_DISQUALIFY_CODES = [
  'duplicate',
  'not_target',
  'no_demand',
  'unreachable',
  'invalid_contact',
  'rejected',
  'other',
] as const
export type LeadDisqualifyCode = (typeof LEAD_DISQUALIFY_CODES)[number]

/** 中文标签，与前端/审计事件一致。 */
export const LEAD_DISQUALIFY_CODE_LABELS: Record<LeadDisqualifyCode, string> = {
  duplicate: '重复',
  not_target: '非目标',
  no_demand: '无需求',
  unreachable: '无法联系',
  invalid_contact: '联系方式错误',
  rejected: '明确拒绝',
  other: '其他',
}

export const LeadRespSchema = Type.Object({
  id: Type.Number(),
  name: Type.Union([Type.String(), Type.Null()]),
  companyName: Type.Union([Type.String(), Type.Null()]),
  mobile: Type.Union([Type.String(), Type.Null()]),
  phone: Type.Union([Type.String(), Type.Null()]),
  email: Type.Union([Type.String(), Type.Null()]),
  wechat: Type.Union([Type.String(), Type.Null()]),
  qq: Type.Union([Type.String(), Type.Null()]),
  sourceId: Type.Union([Type.Number(), Type.Null()]),
  intention: Type.Union([Type.String(), Type.Null()]),
  status: Type.String({ enum: [...LEAD_FOLLOW_UP_STATUS] }),
  ownerUserId: Type.Union([Type.Number(), Type.Null()]),
  ownerUserName: Type.Union([Type.String(), Type.Null()]),
  ownerDepartmentId: Type.Union([Type.Number(), Type.Null()]),
  createdBy: Type.Union([Type.Number(), Type.Null()]),
  lastFollowUpAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  nextFollowUpAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  disqualifyReason: Type.Union([Type.String(), Type.Null()]),
  disqualifyCode: Type.Union([Type.String({ enum: [...LEAD_DISQUALIFY_CODES] }), Type.Null()]),
  convertedCustomerId: Type.Union([Type.Number(), Type.Null()]),
  convertedContactId: Type.Union([Type.Number(), Type.Null()]),
  convertedAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
})

export const LeadListQuerySchema = Type.Composite([
  PaginationQuerySchema,
  Type.Object({
    keyword: Type.Optional(Type.String({ maxLength: 200 })),
    status: Type.Optional(Type.String({ enum: [...LEAD_FOLLOW_UP_STATUS] })),
    ownerUserId: Type.Optional(Type.Integer()),
    pool: Type.Optional(Type.Boolean()),
  }),
])

/**
 * 创建请求：不接受 ownerUserId/ownerDepartmentId。
 * 服务层按当前认证用户绑定 createdBy/ownerUserId。
 */
export const LeadCreateReqSchema = Type.Object({
  name: Type.Optional(Type.String({ maxLength: 100 })),
  companyName: Type.Optional(Type.String({ maxLength: 200 })),
  mobile: Type.Optional(Type.String({ maxLength: 32 })),
  phone: Type.Optional(Type.String({ maxLength: 32 })),
  email: Type.Optional(Type.String({ maxLength: 100 })),
  wechat: Type.Optional(Type.String({ maxLength: 64 })),
  qq: Type.Optional(Type.String({ maxLength: 32 })),
  sourceId: Type.Optional(Type.Union([Type.Integer(), Type.Null()])),
  intention: Type.Optional(Type.String({ maxLength: 2000 })),
})

/**
 * PATCH /leads/:id 白名单字段：仅普通资料字段。
 *
 * 严禁在此接收：
 *   - ownerUserId / ownerDepartmentId → 走 assign / returnToPool
 *   - status                                    → 走 qualify / disqualify
 *   - convertedCustomerId / convertedAt          → 走 convert
 *   - disqualifyReason                          → 走 disqualify
 *   - disqualifyCode                            → 走 disqualify
 *
 * 服务层在 LeadService.update 内对不允许的字段再做一次兜底校验。
 */
export const LeadUpdateReqSchema = Type.Object({
  name: Type.Optional(Type.String({ maxLength: 100 })),
  companyName: Type.Optional(Type.String({ maxLength: 200 })),
  mobile: Type.Optional(Type.String({ maxLength: 32 })),
  phone: Type.Optional(Type.String({ maxLength: 32 })),
  email: Type.Optional(Type.String({ maxLength: 100 })),
  wechat: Type.Optional(Type.String({ maxLength: 64 })),
  qq: Type.Optional(Type.String({ maxLength: 32 })),
  sourceId: Type.Optional(Type.Union([Type.Integer(), Type.Null()])),
  intention: Type.Optional(Type.String({ maxLength: 2000 })),
})

export const LeadIdParamSchema = Type.Object({ id: Type.Integer() })
export const LeadAssignReqSchema = Type.Object({
  targetUserId: Type.Union([Type.Integer(), Type.Null()]),
})

/**
 * 判为有效请求：必须填资格证据 + 下一步，且两个字段都不能为空。
 *
 * 业务约束：
 *   - 证据 1..1000 字：需求/适配证据，不是主观感受。
 *   - 下一步 1..500 字：与客户约定的下一步销售动作。
 */
export const LeadQualificationReqSchema = Type.Object({
  evidence: Type.String({ minLength: 1, maxLength: 1000 }),
  nextAction: Type.String({ minLength: 1, maxLength: 500 }),
})
export type LeadQualificationReq = Static<typeof LeadQualificationReqSchema>

/**
 * 作废请求：必须给标准化 code + 解释。
 * code 必须是 LEAD_DISQUALIFY_CODES 之一；解释 1..500 字。
 *
 * 注意：TypeBox 的 Type.String({ enum }) 不会被 Value.Check 严格校验，
 * 这里用 Type.Union(Literal...) 保证运行期校验严格。
 */
export const LeadDisqualifyReqSchema = Type.Object({
  code: Type.Union(LEAD_DISQUALIFY_CODES.map((c) => Type.Literal(c))),
  reason: Type.String({ minLength: 1, maxLength: 500 }),
})
export type LeadDisqualifyReq = Static<typeof LeadDisqualifyReqSchema>

/**
 * 重新激活请求：必须给原因 1..500 字。
 * 仅允许从 disqualified → processing；其他状态一律拒绝。
 */
export const LeadReactivateReqSchema = Type.Object({
  reason: Type.String({ minLength: 1, maxLength: 500 }),
})
export type LeadReactivateReq = Static<typeof LeadReactivateReqSchema>

/** 客户候选条目：用于转化预览。 */
export const LeadConversionPreviewCustomerSchema = Type.Object({
  id: Type.Number(),
  name: Type.String(),
  type: Type.Union([Type.Literal('enterprise'), Type.Literal('individual')]),
  ownerUserId: Type.Union([Type.Number(), Type.Null()]),
  ownerUserName: Type.Union([Type.String(), Type.Null()]),
})
export const LeadConversionPreviewContactSchema = Type.Object({
  id: Type.Number(),
  customerId: Type.Number(),
  name: Type.String(),
  mobile: Type.Union([Type.String(), Type.Null()]),
  email: Type.Union([Type.String(), Type.Null()]),
})
export const LeadConversionPreviewSchema = Type.Object({
  lead: LeadRespSchema,
  customers: Type.Array(LeadConversionPreviewCustomerSchema),
  contacts: Type.Array(LeadConversionPreviewContactSchema),
})
export type LeadConversionPreview = Static<typeof LeadConversionPreviewSchema>

/**
 * 转化请求：客户与联系人必须同时给出 explicit decision。
 * customer 与 contact 的 mode 必须是 existing 或 create；
 *   - existing 必须给正整数 id
 *   - create 至少给 name
 */
export const LeadConvertCustomerExistingSchema = Type.Object({
  mode: Type.Literal('existing'),
  customerId: Type.Integer({ minimum: 1 }),
})
export const LeadConvertCustomerCreateSchema = Type.Object({
  mode: Type.Literal('create'),
  name: Type.String({ minLength: 1, maxLength: 200 }),
  type: Type.Union([Type.Literal('enterprise'), Type.Literal('individual')]),
  phone: Type.Optional(Type.Union([Type.String({ maxLength: 32 }), Type.Null()])),
})
export const LeadConvertCustomerSchema = Type.Union([
  LeadConvertCustomerExistingSchema,
  LeadConvertCustomerCreateSchema,
])

export const LeadConvertContactExistingSchema = Type.Object({
  mode: Type.Literal('existing'),
  contactId: Type.Integer({ minimum: 1 }),
})
export const LeadConvertContactCreateSchema = Type.Object({
  mode: Type.Literal('create'),
  name: Type.String({ minLength: 1, maxLength: 100 }),
  mobile: Type.Optional(Type.Union([Type.String({ maxLength: 32 }), Type.Null()])),
  phone: Type.Optional(Type.Union([Type.String({ maxLength: 32 }), Type.Null()])),
  email: Type.Optional(Type.Union([Type.String({ maxLength: 100 }), Type.Null()])),
})
export const LeadConvertContactSchema = Type.Union([
  LeadConvertContactExistingSchema,
  LeadConvertContactCreateSchema,
])

export const LeadConvertReqSchema = Type.Object({
  customer: LeadConvertCustomerSchema,
  contact: LeadConvertContactSchema,
})
export type LeadConvertReq = Static<typeof LeadConvertReqSchema>

/** 转化结果：成功响应需要包含三方的最小可追溯信息。 */
export const LeadConversionResultSchema = Type.Object({
  lead: LeadRespSchema,
  customer: LeadRespSchema, // 复用同一基类表达，避免重复定义 CustomerResp
  contact: LeadConversionPreviewContactSchema,
})
export type LeadConversionResult = Static<typeof LeadConversionResultSchema>

export const LeadActivityRespSchema = Type.Object({
  id: Type.Number(),
  leadId: Type.Number(),
  type: Type.String(),
  content: Type.String(),
  occurredAt: Type.String({ format: 'date-time' }),
  nextFollowUpAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  operatorUserId: Type.Number(),
  operatorUserName: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
})
export const LeadActivityListRespSchema = Type.Object({
  total: Type.Number(),
  items: Type.Array(LeadActivityRespSchema),
})
export const LeadActivityCreateReqSchema = Type.Object({
  type: Type.String({ enum: [...ACTIVITY_TYPES] }),
  content: Type.String({ minLength: 1, maxLength: 2000 }),
  followUpStatus: Type.Union(LEAD_FOLLOW_UP_STATUS.map((status) => Type.Literal(status))),
  occurredAt: Type.Optional(Type.String({ format: 'date-time' })),
  nextFollowUpAt: Type.Optional(Type.Union([Type.String({ format: 'date-time' }), Type.Null()])),
})

/**
 * 写跟进成功响应：activity 与最新 lead 同时返回。
 * 前端拿到后即可立刻刷新抽屉标签/操作按钮，无需再次 GET。
 */
export const LeadActivityCreateRespSchema = Type.Object({
  activity: LeadActivityRespSchema,
  lead: LeadRespSchema,
})
export type LeadActivityCreateResponse = Static<typeof LeadActivityCreateRespSchema>

export type LeadCreateReq = Static<typeof LeadCreateReqSchema>
export type LeadActivityCreateReq = Static<typeof LeadActivityCreateReqSchema>
