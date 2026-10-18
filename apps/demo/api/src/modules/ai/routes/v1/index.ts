import type { FastifyPluginAsync } from 'fastify'
import { Readable } from 'node:stream'
import { createRouteRegistrar } from '@yishan/core-api/routes/route-registrar'
import { ResponseUtil } from '@yishan/core-api/response'
import { drizzleDb } from '@yishan/core-system-api/database'
import { AiChatService } from '../../services/ai-chat.service.js'
import { AI_PERMISSION, AiChatBodySchema, AiConversationResponseSchema, AiDeleteResponseSchema, AiIdParamsSchema, AiListResponseSchema, AiTitleSchema, type AiChatBody } from '../../schemas/ai-chat.schema.js'
import { installAiErrorHandler } from '../../ai-chat-error.js'

export default (async app => {
  installAiErrorHandler(app)
  const route = createRouteRegistrar(app)
  const service = AiChatService.forDatabase(drizzleDb)
  const access = { permission: AI_PERMISSION }
  route.get('/conversations', { access, schema: { tags: ['ai'], summary: 'AI 会话列表', operationId: 'aiConversationsList', response: { 200: AiListResponseSchema } } }, async (request, reply) => ResponseUtil.success(reply, await service.list(request.currentUser.id)))
  route.post('/conversations', { access, schema: { tags: ['ai'], summary: '创建 AI 会话', operationId: 'aiConversationsCreate', response: { 200: AiConversationResponseSchema } } }, async (request, reply) => ResponseUtil.success(reply, await service.create(request.currentUser.id)))
  route.get<{ Params: { id: string } }>('/conversations/:id', { access, schema: { tags: ['ai'], summary: 'AI 会话详情', operationId: 'aiConversationsDetail', params: AiIdParamsSchema, response: { 200: AiConversationResponseSchema } } }, async (request, reply) => ResponseUtil.success(reply, await service.detail(request.currentUser.id, request.params.id)))
  route.patch<{ Params: { id: string }; Body: { title: string } }>('/conversations/:id', { access, schema: { tags: ['ai'], summary: '重命名 AI 会话', operationId: 'aiConversationsRename', params: AiIdParamsSchema, body: AiTitleSchema, response: { 200: AiConversationResponseSchema } } }, async (request, reply) => ResponseUtil.success(reply, await service.rename(request.currentUser.id, request.params.id, request.body.title)))
  route.delete<{ Params: { id: string } }>('/conversations/:id', { access, schema: { tags: ['ai'], summary: '删除 AI 会话', operationId: 'aiConversationsDelete', params: AiIdParamsSchema, response: { 200: AiDeleteResponseSchema } } }, async (request, reply) => ResponseUtil.success(reply, await service.remove(request.currentUser.id, request.params.id)))
  route.post<{ Body: AiChatBody }>('/chat', { access, bodyLimit: 262144, schema: { tags: ['ai'], summary: 'AI 消息流', operationId: 'aiChat', body: AiChatBodySchema } }, async (request, reply) => {
    const abort = new AbortController()
    const disconnect = () => { if (!reply.raw.writableFinished) abort.abort() }
    request.raw.once('aborted', disconnect)
    reply.raw.once('close', disconnect)
    try {
      // actor 来自已认证身份，模型与前端都无法指定。tokenScope 一并透传，
      // 执行链重算权限时 PAT 的收窄范围必须仍然生效。
      const currentUser = request.currentUser
      const response = await service.chat(request.currentUser.id, request.body, abort.signal, {
        userId: currentUser.id,
        roleIds: currentUser.roleIds ?? [],
        // 部门归属同样来自认证结果。行级数据范围解析「本部门 / 本部门及子部门 /
        // 自定义」档位时要用它；缺了它范围会算空，表现为 AI 什么都查不到。
        deptIds: currentUser.deptIds ?? [],
        tokenScope: request.tokenScope,
      })
      response.headers.forEach((value, key) => reply.header(key, value))
      // Fastify owns the stream lifecycle; the SDK consumes a second branch for terminal persistence.
      return reply.send(Readable.fromWeb(response.body!))
    } finally {
      if (reply.raw.writableFinished || abort.signal.aborted) {
        request.raw.off('aborted', disconnect)
        reply.raw.off('close', disconnect)
      }
    }
  })
}) satisfies FastifyPluginAsync
