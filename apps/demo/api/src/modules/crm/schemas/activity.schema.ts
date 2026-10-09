import { Type, type Static } from '@sinclair/typebox'
import {
  ACTIVITY_CATEGORIES,
  FOLLOW_UP_RESULTS,
  FOLLOW_UP_TYPES,
} from '../domain/statuses.js'

/**
 * 跟进记录的 HTTP schema。
 *
 * 动态类别 category ∈ { follow_up, system, business }。
 * 人工跟进的 type 是跟进方式（phone / wechat / ...），由服务端写入 category=follow_up。
 * 系统/业务事件由其它服务写入，不走「新建跟进」接口。
 */

export const FOLLOW_UP_TYPE_VALUES = FOLLOW_UP_TYPES.map((item) => item.value)
export const FOLLOW_UP_RESULT_VALUES = FOLLOW_UP_RESULTS.map((item) => item.value)
export const ACTIVITY_CATEGORY_VALUES = ACTIVITY_CATEGORIES.map((item) => item.value)

/** 全部 type 字面量；前端只对业务类型做 UI 映射，技术型（status_change 等）走隐藏。 */
export const ACTIVITY_TYPES = [
  ...FOLLOW_UP_TYPE_VALUES,
  'task',
  'note',
  'status_change',
  'owner_change',
  'qualification',
  'profile_edit',
  'customer_created',
] as const
export type ActivityType = (typeof ACTIVITY_TYPES)[number]

/** 实体类型（polymorphic）。 */
export const ACTIVITY_ENTITY_TYPES = ['customer', 'opportunity', 'contract'] as const
export type ActivityEntityType = (typeof ACTIVITY_ENTITY_TYPES)[number]

export const ActivityRespSchema = Type.Object({
  id: Type.Number(),
  /** @deprecated 保留兼容；新代码请用 entityType/entityId */
  customerId: Type.Union([Type.Number(), Type.Null()]),
  contactId: Type.Union([Type.Number(), Type.Null()]),
  entityType: Type.Union([
    Type.Literal('customer'),
    Type.Literal('opportunity'),
    Type.Literal('contract'),
    Type.Null(),
  ]),
  entityId: Type.Union([Type.Number(), Type.Null()]),
  entityRefType: Type.Union([Type.String(), Type.Null()]),
  category: Type.String({ enum: [...ACTIVITY_CATEGORY_VALUES] }),
  type: Type.String(),
  content: Type.String(),
  occurredAt: Type.String({ format: 'date-time' }),
  nextFollowUpAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  result: Type.Union([Type.String(), Type.Null()]),
  nextFollowUpPlan: Type.Union([Type.String(), Type.Null()]),
  attachmentIds: Type.Union([Type.Array(Type.Integer({ minimum: 1 })), Type.Null()]),
  metadata: Type.Union([Type.Record(Type.String(), Type.Any()), Type.Null()]),
  /** Phase 4 拜访专用字段 */
  plannedAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  location: Type.Union([Type.String(), Type.Null()]),
  participants: Type.Union([Type.String(), Type.Null()]),
  visitResultCode: Type.Union([Type.String(), Type.Null()]),
  summary: Type.Union([Type.String(), Type.Null()]),
  operatorUserId: Type.Number(),
  operatorUserName: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
})
export type ActivityResp = Static<typeof ActivityRespSchema>

export const ActivityListRespSchema = Type.Object({
  total: Type.Number(),
  items: Type.Array(ActivityRespSchema),
})

export const ActivityCreateReqSchema = Type.Object({
  contactId: Type.Optional(Type.Union([Type.Integer(), Type.Null()])),
  type: Type.String({ enum: [...FOLLOW_UP_TYPE_VALUES] }),
  content: Type.String({ minLength: 1, maxLength: 2000 }),
  occurredAt: Type.Optional(Type.String({ format: 'date-time' })),
  nextFollowUpAt: Type.Optional(Type.Union([Type.String({ format: 'date-time' }), Type.Null()])),
  result: Type.Optional(Type.Union([Type.String({ enum: [...FOLLOW_UP_RESULT_VALUES] }), Type.Null()])),
  nextFollowUpPlan: Type.Optional(Type.Union([Type.String({ maxLength: 500 }), Type.Null()])),
  attachmentIds: Type.Optional(Type.Union([Type.Array(Type.Integer({ minimum: 1 })), Type.Null()])),
  metadata: Type.Optional(Type.Union([Type.Record(Type.String(), Type.Any()), Type.Null()])),
  /** Phase 4 拜访：计划拜访时间 */
  plannedAt: Type.Optional(Type.Union([Type.String({ format: 'date-time' }), Type.Null()])),
  location: Type.Optional(Type.Union([Type.String({ maxLength: 255 }), Type.Null()])),
  participants: Type.Optional(Type.Union([Type.String({ maxLength: 500 }), Type.Null()])),
  visitResultCode: Type.Optional(Type.Union([Type.String({ maxLength: 64 }), Type.Null()])),
  summary: Type.Optional(Type.Union([Type.String({ maxLength: 1000 }), Type.Null()])),
})
export type ActivityCreateReq = Static<typeof ActivityCreateReqSchema>

/**
 * 编辑。所有字段可选；至少要传一个（由 route 层把"全空"当作 400）。
 * 重算客户跟进时间时只看发生时间和下次跟进时间两个字段的"新值"，
 * 所以允许单独改 content / contactId 不会触发客户时间重算副作用——
 * service 仍会无脑重算一次（成本很低，换"任意字段变更都正确"的简单性）。
 */
export const ActivityUpdateReqSchema = Type.Partial(
  Type.Object({
    contactId: Type.Union([Type.Integer(), Type.Null()]),
    type: Type.String({ enum: [...FOLLOW_UP_TYPE_VALUES] }),
    content: Type.String({ minLength: 1, maxLength: 2000 }),
    occurredAt: Type.String({ format: 'date-time' }),
    nextFollowUpAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
    result: Type.Union([Type.String({ enum: [...FOLLOW_UP_RESULT_VALUES] }), Type.Null()]),
    nextFollowUpPlan: Type.Union([Type.String({ maxLength: 500 }), Type.Null()]),
    attachmentIds: Type.Union([Type.Array(Type.Integer({ minimum: 1 })), Type.Null()]),
    metadata: Type.Union([Type.Record(Type.String(), Type.Any()), Type.Null()]),
    plannedAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
    location: Type.Union([Type.String({ maxLength: 255 }), Type.Null()]),
    participants: Type.Union([Type.String({ maxLength: 500 }), Type.Null()]),
    visitResultCode: Type.Union([Type.String({ maxLength: 64 }), Type.Null()]),
    summary: Type.Union([Type.String({ maxLength: 1000 }), Type.Null()]),
  }),
)
export type ActivityUpdateReq = Static<typeof ActivityUpdateReqSchema>

/** 列表查询 querystring。Phase 1 接受 entityType + entityId；旧 customerId 兼容。 */
export const ActivityListQuerySchema = Type.Object({
  customerId: Type.Optional(Type.Integer()),
  entityType: Type.Optional(Type.String({ enum: [...ACTIVITY_ENTITY_TYPES] })),
  entityId: Type.Optional(Type.Integer()),
  type: Type.Optional(Type.String({ maxLength: 32 })),
  page: Type.Optional(Type.Integer({ minimum: 1 })),
  pageSize: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
})

/** Phase 4 拜访列表查询。 */
export const VisitListQuerySchema = Type.Object({
  customerId: Type.Optional(Type.Integer()),
  plannedFrom: Type.Optional(Type.String({ format: 'date-time' })),
  plannedTo: Type.Optional(Type.String({ format: 'date-time' })),
  page: Type.Optional(Type.Integer({ minimum: 1 })),
  pageSize: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
})
