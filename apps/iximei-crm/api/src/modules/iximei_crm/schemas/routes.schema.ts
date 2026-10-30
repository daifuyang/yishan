import { Type } from '@sinclair/typebox'
export const ROUTE_TAG = 'crm'
export const SuccessRespSchema = Type.Object({ code: Type.Optional(Type.Number()), message: Type.Optional(Type.String()), data: Type.Optional(Type.Unknown()) }, { $id: 'crmSuccessResp' })
export const PaginatedRespSchema = Type.Object({ code: Type.Optional(Type.Number()), message: Type.Optional(Type.String()), data: Type.Optional(Type.Unknown()), total: Type.Optional(Type.Number()), page: Type.Optional(Type.Number()), pageSize: Type.Optional(Type.Number()) }, { $id: 'crmPaginatedResp' })
