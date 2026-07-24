import { type FastifyPluginAsync } from 'fastify'
import { Type } from '@sinclair/typebox'
import { registerPermissions, type PermissionRef } from '@/core/permissions/catalog.js'
import { createRouteRegistrar } from '@/core/routes/route-registrar.js'
import { TodosService } from '../../../services/todos.service.js'
import { drizzleDb } from '@/db'
import {
  TodoCreateReqSchema,
  TodoUpdateReqSchema,
} from '../../../schemas/todos.schema.js'
import {
  ROUTE_TAG,
  TodoListRespSchema,
  TodoRespSchema,
} from '../../../schemas/routes.schema.js'

/**
 * demo Todo 资源。
 *
 * 目录即 URL：autoload 推导为 `/api/demo/v1/todos`，本文件只负责该资源。
 */
export const PERMS: { readonly [k: string]: PermissionRef } = Object.freeze({
  TODO_LIST: { code: 'demo:todos:list', label: '示例插件-Todo 示例-查看', group: 'demo' },
  TODO_CREATE: { code: 'demo:todos:create', label: '示例插件-Todo 示例-新建', group: 'demo' },
  TODO_UPDATE: { code: 'demo:todos:update', label: '示例插件-Todo 示例-编辑', group: 'demo' },
  TODO_DELETE: { code: 'demo:todos:delete', label: '示例插件-Todo 示例-删除', group: 'demo' },
})
registerPermissions(...Object.values(PERMS))

function TypeIdParams() {
  return Type.Object({ id: Type.String() })
}

export default (async (app) => {
  const route = createRouteRegistrar(app)
  const todos = new TodosService(drizzleDb)

  // Todo 列表
  route.get(
    '/',
    {
      access: { permission: PERMS.TODO_LIST },
      schema: {
        tags: [ROUTE_TAG],
        summary: 'Todo 列表',
        operationId: 'demoV1TodosList',
        response: { 200: TodoListRespSchema },
      },
    },
    async () => todos.list(),
  )

  // Todo 详情
  route.get(
    '/:id',
    {
      access: { permission: PERMS.TODO_LIST },
      schema: {
        tags: [ROUTE_TAG],
        summary: 'Todo 详情',
        operationId: 'demoV1TodosDetail',
        params: TypeIdParams(),
        response: { 200: TodoRespSchema },
      },
    },
    async (request) => {
      const id = (request.params as { id: string }).id
      return todos.findById(Number(id))
    },
  )

  // Todo 新建
  route.post(
    '/',
    {
      access: { permission: PERMS.TODO_CREATE },
      schema: {
        tags: [ROUTE_TAG],
        summary: 'Todo 新建',
        operationId: 'demoV1TodosCreate',
        body: TodoCreateReqSchema,
        response: { 200: TodoRespSchema },
      },
    },
    async (request) => todos.create(request.body as Parameters<TodosService['create']>[0]),
  )

  // Todo 更新
  route.patch(
    '/:id',
    {
      access: { permission: PERMS.TODO_UPDATE },
      schema: {
        tags: [ROUTE_TAG],
        summary: 'Todo 更新',
        operationId: 'demoV1TodosUpdate',
        params: TypeIdParams(),
        body: TodoUpdateReqSchema,
        response: { 200: TodoRespSchema },
      },
    },
    async (request) => {
      const id = (request.params as { id: string }).id
      return todos.update(Number(id), request.body as Parameters<TodosService['update']>[1])
    },
  )

  // Todo 删除
  route.delete(
    '/:id',
    {
      access: { permission: PERMS.TODO_DELETE },
      schema: {
        tags: [ROUTE_TAG],
        summary: 'Todo 删除',
        operationId: 'demoV1TodosDelete',
        params: TypeIdParams(),
        response: { 200: TodoRespSchema },
      },
    },
    async (request, reply) => {
      const id = (request.params as { id: string }).id
      await todos.remove(Number(id))
      reply.code(204)
      return null
    },
  )
}) as FastifyPluginAsync
