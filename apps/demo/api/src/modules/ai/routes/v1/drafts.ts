/**
 * drafts.ts — 草稿的 HTTP 端点。
 *
 * 权限与聊天同一个 `ai:chat:use`：草稿只对已经能使用助手的人开放；真正的业务授权
 * 仍然在保存与提交时按 Task 2 的规则重算。
 *
 * 请求/响应 schema 全部来自 `schemas/action-draft.schema.ts`：`formData` 在这里**只**
 * 强制键白名单与基本类型，半截手机号照收（由 Service 生成 validationErrors）；密码与
 * 未知字段在传输层就 400。
 */
import type { FastifyPluginAsync } from 'fastify'
import { createRouteRegistrar } from '@yishan/core-api/routes/route-registrar'
import { ResponseUtil } from '@yishan/core-api/response'
import { drizzleDb } from '@yishan/core-system-api/database'
import { ActionDraftService, type ActionDraft } from '../../services/action-draft.service.js'
import { AI_PERMISSION, AiIdParamsSchema } from '../../schemas/ai-chat.schema.js'
import { aiError, installAiErrorHandler } from '../../ai-chat-error.js'
import { draftFieldSchemas, listDraftAdapters } from '../../services/draft-forms.js'
import {
  ActionDraftCancelBodySchema,
  ActionDraftCreateTransportBodySchema,
  ActionDraftListResponseSchema,
  ActionDraftOkResponseSchema,
  ActionDraftPatchTransportBodySchema,
  ActionDraftResponseSchema,
  ActionDraftIdParamsSchema,
  matchesDraftFieldType,
  type ActionDraftCreateTransportBody,
  type ActionDraftPatchTransportBody,
} from '../../schemas/action-draft.schema.js'

type DraftIdParams = { Params: { draftId: string } }
type ConversationParams = { Params: { id: string } }

/** 时间统一成 ISO 字符串；草稿内部仍以 Date 参与过期比较。 */
function serialize(draft: ActionDraft) {
  return {
    ...draft,
    createdAt: draft.createdAt.toISOString(),
    updatedAt: draft.updatedAt.toISOString(),
    expiresAt: draft.expiresAt.toISOString(),
  }
}

/**
 * 传输层的硬边界必须在 `preValidation` 里自己判。
 *
 * Fastify 的 ajv 是**实例级**的：默认 `removeAdditional: true` 会把 `password`
 * 这类未登记字段**悄悄删掉**而不是 400，`coerceTypes: 'array'` 还会把 PATCH 里的
 * `null`（清空可选字段）压成 `""`。对聊天消息这是无害的清理，对草稿却正好相反：
 * 用户以为存下了、模型以为存下了，实际什么都没发生；而「清空」直接变成了「置空串」。
 * 逐路由的 `config.ajv` 在 Fastify 5 已经不生效，所以这里显式检查原始 body。
 * 挂在 `preValidation` 而不是 `preHandler`：前者跑在 body 校验**之前**，拿到的还是
 * 未经 ajv 强制转换的原始 JSON；等 `preHandler` 时 `null` 已经被压成 `""` 了。
 *
 * 只判「形状」：未知字段、`password`、错误的原始类型。半截手机号照放行 ——
 * 业务格式由 Service 用真实约束算成 `validationErrors`，并保留原值。
 */

function assertFormDataShape(body: unknown, allowNull: boolean, action?: string) {
  const formData = (body as { formData?: unknown } | undefined)?.formData
  if (formData === undefined) return
  // `formData: null` / 数组 / 字符串都要在这里判掉。`preValidation` 跑在 body 校验之前，
  // ajv 永远看不到它们，`Object.entries(null)` 抛出的 TypeError 没有 statusCode，
  // 会一路落到全局处理器变成 500 并刷错误日志。
  if (typeof formData !== 'object' || formData === null || Array.isArray(formData)) {
    throw aiError(400, '表单数据格式无效')
  }
  const actions = action ? [action] : listDraftAdapters().map(adapter => adapter.action)
  const rejected: string[] = []
  for (const [key, value] of Object.entries(formData)) {
    if (!actions.some(target => key in draftFieldSchemas(target))) { rejected.push(key); continue }
    if (value === null) {
      // 创建不接受 null：补丁里 null 是「清空」，保存时 null 没有这种语义。
      if (!allowNull) rejected.push(key)
      continue
    }
    if (value === undefined) continue
    // 类型判定来自 schema 派生的唯一清单（`matchesDraftFieldType`），与 Service 的
    // `normalize()` 同一个实现：新增数组字段不需要在这里补一份。
    if (!actions.some(target => matchesDraftFieldType(key, value, target))) rejected.push(key)
  }
  if (rejected.length) throw aiError(400, `不支持的字段：${[...new Set(rejected)].join('、')}`)
}

export default (async app => {
  installAiErrorHandler(app)
  app.addHook('preValidation', async request => {
    if (request.method !== 'POST' && request.method !== 'PATCH') return
    const action = request.method === 'POST' ? (request.body as { action?: string } | undefined)?.action : undefined
    assertFormDataShape(request.body, request.method === 'PATCH', action)
  })
  const route = createRouteRegistrar(app)
  const service = ActionDraftService.forDatabase(drizzleDb)
  const access = { permission: AI_PERMISSION }

  route.post<{ Params: { id: string }; Body: ActionDraftCreateTransportBody }>(
    '/conversations/:id/drafts',
    { access, schema: { tags: ['ai'], summary: '创建表单草稿', operationId: 'aiActionDraftCreate', params: AiIdParamsSchema, body: ActionDraftCreateTransportBodySchema, response: { 200: ActionDraftResponseSchema } } },
    async (request, reply) => ResponseUtil.success(reply, serialize(await service.create(request.currentUser.id, request.params.id, { ...request.body, subject: { actorId: request.currentUser.id, tokenScope: request.tokenScope } }))),
  )

  route.get<ConversationParams>(
    '/conversations/:id/drafts',
    { access, schema: { tags: ['ai'], summary: '会话草稿列表', operationId: 'aiActionDraftList', params: AiIdParamsSchema, response: { 200: ActionDraftListResponseSchema } } },
    async (request, reply) => ResponseUtil.success(reply, { items: (await service.list(request.currentUser.id, request.params.id)).map(serialize) }),
  )

  route.get<DraftIdParams>(
    '/drafts/:draftId',
    { access, schema: { tags: ['ai'], summary: '草稿详情', operationId: 'aiActionDraftDetail', params: ActionDraftIdParamsSchema, response: { 200: ActionDraftResponseSchema } } },
    async (request, reply) => ResponseUtil.success(reply, serialize(await service.get(request.currentUser.id, request.params.draftId))),
  )

  route.patch<DraftIdParams & { Body: ActionDraftPatchTransportBody }>(
    '/drafts/:draftId',
    { access, schema: { tags: ['ai'], summary: '按字段补丁更新草稿', operationId: 'aiActionDraftPatch', params: ActionDraftIdParamsSchema, body: ActionDraftPatchTransportBodySchema, response: { 200: ActionDraftResponseSchema } } },
    async (request, reply) => ResponseUtil.success(reply, serialize(await service.patch(request.currentUser.id, request.params.draftId, request.body.draftVersion, request.body.formData, { subject: { actorId: request.currentUser.id, tokenScope: request.tokenScope } }))),
  )

  route.post<DraftIdParams & { Body: { draftVersion: number } }>(
    '/drafts/:draftId/cancel',
    { access, schema: { tags: ['ai'], summary: '取消草稿', operationId: 'aiActionDraftCancel', params: ActionDraftIdParamsSchema, body: ActionDraftCancelBodySchema, response: { 200: ActionDraftOkResponseSchema } } },
    async (request, reply) => ResponseUtil.success(reply, { ok: Boolean(await service.cancel(request.currentUser.id, request.params.draftId, request.body.draftVersion)) }),
  )
}) satisfies FastifyPluginAsync

