/**
 * sys_enum 模块 TypeBox schemas。
 *
 * type 值域（字典）—— 与业务模块约定的全部 enum 类型常量；
 * 后端 service 层会拒绝任何不在字典里的 type，前端按需从中筛。
 */
import { Static, Type } from '@sinclair/typebox'
import { PaginationQuerySchema } from './common.js'

/**
 * 全部支持的 enum type 列表。
 *
 * 任何业务模块新增枚举 type 时，必须：
 *   1. 把 type 字面量追加到本常量
 *   2. 写种子数据搬运逻辑（或人工录入）
 *   3. 在 Phase 0 文档 / changelog 中同步
 */
export const SYS_ENUM_TYPES = [
  // CRM 客户
  'crm_industry',
  'crm_customer_level',
  'crm_customer_status',
  'crm_customer_source',
  // CRM 线索
  'crm_lead_status',
  // CRM 商机
  'crm_opportunity_stage',
  'crm_opportunity_pipeline',
  'crm_opportunity_lost_reason',
  // CRM 拜访
  'crm_visit_result',
  // CRM 工单
  'crm_ticket_priority',
  'crm_ticket_type',
  // CRM 回款
  'crm_payment_method',
] as const
export type SysEnumType = (typeof SYS_ENUM_TYPES)[number]

/** 单条 enum 项查询响应。 */
export const SysEnumItemRespSchema = Type.Object({
  id: Type.Number(),
  type: Type.String(),
  code: Type.String(),
  name: Type.String(),
  sort: Type.Number(),
  enabled: Type.Number(),
  remark: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
})
export type SysEnumItemResp = Static<typeof SysEnumItemRespSchema>

/** type 过滤后的列表响应（轻量；只返回 code/name/sort，禁用项过滤）。 */
export const SysEnumCodeNameListRespSchema = Type.Object({
  type: Type.String(),
  items: Type.Array(
    Type.Object({
      code: Type.String(),
      name: Type.String(),
      sort: Type.Number(),
    }),
  ),
  cachedAt: Type.String({ format: 'date-time' }),
})
export type SysEnumCodeNameListResp = Static<typeof SysEnumCodeNameListRespSchema>

/** 列表查询 querystring（按 type 过滤 + 分页）。 */
export const SysEnumListQuerySchema = Type.Composite([
  PaginationQuerySchema,
  Type.Object({
    type: Type.Optional(Type.String({ maxLength: 64 })),
    keyword: Type.Optional(Type.String({ maxLength: 100 })),
    enabled: Type.Optional(Type.Number({ enum: [0, 1] })),
  }),
])
export type SysEnumListQuery = Static<typeof SysEnumListQuerySchema>

/** 创建请求。type 必须在 SYS_ENUM_TYPES 字典内，service 层兜底。 */
export const SysEnumCreateReqSchema = Type.Object({
  type: Type.String({ minLength: 1, maxLength: 64 }),
  code: Type.String({ minLength: 1, maxLength: 64 }),
  name: Type.String({ minLength: 1, maxLength: 64 }),
  sort: Type.Optional(Type.Number({ minimum: 0, maximum: 99999, default: 0 })),
  enabled: Type.Optional(Type.Number({ enum: [0, 1] })),
  remark: Type.Optional(Type.Union([Type.String({ maxLength: 255 }), Type.Null()])),
})
export type SysEnumCreateReq = Static<typeof SysEnumCreateReqSchema>

/** 更新请求（白名单字段；type/code 是天然主键，不允许修改）。 */
export const SysEnumUpdateReqSchema = Type.Object({
  name: Type.Optional(Type.String({ minLength: 1, maxLength: 64 })),
  sort: Type.Optional(Type.Number({ minimum: 0, maximum: 99999 })),
  enabled: Type.Optional(Type.Number({ enum: [0, 1] })),
  remark: Type.Optional(Type.Union([Type.String({ maxLength: 255 }), Type.Null()])),
})
export type SysEnumUpdateReq = Static<typeof SysEnumUpdateReqSchema>

export const SysEnumIdParamSchema = Type.Object({ id: Type.Integer() })
