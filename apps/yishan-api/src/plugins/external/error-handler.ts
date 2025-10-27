import fp from 'fastify-plugin'
import { FastifyInstance, FastifyError, FastifyRequest, FastifyReply } from 'fastify'
import { ResponseUtil } from '../../utils/response.js'
import { BusinessError } from '../../exceptions/business-error.js'

/**
 * 全局异常处理插件
 * 统一处理应用中的所有异常，避免在每个路由中重复异常处理逻辑
 */
export default fp(async (fastify: FastifyInstance) => {
  // 设置全局错误处理器
  fastify.setErrorHandler(async (error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    // 记录错误日志
    fastify.log.error({
      error: error.message,
      stack: error.stack,
      url: request.url,
      method: request.method,
      params: request.params,
      query: request.query,
      body: request.body
    }, 'Global error handler caught an error')

    // 如果响应已经发送，直接返回
    if (reply.sent) {
      return
    }

    // 处理业务异常
    if (error instanceof BusinessError) {
      return ResponseUtil.error(reply, error.code, error.message, error.details)
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
          businessCode = 21001 // ValidationErrorCode.INVALID_PARAMETER
          break
        case 401:
          businessCode = 22001 // AuthErrorCode.UNAUTHORIZED
          break
        case 403:
          businessCode = 22002 // AuthErrorCode.FORBIDDEN
          break
        case 404:
          businessCode = 31001 // ResourceErrorCode.NOT_FOUND
          break
        case 429:
          businessCode = 20004 // SystemErrorCode.TOO_MANY_REQUESTS
          break
        default:
          if (statusCode >= 400 && statusCode < 500) {
            businessCode = 21001 // ValidationErrorCode.INVALID_PARAMETER
          } else {
            businessCode = 20001 // SystemErrorCode.SYSTEM_ERROR
          }
      }
      
      return ResponseUtil.error(reply, businessCode, message)
    }

    // 处理数据库相关错误
    if (error.name === 'PrismaClientKnownRequestError' || 
        error.message.includes('Prisma') || 
        error.message.includes('database')) {
      return ResponseUtil.error(reply, 20002, "数据库操作失败") // SystemErrorCode.DATABASE_ERROR
    }

    // 处理网络相关错误
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return ResponseUtil.error(reply, 20003, "网络连接失败") // SystemErrorCode.NETWORK_ERROR
    }

    // 默认服务器内部错误
    return ResponseUtil.error(
      reply, 
      20001, // SystemErrorCode.SYSTEM_ERROR
      process.env.NODE_ENV === 'development' ? error.message : "服务器内部错误"
    )
  })

  // 添加 onRequest 钩子来包装路由处理器，自动捕获异步异常
  fastify.addHook('onRequest', async (request, reply) => {
    // 为每个请求添加错误处理上下文
    request.errorContext = {
      startTime: Date.now(),
      requestId: request.id
    }
  })

  // 添加 preHandler 钩子来处理参数验证
  fastify.addHook('preHandler', async (request, reply) => {
    // 这里可以添加通用的参数验证逻辑
  })
})

// 扩展 FastifyRequest 类型以包含错误上下文
declare module 'fastify' {
  interface FastifyRequest {
    errorContext?: {
      startTime: number
      requestId: string
    }
  }
}