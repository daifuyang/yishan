import { Type, type Static, type TSchema } from '@sinclair/typebox'
import type { PermissionRef } from '@yishan/core-api/permissions/catalog'
import type { UIMessage } from 'ai' with { 'resolution-mode': 'import' }

export type ChatMessage = UIMessage<{
  status?: 'complete' | 'aborted' | 'error'
  /** 本轮 token 用量。落库后用于成本核算，不参与业务逻辑。 */
  tokenUsage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number }
  /** 仅含计数和耗时，不含提示词、参数或业务数据。 */
  metrics?: { durationMs: number; toolCalls: number; modelCalls: number }
}>

export const AI_PERMISSION: PermissionRef = { code: 'ai:chat:use', label: 'AI 助手-使用', group: 'ai' }
const Id = Type.String({ minLength: 1, maxLength: 64, pattern: '^[a-zA-Z0-9_-]+$' })
export const AiIdParamsSchema = Type.Object({ id: Id })
export const AiTitleSchema = Type.Object({ title: Type.String({ minLength: 1, maxLength: 100 }) }, { additionalProperties: false })
export const AiChatBodySchema = Type.Object({
  id: Id,
  messages: Type.Array(Type.Unknown(), { maxItems: 200 }),
  trigger: Type.Union([Type.Literal('submit-message'), Type.Literal('regenerate-message')]),
  messageId: Type.Optional(Id),
}, { additionalProperties: false })
export type AiChatBody = Static<typeof AiChatBodySchema>
const AiMessageSchema = Type.Object({
  id: Id,
  role: Type.Union([Type.Literal('user'), Type.Literal('assistant')]),
  parts: Type.Array(Type.Record(Type.String(), Type.Unknown())),
  metadata: Type.Optional(Type.Object({
    status: Type.Optional(Type.Union([Type.Literal('complete'), Type.Literal('aborted'), Type.Literal('error')])),
    tokenUsage: Type.Optional(Type.Object({ inputTokens: Type.Optional(Type.Number()), outputTokens: Type.Optional(Type.Number()), totalTokens: Type.Optional(Type.Number()) })),
    metrics: Type.Optional(Type.Object({ durationMs: Type.Number(), toolCalls: Type.Number(), modelCalls: Type.Number() })),
  })),
})
const AiSummarySchema = Type.Object({ id: Id, title: Type.String(), createdAt: Type.String({ format: 'date-time' }), updatedAt: Type.String({ format: 'date-time' }) })
export const AiConversationSchema = Type.Intersect([AiSummarySchema, Type.Object({ messages: Type.Array(AiMessageSchema) })])
export function aiEnvelope(data: TSchema) { return Type.Object({ success: Type.Boolean(), code: Type.Number(), message: Type.String(), timestamp: Type.String(), data }) }
export const AiConversationResponseSchema = aiEnvelope(AiConversationSchema)
export const AiListResponseSchema = aiEnvelope(Type.Object({ items: Type.Array(AiSummarySchema) }))
export const AiDeleteResponseSchema = aiEnvelope(Type.Null())
