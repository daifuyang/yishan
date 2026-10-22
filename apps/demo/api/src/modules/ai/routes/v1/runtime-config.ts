import type { FastifyPluginAsync } from 'fastify'
import { createRouteRegistrar } from '@yishan/core-api/routes/route-registrar'
import { ResponseUtil } from '@yishan/core-api/response'
import { drizzleDb } from '@yishan/core-system-api/database'
import { AI_PERMISSION } from '../../schemas/ai-chat.schema.js'
import { AiRuntimeConfigResponseSchema } from '../../schemas/ai-settings.schema.js'
import { AiSettingsService } from '../../services/ai-settings.service.js'
import { installAiErrorHandler } from '../../ai-chat-error.js'

/**
 * 前端浮窗可见性判定所需的最小配置面。
 *
 * 用 `ai:chat:use` 而不是 `ai:settings:read`：只有助手使用权的用户要能读到
 * 「助手是不是开着」，读配置权限才能拨开关的人不该出现在这里。这里只返回
 * 布尔开关，模型、地址、密钥一概不出现在响应里。
 */
export default (async app => {
  installAiErrorHandler(app)
  const route = createRouteRegistrar(app)
  const settings = AiSettingsService.forDatabase(drizzleDb)
  route.get('/runtime-config', { access: { permission: AI_PERMISSION }, schema: { tags: ['ai'], summary: '读取 AI 运行时开关', operationId: 'aiRuntimeConfigGet', response: { 200: AiRuntimeConfigResponseSchema } } }, async (_request, reply) => ResponseUtil.success(reply, { enabled: await settings.isEnabled() }))
}) satisfies FastifyPluginAsync