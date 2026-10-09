import { type FastifyPluginAsync } from 'fastify'
import { createRouteRegistrar } from '@yishan/core-api/routes/route-registrar'
import { ResponseUtil } from '@yishan/core-api/response'
import { TaskService } from '../../../services/task.service.js'
import { TaskCreateReqSchema, TaskIdParamSchema, TaskListQuerySchema, TaskRespSchema, TaskUpdateReqSchema } from '../../../schemas/task.schema.js'
import { EnvelopeSchema, OkEnvelopeSchema, PaginatedEnvelopeSchema, ROUTE_TAG } from '../../../schemas/routes.schema.js'
import { CrmPermissions as PERMS } from '../../../schemas/permissions.js'
export default (async (app) => { const route = createRouteRegistrar(app); const service = new TaskService()
  route.get('/', { access: { permission: PERMS.TASK_LIST }, schema: { tags: [ROUTE_TAG], querystring: TaskListQuerySchema, response: { 200: PaginatedEnvelopeSchema(TaskRespSchema) } } }, async (request: any, reply: any) => { const result = await service.list(request.query, request.currentUser); return ResponseUtil.paginated(reply, result.items, result.page, result.pageSize, result.total) })
  route.post('/', { access: { permission: PERMS.TASK_CREATE }, schema: { tags: [ROUTE_TAG], body: TaskCreateReqSchema, response: { 200: EnvelopeSchema(TaskRespSchema) } } }, async (request: any, reply: any) => ResponseUtil.success(reply, await service.create({ ...request.body, status: request.body.status ?? 'todo', assigneeUserId: request.body.assigneeUserId ?? null, dueAt: request.body.dueAt ? new Date(request.body.dueAt) : null, description: request.body.description ?? null }, request.currentUser)))
  route.get('/:id', { access: { permission: PERMS.TASK_LIST }, schema: { tags: [ROUTE_TAG], params: TaskIdParamSchema, response: { 200: EnvelopeSchema(TaskRespSchema) } } }, async (request: any, reply: any) => ResponseUtil.success(reply, await service.detail(request.params.id, request.currentUser)))
  route.patch('/:id', { access: { permission: PERMS.TASK_UPDATE }, schema: { tags: [ROUTE_TAG], params: TaskIdParamSchema, body: TaskUpdateReqSchema, response: { 200: EnvelopeSchema(TaskRespSchema) } } }, async (request: any, reply: any) => ResponseUtil.success(reply, await service.update(request.params.id, request.body, request.currentUser)))
  route.delete('/:id', { access: { permission: PERMS.TASK_DELETE }, schema: { tags: [ROUTE_TAG], params: TaskIdParamSchema, response: { 200: OkEnvelopeSchema } } }, async (request: any, reply: any) => { await service.remove(request.params.id, request.currentUser); return ResponseUtil.success(reply, null) })
}) as FastifyPluginAsync
