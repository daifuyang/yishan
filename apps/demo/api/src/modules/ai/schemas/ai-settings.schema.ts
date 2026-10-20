import { Type, type Static } from '@sinclair/typebox'
import type { PermissionRef } from '@yishan/core-api/permissions/catalog'
import { aiEnvelope } from './ai-chat.schema.js'

export const AI_SETTINGS_READ: PermissionRef = { code: 'ai:settings:read', label: 'AI 配置-查看', group: 'ai' }
export const AI_SETTINGS_UPDATE: PermissionRef = { code: 'ai:settings:update', label: 'AI 配置-修改', group: 'ai' }

export const AiSettingsInputSchema = Type.Object({
  baseUrl: Type.Optional(Type.String({ maxLength: 2048 })),
  model: Type.String({ maxLength: 255 }),
  apiKey: Type.Optional(Type.String({ maxLength: 4096, writeOnly: true })),
}, { additionalProperties: false })
export type AiSettingsInput = Static<typeof AiSettingsInputSchema>

const AiSettingsSchema = Type.Object({
  baseUrl: Type.String(),
  model: Type.String(),
  hasApiKey: Type.Boolean(),
  source: Type.Union([Type.Literal('database'), Type.Literal('environment'), Type.Literal('unconfigured')]),
})
export type AiSettingsResponse = Static<typeof AiSettingsSchema>
export const AiSettingsResponseSchema = aiEnvelope(AiSettingsSchema)
export const AiSettingsTestResponseSchema = aiEnvelope(Type.Object({ ok: Type.Boolean(), message: Type.String() }))
