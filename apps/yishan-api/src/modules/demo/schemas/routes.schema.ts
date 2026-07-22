import { Type, type Static } from '@sinclair/typebox'

/**
 * Demo 模块路由共用 response schema。
 *
 * 仅用于让路由在 swagger UI 里显示（hideUntagged:true 下，没 schema+tags 的路由被过滤）。
 * 入参 schema 见 todos.schema.ts。
 */

export const TodoRespSchema = Type.Object(
  {
    id: Type.Number(),
    title: Type.String(),
    description: Type.String(),
    status: Type.Number(),
    dueAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
    createdAt: Type.String({ format: 'date-time' }),
    updatedAt: Type.String({ format: 'date-time' }),
  },
  { $id: 'demoTodoResp' },
)
export type TodoResp = Static<typeof TodoRespSchema>

export const TodoListRespSchema = Type.Object(
  {
    total: Type.Number(),
    items: Type.Array(TodoRespSchema),
  },
  { $id: 'demoTodoListResp' },
)
export type TodoListResp = Static<typeof TodoListRespSchema>

export const ServerInfoRespSchema = Type.Object(
  {
    module: Type.Literal('demo'),
    nodeVersion: Type.String(),
    hostname: Type.String(),
    platform: Type.String(),
    arch: Type.String(),
    cpus: Type.Number(),
    memory: Type.Object({ total: Type.Number(), free: Type.Number() }),
    uptimeSeconds: Type.Number(),
    pid: Type.Number(),
    env: Type.String(),
    timestamp: Type.String({ format: 'date-time' }),
  },
  { $id: 'demoServerInfoResp' },
)
export type ServerInfoResp = Static<typeof ServerInfoRespSchema>

/** 路由 tags 集中常量，方便 swagger 顶层 tag 列表对齐。 */
export const ROUTE_TAG = 'demo'
