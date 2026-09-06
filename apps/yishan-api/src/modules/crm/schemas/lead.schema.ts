import { Type, type Static } from '@sinclair/typebox'
import { PaginationQuerySchema } from './common.schema.js'
import { ACTIVITY_TYPES } from './activity.schema.js'
export const LEAD_STATUS = ['new', 'processing', 'qualified', 'disqualified', 'converted'] as const
export const LEAD_POOL_STATUS = ['owned', 'public', 'unassigned'] as const
export const LeadRespSchema = Type.Object({ id: Type.Number(), name: Type.Union([Type.String(), Type.Null()]), companyName: Type.Union([Type.String(), Type.Null()]), mobile: Type.Union([Type.String(), Type.Null()]), phone: Type.Union([Type.String(), Type.Null()]), email: Type.Union([Type.String(), Type.Null()]), wechat: Type.Union([Type.String(), Type.Null()]), qq: Type.Union([Type.String(), Type.Null()]), sourceId: Type.Union([Type.Number(), Type.Null()]), intention: Type.Union([Type.String(), Type.Null()]), status: Type.String(), ownerUserId: Type.Union([Type.Number(), Type.Null()]), ownerUserName: Type.Union([Type.String(), Type.Null()]), ownerDepartmentId: Type.Union([Type.Number(), Type.Null()]), poolStatus: Type.String({ enum: [...LEAD_POOL_STATUS] }), createdBy: Type.Union([Type.Number(), Type.Null()]), lastFollowUpAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]), nextFollowUpAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]), disqualifyReason: Type.Union([Type.String(), Type.Null()]), convertedCustomerId: Type.Union([Type.Number(), Type.Null()]), convertedContactId: Type.Union([Type.Number(), Type.Null()]), convertedAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]), createdAt: Type.String({ format: 'date-time' }), updatedAt: Type.String({ format: 'date-time' }) })
export const LeadListQuerySchema = Type.Composite([PaginationQuerySchema, Type.Object({ keyword: Type.Optional(Type.String({ maxLength: 200 })), status: Type.Optional(Type.String({ enum: [...LEAD_STATUS] })), ownerUserId: Type.Optional(Type.Integer()), pool: Type.Optional(Type.Boolean()) })])
/**
 * 创建请求：不接受 ownerUserId/ownerDepartmentId/poolStatus。
 * 服务层按当前认证用户绑定 createdBy/ownerUserId/poolStatus='owned'。
 */
export const LeadCreateReqSchema = Type.Object({ name: Type.Optional(Type.String({ maxLength: 100 })), companyName: Type.Optional(Type.String({ maxLength: 200 })), mobile: Type.Optional(Type.String({ maxLength: 32 })), phone: Type.Optional(Type.String({ maxLength: 32 })), email: Type.Optional(Type.String({ maxLength: 100 })), wechat: Type.Optional(Type.String({ maxLength: 64 })), qq: Type.Optional(Type.String({ maxLength: 32 })), sourceId: Type.Optional(Type.Union([Type.Integer(), Type.Null()])), intention: Type.Optional(Type.String({ maxLength: 2000 })) })

/**
 * PATCH /leads/:id 白名单字段：仅普通资料字段。
 *
 * 严禁在此接收：
 *   - ownerUserId / ownerDepartmentId / poolStatus → 走 assign / returnToPool
 *   - status                                    → 走 qualify / disqualify
 *   - convertedCustomerId / convertedAt          → 走 convert
 *   - disqualifyReason                          → 走 disqualify
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
export const LeadAssignReqSchema = Type.Object({ targetUserId: Type.Union([Type.Integer(), Type.Null()]) })
export const LeadDisqualifyReqSchema = Type.Object({ reason: Type.String({ minLength: 1, maxLength: 500 }) })
export const LeadActivityRespSchema = Type.Object({ id: Type.Number(), leadId: Type.Number(), type: Type.String(), content: Type.String(), occurredAt: Type.String({ format: 'date-time' }), nextFollowUpAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]), operatorUserId: Type.Number(), operatorUserName: Type.Union([Type.String(), Type.Null()]), createdAt: Type.String({ format: 'date-time' }), updatedAt: Type.String({ format: 'date-time' }) })
export const LeadActivityListRespSchema = Type.Object({ total: Type.Number(), items: Type.Array(LeadActivityRespSchema) })
export const LeadActivityCreateReqSchema = Type.Object({ type: Type.String({ enum: [...ACTIVITY_TYPES] }), content: Type.String({ minLength: 1, maxLength: 2000 }), occurredAt: Type.Optional(Type.String({ format: 'date-time' })), nextFollowUpAt: Type.Optional(Type.Union([Type.String({ format: 'date-time' }), Type.Null()])) })
export type LeadCreateReq = Static<typeof LeadCreateReqSchema>
export type LeadActivityCreateReq = Static<typeof LeadActivityCreateReqSchema>
