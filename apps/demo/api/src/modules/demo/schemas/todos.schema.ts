import { Type, type Static } from '@sinclair/typebox'

/**
 * Todo 的 HTTP schema。
 *
 * 与 db/schema 不同：这里描述的是"入参 / 出参"的形态。
 * 路由层通过 Fastify 的 schema 选项挂入，Fastify 内置 ajv 自动校验。
 */

export const TodoCreateReqSchema = Type.Object(
  {
    title: Type.String({ minLength: 1, maxLength: 200 }),
    description: Type.Optional(Type.String({ maxLength: 2000 })),
    status: Type.Optional(Type.Integer({ minimum: 0, maximum: 2 })),
    dueAt: Type.Optional(Type.String({ format: 'date-time' })),
  },
  { $id: 'demoTodoCreateReq' },
)
export type TodoCreateReq = Static<typeof TodoCreateReqSchema>

export const TodoUpdateReqSchema = Type.Object(
  {
    title: Type.Optional(Type.String({ minLength: 1, maxLength: 200 })),
    description: Type.Optional(Type.String({ maxLength: 2000 })),
    status: Type.Optional(Type.Integer({ minimum: 0, maximum: 2 })),
    dueAt: Type.Optional(Type.Union([Type.String({ format: 'date-time' }), Type.Null()])),
  },
  { $id: 'demoTodoUpdateReq' },
)
export type TodoUpdateReq = Static<typeof TodoUpdateReqSchema>
