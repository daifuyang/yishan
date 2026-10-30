import { Type } from '@sinclair/typebox'
import { CrmPageQuerySchema } from './shared.schema.js'
export const CrmDispatchListQuerySchema = Type.Intersect([CrmPageQuerySchema, Type.Object({ statusId: Type.Optional(Type.Integer({ minimum: 1 })) })], { $id: 'crmDispatchListQuery' })
export const CrmDispatchUpdateSchema = Type.Object({ hospitalId: Type.Optional(Type.Integer({ minimum: 1 })), statusId: Type.Optional(Type.Integer({ minimum: 1 })), image: Type.Optional(Type.String({ maxLength: 500 })), receiveQq: Type.Optional(Type.String({ maxLength: 50 })), receiveWechat: Type.Optional(Type.String({ maxLength: 50 })), finishedAt: Type.Optional(Type.String({ format: 'date-time' })) }, { $id: 'crmDispatchUpdate', minProperties: 1 })
export const CrmDispatchReplyReqSchema = Type.Object({ content: Type.Optional(Type.String({ maxLength: 2000 })), receiveQq: Type.Optional(Type.String({ maxLength: 50 })), receiveWechat: Type.Optional(Type.String({ maxLength: 50 })), image: Type.Optional(Type.String({ maxLength: 500 })), statusId: Type.Optional(Type.Integer({ minimum: 1 })) }, { $id: 'crmDispatchReplyReq' })
export const CrmDispatchLogReqSchema = Type.Object({ content: Type.String({ minLength: 1, maxLength: 2000 }) }, { $id: 'crmDispatchLogReq' })

// ──────────────────────────────────────────────
// 客户手机号查看（医院账号点眼睛触发）
// ──────────────────────────────────────────────

/** POST /dispatches/:id/view-mobile 响应：仅返回 customer.mobile 明文 + 一行文案。 */
export const CrmDispatchMobileViewRespSchema = Type.Object(
  {
    mobile: Type.Union([Type.String(), Type.Null()]),
  },
  { $id: 'crmDispatchMobileViewResp' },
)

/** GET /dispatches/:id/mobile-view-logs 响应：每条记录的查看人/时间/IP。 */
export const CrmDispatchMobileViewLogItemSchema = Type.Object(
  {
    id: Type.Integer(),
    dispatchId: Type.Integer(),
    viewerUserId: Type.Integer(),
    viewerUsername: Type.String(),
    viewerHospitalName: Type.Union([Type.String(), Type.Null()]),
    ipAddress: Type.Union([Type.String(), Type.Null()]),
    createdAt: Type.String({ format: 'date-time' }),
  },
  { $id: 'crmDispatchMobileViewLogItem' },
)

export const CrmDispatchMobileViewLogListRespSchema = Type.Object(
  {
    list: Type.Array(CrmDispatchMobileViewLogItemSchema),
  },
  { $id: 'crmDispatchMobileViewLogListResp' },
)

/** GET /dispatches/:id/hospital-view-logs 响应条目：医院账号查看派单留痕。 */
export const CrmDispatchViewLogRespSchema = Type.Object(
  {
    id: Type.Number(),
    dispatchId: Type.Number(),
    hospitalId: Type.Number(),
    hospitalName: Type.Union([Type.String(), Type.Null()]),
    viewerUserId: Type.Number(),
    viewerUsername: Type.String(),
    ipAddress: Type.Union([Type.String(), Type.Null()]),
    createdAt: Type.String({ format: 'date-time' }),
  },
  { $id: 'crmDispatchViewLogResp' },
)

/** GET /dispatches/:id/hospital-view-logs 响应外壳。 */
export const CrmDispatchViewLogListRespSchema = Type.Object(
  {
    list: Type.Array(CrmDispatchViewLogRespSchema),
  },
  { $id: 'crmDispatchViewLogListResp' },
)

export type CrmDispatchListQuery = import('@sinclair/typebox').Static<typeof CrmDispatchListQuerySchema>
export type CrmDispatchUpdate = import('@sinclair/typebox').Static<typeof CrmDispatchUpdateSchema>
export type CrmDispatchReplyReq = import('@sinclair/typebox').Static<typeof CrmDispatchReplyReqSchema>
export type CrmDispatchLogReq = import('@sinclair/typebox').Static<typeof CrmDispatchLogReqSchema>
export type CrmDispatchMobileViewResp = import('@sinclair/typebox').Static<typeof CrmDispatchMobileViewRespSchema>
export type CrmDispatchMobileViewLogItem = import('@sinclair/typebox').Static<typeof CrmDispatchMobileViewLogItemSchema>
export type CrmDispatchMobileViewLogListResp = import('@sinclair/typebox').Static<typeof CrmDispatchMobileViewLogListRespSchema>
export type CrmDispatchViewLogResp = import('@sinclair/typebox').Static<typeof CrmDispatchViewLogRespSchema>
export type CrmDispatchViewLogListResp = import('@sinclair/typebox').Static<typeof CrmDispatchViewLogListRespSchema>

