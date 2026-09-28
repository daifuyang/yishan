import { Type, type Static } from '@sinclair/typebox'
import { TASK_STATUSES } from '../domain/statuses.js'
import { PaginationQuerySchema } from './common.schema.js'
const TaskStatusSchema = Type.String({ enum: TASK_STATUSES.map((status) => status.value) })

/** 任务优先级枚举：normal / high / urgent（MVP 3 档；不引入 5 档）。 */
export const TASK_PRIORITIES = ['normal', 'high', 'urgent'] as const
export type TaskPriority = (typeof TASK_PRIORITIES)[number]
const TaskPrioritySchema = Type.String({ enum: [...TASK_PRIORITIES] })

export const TaskIdParamSchema = Type.Object({ id: Type.Integer({ minimum: 1 }) })
export const TaskRespSchema = Type.Object({
  id: Type.Number(),
  customerId: Type.Number(),
  title: Type.String(),
  status: TaskStatusSchema,
  priority: TaskPrioritySchema,
  assigneeUserId: Type.Union([Type.Number(), Type.Null()]),
  assigneeName: Type.Union([Type.String(), Type.Null()]),
  dueAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  completedAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  description: Type.Union([Type.String(), Type.Null()]),
  creatorId: Type.Union([Type.Number(), Type.Null()]),
  creatorName: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
})
export const TaskListQuerySchema = Type.Composite([
  PaginationQuerySchema,
  Type.Object({
    customerId: Type.Optional(Type.Integer()),
    status: Type.Optional(TaskStatusSchema),
    keyword: Type.Optional(Type.String()),
    assigneeUserId: Type.Optional(Type.Integer()),
  }),
])
export const TaskCreateReqSchema = Type.Object({
  customerId: Type.Integer({ minimum: 1 }),
  title: Type.String({ minLength: 1, maxLength: 200 }),
  status: Type.Optional(TaskStatusSchema),
  priority: Type.Optional(TaskPrioritySchema),
  assigneeUserId: Type.Optional(Type.Union([Type.Integer(), Type.Null()])),
  dueAt: Type.Optional(Type.Union([Type.String({ format: 'date-time' }), Type.Null()])),
  description: Type.Optional(Type.Union([Type.String({ maxLength: 2000 }), Type.Null()])),
})
export const TaskUpdateReqSchema = Type.Partial(Type.Omit(TaskCreateReqSchema, ['customerId']))
export type TaskCreateReq = Static<typeof TaskCreateReqSchema>
export type TaskUpdateReq = Static<typeof TaskUpdateReqSchema>