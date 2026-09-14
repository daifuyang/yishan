import { Type, type Static } from '@sinclair/typebox'
import { TASK_STATUSES } from '../domain/statuses.js'
import { PaginationQuerySchema } from './common.schema.js'
const TaskStatusSchema = Type.String({ enum: TASK_STATUSES.map((status) => status.value) })
export const TaskIdParamSchema = Type.Object({ id: Type.Integer({ minimum: 1 }) })
export const TaskRespSchema = Type.Object({ id: Type.Number(), customerId: Type.Number(), title: Type.String(), status: TaskStatusSchema, assigneeUserId: Type.Union([Type.Number(), Type.Null()]), dueAt: Type.Union([Type.String(), Type.Null()]), completedAt: Type.Union([Type.String(), Type.Null()]), description: Type.Union([Type.String(), Type.Null()]) })
export const TaskListQuerySchema = Type.Composite([PaginationQuerySchema, Type.Object({ customerId: Type.Optional(Type.Integer()), status: Type.Optional(TaskStatusSchema), keyword: Type.Optional(Type.String()), assigneeUserId: Type.Optional(Type.Integer()) })])
export const TaskCreateReqSchema = Type.Object({ customerId: Type.Integer({ minimum: 1 }), title: Type.String({ minLength: 1, maxLength: 200 }), status: Type.Optional(TaskStatusSchema), assigneeUserId: Type.Optional(Type.Union([Type.Integer(), Type.Null()])), dueAt: Type.Optional(Type.Union([Type.String({ format: 'date-time' }), Type.Null()])), description: Type.Optional(Type.Union([Type.String({ maxLength: 2000 }), Type.Null()])) })
export const TaskUpdateReqSchema = Type.Partial(Type.Omit(TaskCreateReqSchema, ['customerId']))
export type TaskCreateReq = Static<typeof TaskCreateReqSchema>
export type TaskUpdateReq = Static<typeof TaskUpdateReqSchema>
