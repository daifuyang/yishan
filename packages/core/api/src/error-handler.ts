import fp from 'fastify-plugin'
import type { FastifyError } from 'fastify'
import { ResponseUtil } from './utils/response'
import { ValidationErrorCode } from './constants/business-codes/validation'
import { AuthErrorCode } from './constants/business-codes/auth'
import { ResourceErrorCode } from './constants/business-codes/resource'
import { SystemErrorCode } from './constants/business-codes/common'

export interface ErrorHandlerOptions {
  readonly production?: boolean
}

export const errorHandlerPlugin = fp<ErrorHandlerOptions>(async (fastify, options) => {
  fastify.setErrorHandler<FastifyError>(async (error, request, reply) => {
    fastify.log.error({ error: error.message, stack: error.stack, url: request.url, method: request.method, requestId: request.id }, 'Global error handler caught an error')
    if (reply.sent) return
    const business = error as { code?: unknown; message: string; details?: string }
    if (typeof business.code === 'number') {
      return ResponseUtil.error(reply, business.code, business.message, business.details)
    }
    if (error.statusCode) {
      const status = error.statusCode
      const code = status === 401 ? AuthErrorCode.UNAUTHORIZED
        : status === 403 ? AuthErrorCode.FORBIDDEN
        : status === 404 ? ResourceErrorCode.NOT_FOUND
        : status === 429 ? ValidationErrorCode.TOO_MANY_REQUESTS
        : status >= 400 && status < 500 ? ValidationErrorCode.INVALID_PARAMETER
        : SystemErrorCode.SYSTEM_ERROR
      return ResponseUtil.error(reply, code, error.message || '请求错误')
    }
    if (String(error.code ?? '').startsWith('ER_') || /Drizzle.*Error/i.test(error.name)) {
      return ResponseUtil.error(reply, SystemErrorCode.DATABASE_ERROR, '数据库操作失败')
    }
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return ResponseUtil.error(reply, SystemErrorCode.NETWORK_ERROR, '网络连接失败')
    }
    return ResponseUtil.error(reply, SystemErrorCode.SYSTEM_ERROR, options.production ? '服务器内部错误' : error.message)
  })
}, { name: 'error-handler' })
