import { Type } from '@sinclair/typebox'
export const CrmIdParamsSchema = Type.Object({ id: Type.Integer({ minimum: 1 }) }, { $id: 'crmIdParams' })
export const CrmPageQuerySchema = Type.Object({ page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })), pageSize: Type.Optional(Type.Integer({ minimum: 0, maximum: 100, default: 10 })), keyword: Type.Optional(Type.String({ maxLength: 100 })), startTime: Type.Optional(Type.String({ format: 'date-time' })), endTime: Type.Optional(Type.String({ format: 'date-time' })) }, { $id: 'crmPageQuery' })
export const CrmDateQuerySchema = Type.Intersect([CrmPageQuerySchema, Type.Object({ statusId: Type.Optional(Type.Integer({ minimum: 1 })) })], { $id: 'crmDateQuery' })
