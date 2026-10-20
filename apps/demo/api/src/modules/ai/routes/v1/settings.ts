import type { FastifyPluginAsync } from 'fastify'
import { createRouteRegistrar } from '@yishan/core-api/routes/route-registrar'
import { ResponseUtil } from '@yishan/core-api/response'
import { drizzleDb } from '@yishan/core-system-api/database'
import { AiSettingsService } from '../../services/ai-settings.service.js'
import { testSavedAiConfiguration } from '../../services/ai-settings-connection.service.js'
import { AI_SETTINGS_READ, AI_SETTINGS_UPDATE, AiSettingsInputSchema, AiSettingsResponseSchema, AiSettingsTestResponseSchema, type AiSettingsInput } from '../../schemas/ai-settings.schema.js'
import { installAiErrorHandler } from '../../ai-chat-error.js'

export default (async app => {
  installAiErrorHandler(app)
  const route = createRouteRegistrar(app)
  const settings = AiSettingsService.forDatabase(drizzleDb)
  route.get('/settings', { access: { permission: AI_SETTINGS_READ }, schema: { tags: ['ai'], summary: '读取单模型 AI 配置', operationId: 'aiSettingsGet', response: { 200: AiSettingsResponseSchema } } }, async (_request, reply) => ResponseUtil.success(reply, await settings.read()))
  route.put<{ Body: AiSettingsInput }>('/settings', { access: { permission: AI_SETTINGS_UPDATE }, bodyLimit: 16384, schema: { tags: ['ai'], summary: '保存单模型 AI 配置', operationId: 'aiSettingsSave', body: AiSettingsInputSchema, response: { 200: AiSettingsResponseSchema } } }, async (request, reply) => ResponseUtil.success(reply, await settings.save(request.body, request.currentUser.id)))
  route.post('/settings/test', { access: { permission: AI_SETTINGS_UPDATE }, schema: { tags: ['ai'], summary: '测试已保存的 AI 配置', operationId: 'aiSettingsTest', response: { 200: AiSettingsTestResponseSchema } } }, async (_request, reply) => ResponseUtil.success(reply, await testSavedAiConfiguration(settings)))
}) satisfies FastifyPluginAsync
