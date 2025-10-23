/**
 * 精简响应工具类
 * 统一API设计，自动处理HTTP状态码映射
 */

import { FastifyReply, FastifyRequest } from 'fastify'
import { ErrorCode, ResponseBuilder, BusinessCode } from '../constants/business-code.js'

/**
 * 响应选项接口
 */
interface ResponseOptions {
  error?: any
  subCode?: string
  requestId?: string
}

/**
 * 精简响应工具类
 */
export class ResponseUtil {
  /**
   * 发送成功响应（统一要求传入 request）
   */
  static success<T = any>(
    reply: FastifyReply,
    request: FastifyRequest,
    data?: T,
    message = '操作成功'
  ): FastifyReply {
    const response = ResponseBuilder.success(data, message, getRequestId(reply, request))
    return reply.status(200).send(response)
  }

  /**
   * 发送错误响应（统一要求传入 request）
   */
  static error(
    reply: FastifyReply,
    request: FastifyRequest,
    code: number,
    message?: string,
    options: ResponseOptions = {}
  ): FastifyReply {
    const response = ResponseBuilder.error(
      code,
      message,
      options.subCode,
      getRequestId(reply, request, options.requestId)
    )
    const httpStatus = BusinessCode.getHttpStatus(code)
    return reply.status(httpStatus).send(response)
  }

  /**
   * 发送分页响应（统一要求传入 request）
   */
  static paginated<T = any>(
    reply: FastifyReply,
    request: FastifyRequest,
    data: T[],
    total: number,
    page: number,
    pageSize: number,
    message = '获取成功'
  ): FastifyReply {
    const response = ResponseBuilder.success({
      list: data,
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      }
    }, message, getRequestId(reply, request))
    return reply.status(200).send(response)
  }

  /**
   * 发送验证错误响应
   */
  static validation(
    reply: FastifyReply,
    request: FastifyRequest,
    validation: Record<string, string[]>,
    message = '数据验证失败'
  ): FastifyReply {
    const validationMessage = Object.entries(validation)
      .map(([field, errors]) => `${field}: ${errors.join(', ')}`)
      .join('; ')
    
    return this.error(reply, request, ErrorCode.VALIDATION_ERROR, message, {
      subCode: validationMessage
    })
  }

  // ============= 便捷方法（统一要求传入 request） =============
  
  /** 未授权 */
  static unauthorized(
    reply: FastifyReply,
    request: FastifyRequest,
    message = '未授权访问'
  ): FastifyReply {
    return this.error(reply, request, ErrorCode.UNAUTHORIZED, message)
  }

  /** 权限不足 */
  static forbidden(
    reply: FastifyReply,
    request: FastifyRequest,
    message = '权限不足'
  ): FastifyReply {
    return this.error(reply, request, ErrorCode.FORBIDDEN, message)
  }

  /** 请求过于频繁 */
  static tooManyRequests(
    reply: FastifyReply,
    request: FastifyRequest,
    message = '请求过于频繁'
  ): FastifyReply {
    return this.error(reply, request, ErrorCode.TOO_MANY_REQUESTS, message)
  }

  /** 服务不可用 */
  static serviceUnavailable(
    reply: FastifyReply,
    request: FastifyRequest,
    message = '服务暂不可用'
  ): FastifyReply {
    return this.error(reply, request, ErrorCode.SERVICE_UNAVAILABLE, message)
  }
}

// 统一提取 requestId 的辅助函数，优先使用传入的 request，其次使用 reply.request
 function getRequestId(reply: FastifyReply, request?: FastifyRequest, override?: string): string | undefined {
   return override ?? request?.id ?? (reply as any)?.request?.id
 }