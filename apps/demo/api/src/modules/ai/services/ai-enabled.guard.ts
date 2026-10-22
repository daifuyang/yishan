import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { SystemErrorCode } from '@yishan/core-api/business-codes'
import { AiSettingsService } from './ai-settings.service.js'

/**
 * AI 全局开关的守卫。
 *
 * `ai_model_settings.enabled` 关掉后，模块内除配置面以外的所有请求一律 503：
 * 会话、草稿、追问、聊天流都进不来，模型一次都不会被调用。开关的语义是
 * 「这个功能不存在」，所以前端隐藏浮窗只是表象，真正的边界在这里。
 *
 * 豁免 `/settings` 与 `/runtime-config`：关掉之后管理员仍要能进配置页把开关
 * 拨回去，而 `/runtime-config` 是前端判定要不要渲染浮窗的唯一信息来源。
 *
 * 直接 `reply.send` 而不抛 `AiChatError`：钩子挂在模块作用域上，而
 * `installAiErrorHandler` 只装在各路由文件自己的那层封装里，够不到这里。
 * 抛出去会落到全局处理器，503 被重映射成 500。
 */
const EXEMPT_ROUTES = [/\/settings$/, /\/settings\/test$/, /\/runtime-config$/]

function isExempt(request: FastifyRequest) {
  const pattern = request.routeOptions?.url ?? request.url
  return EXEMPT_ROUTES.some(route => route.test(pattern))
}

function disabled(reply: FastifyReply) {
  return reply.code(503).send({
    success: false,
    code: SystemErrorCode.SERVICE_UNAVAILABLE,
    message: 'AI 助手未启用',
    data: null,
    timestamp: new Date().toISOString(),
  })
}

/**
 * 直接往模块 router 上挂钩子，而不是 `router.register` 一个子插件：Fastify 的
 * 钩子只对**当前作用域及其子树**生效，兄弟插件互相看不见。模块路由是 router
 * 的子插件，所以在 router 上挂才盖得住它们 —— 与 Core 的模块启停守卫同一形状。
 *
 * 每次请求读一次开关，不做缓存：单行主键查询成本可忽略，而缓存会让「关掉之后
 * 仍能聊几秒」变成真问题。
 */
export function installAiEnabledGuard(router: FastifyInstance, settings: AiSettingsService) {
  router.addHook('onRequest', async (request, reply) => {
    if (isExempt(request)) return
    if (await settings.isEnabled()) return
    return disabled(reply)
  })
}