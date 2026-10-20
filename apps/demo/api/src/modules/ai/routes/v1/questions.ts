import type { FastifyPluginAsync } from 'fastify'
import { Value } from '@sinclair/typebox/value'
import { createRouteRegistrar } from '@yishan/core-api/routes/route-registrar'
import { ResponseUtil } from '@yishan/core-api/response'
import { drizzleDb } from '@yishan/core-system-api/database'
import { ActionDraftService } from '../../services/action-draft.service.js'
import { DraftQuestionService } from '../../services/draft-question.service.js'
import { AI_PERMISSION } from '../../schemas/ai-chat.schema.js'
import { ActionDraftIdParamsSchema, ActionDraftResponseSchema } from '../../schemas/action-draft.schema.js'
import { DraftQuestionAnswerSchema, DraftQuestionQuerySchema, DraftQuestionListResponseSchema, type DraftQuestionAnswer } from '../../schemas/draft-question.schema.js'
import { aiError, installAiErrorHandler } from '../../ai-chat-error.js'

export default (async app => {
  installAiErrorHandler(app)
  const service = new DraftQuestionService(ActionDraftService.forDatabase(drizzleDb))
  const route = createRouteRegistrar(app)
  const access = { permission: AI_PERMISSION }
  route.get<{ Params: { draftId: string }; Querystring: { conversationId: string } }>(
    '/drafts/:draftId/questions',
    { access, schema: { tags: ['ai'], summary: '读取草稿待回答问题', operationId: 'aiDraftQuestions', params: ActionDraftIdParamsSchema, querystring: DraftQuestionQuerySchema, response: { 200: DraftQuestionListResponseSchema } } },
    async (request, reply) => ResponseUtil.success(reply, await service.list({ actorId: request.currentUser.id, tokenScope: request.tokenScope }, request.query.conversationId, request.params.draftId)),
  )
  app.addHook('preValidation', async request => {
    if (request.method === 'POST' && !Value.Check(DraftQuestionAnswerSchema, request.body)) throw aiError(400, '问题答案格式无效')
  })
  route.post<{ Params: { draftId: string }; Body: DraftQuestionAnswer }>(
    '/drafts/:draftId/questions/answer',
    { access, schema: { tags: ['ai'], summary: '回答问题并更新草稿', operationId: 'aiAnswerDraftQuestion', params: ActionDraftIdParamsSchema, body: DraftQuestionAnswerSchema, response: { 200: ActionDraftResponseSchema } } },
    async (request, reply) => {
      const draft = await service.answer({ actorId: request.currentUser.id, tokenScope: request.tokenScope }, request.params.draftId, request.body)
      return ResponseUtil.success(reply, { ...draft, createdAt: draft.createdAt.toISOString(), updatedAt: draft.updatedAt.toISOString(), expiresAt: draft.expiresAt.toISOString() })
    },
  )
}) satisfies FastifyPluginAsync
