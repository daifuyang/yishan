import fp from 'fastify-plugin'
import { FastifyInstance, FastifyError, FastifyRequest, FastifyReply } from 'fastify'
import { ResponseUtil } from '../../../utils/response.js'
import { BusinessError } from '../../../exceptions/business-error.js'
import { ValidationErrorCode } from '../../../constants/business-codes/validation.js'
import { AuthErrorCode } from '../../../constants/business-codes/auth.js'
import { ResourceErrorCode } from '../../../constants/business-codes/resource.js'
import { SystemErrorCode } from '../../../constants/business-codes/common.js'

/**
 * 判定 error 是否来自数据库层（MySQL / Drizzle）。
 *
 * 依据：MySQL 错误 code 以 `ER_` 开头（`ER_PARSE_ERROR`, `ER_NO_SUCH_TABLE` 等），
 * Drizzle 抛出的 DrizzleQueryError 也会透传上游 code。不再用 `error.message` 嗅探
 * 关键字（mysql / Drizzle），避免被业务数据里的字面量误命中。
 */
function isDatabaseError(error: any): boolean {
  const code = String(error?.code ?? '')
  if (code.startsWith('ER_')) return true
  if (code === 'ER_DUP_ENTRY') return true
  if (typeof error?.name === 'string' && /Drizzle.*Error/i.test(error.name)) return true
  return false
}

/**
 * 全局异常处理插件
 * 统一处理应用中的所有异常，避免在每个路由中重复异常处理逻辑
 *
 * Section 7：日志脱敏 — 不再把 request.body / Authorization 完整写入日志；
 * 字段级脱敏由 security plugin 提供。
 */
export default fp(async (fastify: FastifyInstance) => {
  // 设置全局错误处理器
  fastify.setErrorHandler(async (error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    // 记录错误日志（不输出 raw body / authorization）
    fastify.log.error({
      error: error.message,
      stack: error.stack,
      url: request.url,
      method: request.method,
      params: request.params,
      query: request.query,
      requestId: (request as { requestId?: string }).requestId ?? request.id,
    }, 'Global error handler caught an error')

    // 如果响应已经发送，直接返回
    if (reply.sent) {
      return
    }

    const anyError = error as any
    const hasBusinessCode = typeof anyError?.code === 'number'

    if (error instanceof BusinessError || hasBusinessCode) {
      return ResponseUtil.error(reply, anyError.code, anyError.message, anyError.details)
    }

    // 处理 Fastify 内置错误
    if (error.statusCode) {
      const statusCode = error.statusCode
      const message = error.message || "请求错误"

      // 根据HTTP状态码映射到对应的业务码
      let businessCode: number
      switch (statusCode) {
        case 400:
        case 422:
          businessCode = ValidationErrorCode.INVALID_PARAMETER
          break
        case 401:
          businessCode = AuthErrorCode.UNAUTHORIZED
          break
        case 403:
          businessCode = AuthErrorCode.FORBIDDEN
          break
        case 404:
          businessCode = ResourceErrorCode.NOT_FOUND
          break
        case 429:
          businessCode = ValidationErrorCode.TOO_MANY_REQUESTS
          break
        default:
          if (statusCode >= 400 && statusCode < 500) {
            businessCode = ValidationErrorCode.INVALID_PARAMETER
          } else {
            businessCode = SystemErrorCode.SYSTEM_ERROR
          }
      }

      return ResponseUtil.error(reply, businessCode, message)
    }

    // 处理数据库相关错误（按 code 前缀判定，不用 message 嗅探）
    if (isDatabaseError(error)) {
      return ResponseUtil.error(reply, SystemErrorCode.DATABASE_ERROR, "数据库操作失败")
    }

    // 处理网络相关错误
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return ResponseUtil.error(reply, SystemErrorCode.NETWORK_ERROR, "网络连接失败")
    }

    // 默认服务器内部错误
    return ResponseUtil.error(
      reply,
      SystemErrorCode.SYSTEM_ERROR,
      process.env.NODE_ENV === 'production' ? "服务器内部错误" : error.message
    )
  })
})
