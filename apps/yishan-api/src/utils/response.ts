/**
 * 统一响应工具类
 * 提供标准化的响应格式处理方法，基于业务码体系
 */

import { FastifyReply, FastifyRequest } from 'fastify'
import { randomUUID } from 'node:crypto'
import { DateTimeUtil } from './datetime.js'
import {
  BaseResponse,
  SuccessResponse,
  ErrorResponse,
  PaginatedResponse,
  ListResponse,
  PaginatedData,
  BusinessCode,
  ResponseMessage
} from '../types/response.js'

/**
 * 响应工具类
 * 支持业务码与HTTP状态码分离，默认业务码为20000
 */
export class ResponseUtil {
  /**
   * 默认业务成功码
   */
  static readonly DEFAULT_SUCCESS_CODE = BusinessCode.SUCCESS

  /**
   * 创建基础响应对象
   */
  private static createBaseResponse(
    request: FastifyRequest,
    code: number,
    message: string
  ): BaseResponse {
    return {
      code,
      message,
      timestamp: DateTimeUtil.timestamp(),
      requestId: request.id || randomUUID(),
      path: request.url,
      method: request.method
    }
  }

  /**
   * 发送成功响应
   * @param businessCode 业务码（5位数字，默认为20000）
   * @param httpStatus HTTP状态码（可选，如果不传则根据业务码自动映射）
   */
  static send<T = any>(
    reply: FastifyReply,
    request: FastifyRequest,
    data: T,
    message: string = ResponseMessage.SUCCESS,
    businessCode: number = this.DEFAULT_SUCCESS_CODE,
    httpStatus?: number
  ): FastifyReply {
    const statusCode = httpStatus || this.getHttpStatusFromBusinessCode(businessCode)
    const response = {
      ...this.createBaseResponse(request, businessCode, message),
      data
    } as SuccessResponse<T>

    return reply.code(statusCode).send(response)
  }

  /**
   * 根据业务码获取HTTP状态码
   */
  private static getHttpStatusFromBusinessCode(businessCode: number): number {
    const prefix = Math.floor(businessCode / 10000)
    
    switch (prefix) {
      case 2: // 成功状态
        return 200
      case 4: // 客户端错误
        return 400
      case 5: // 服务器错误
        return 500
      default:
        return 200
    }
  }

  /**
   * 发送创建成功响应
   */
  static created<T = any>(
    reply: FastifyReply,
    request: FastifyRequest,
    data: T,
    message: string = ResponseMessage.CREATED
  ): FastifyReply {
    return this.send(reply, request, data, message, BusinessCode.CREATED)
  }

  /**
   * 发送更新成功响应
   */
  static updated<T = any>(
    reply: FastifyReply,
    request: FastifyRequest,
    data?: T,
    message: string = ResponseMessage.UPDATED
  ): FastifyReply {
    return this.send(reply, request, data, message, BusinessCode.UPDATED)
  }

  /**
   * 发送删除成功响应
   */
  static deleted(
    reply: FastifyReply,
    request: FastifyRequest,
    message: string = ResponseMessage.DELETED
  ): FastifyReply {
    return this.send(reply, request, null, message, BusinessCode.DELETED)
  }

  /**
   * 发送列表响应
   * @param businessCode 业务码（5位数字，默认为20000）
   * @param httpStatus HTTP状态码（可选，如果不传则根据业务码自动映射）
   */
  static list<T = any>(
    reply: FastifyReply,
    request: FastifyRequest,
    data: T[],
    message: string = ResponseMessage.SUCCESS,
    businessCode: number = this.DEFAULT_SUCCESS_CODE,
    httpStatus?: number
  ): FastifyReply {
    const statusCode = httpStatus || this.getHttpStatusFromBusinessCode(businessCode)
    const response = {
      ...this.createBaseResponse(request, businessCode, message),
      data
    } as ListResponse<T>

    return reply.code(statusCode).send(response)
  }

  /**
   * 发送分页响应
   * @param businessCode 业务码（5位数字，默认为20000）
   * @param httpStatus HTTP状态码（可选，如果不传则根据业务码自动映射）
   */
  static paginated<T = any>(
    reply: FastifyReply,
    request: FastifyRequest,
    data: T[],
    total: number,
    page: number,
    pageSize: number,
    message: string = ResponseMessage.SUCCESS,
    businessCode: number = this.DEFAULT_SUCCESS_CODE,
    httpStatus?: number
  ): FastifyReply {
    const totalPages = Math.ceil(total / pageSize)
    const hasNext = page < totalPages
    const hasPrev = page > 1

    const paginatedData: PaginatedData<T> = {
      list: data,
      total,
      page,
      pageSize,
      totalPages,
      hasNext,
      hasPrev
    }

    const statusCode = httpStatus || this.getHttpStatusFromBusinessCode(businessCode)
    const response = {
      ...this.createBaseResponse(request, businessCode, message),
      data: paginatedData
    } as PaginatedResponse<T>

    return reply.code(statusCode).send(response)
  }

  /**
   * 发送错误响应
   * @param businessCode 业务码（5位数字，默认为50000）
   * @param httpStatus HTTP状态码（可选，如果不传则根据业务码自动映射）
   */
  static error(
    reply: FastifyReply,
    request: FastifyRequest,
    message: string = ResponseMessage.INTERNAL_SERVER_ERROR,
    businessCode: number = BusinessCode.SYSTEM_ERROR,
    error?: any,
    httpStatus?: number
  ): FastifyReply {
    const statusCode = httpStatus || this.getHttpStatusFromBusinessCode(businessCode)
    const response = {
      ...this.createBaseResponse(request, businessCode, message),
      data: null,
      error: {
        type: error?.name || 'SystemError',
        description: error?.message || message,
        ...(process.env.NODE_ENV !== 'production' && error?.stack ? { stack: error.stack } : {}),
        ...(error?.validation ? { validation: error.validation } : {}),
        errorId: request.id || randomUUID()
      }
    } as ErrorResponse

    return reply.code(statusCode).send(response)
  }

  /**
   * 发送验证错误响应
   */
  static validationError(
    reply: FastifyReply,
    request: FastifyRequest,
    validation: Record<string, string[]>,
    message: string = ResponseMessage.VALIDATION_ERROR
  ): FastifyReply {
    return this.error(reply, request, message, BusinessCode.VALIDATION_ERROR, {
      name: 'ValidationError',
      message,
      validation
    })
  }

  /**
   * 发送未授权响应
   */
  static unauthorized(
    reply: FastifyReply,
    request: FastifyRequest,
    message: string = ResponseMessage.UNAUTHORIZED
  ): FastifyReply {
    return this.error(reply, request, message, BusinessCode.UNAUTHORIZED)
  }

  /**
   * 发送权限不足响应
   */
  static forbidden(
    reply: FastifyReply,
    request: FastifyRequest,
    message: string = ResponseMessage.FORBIDDEN
  ): FastifyReply {
    return this.error(reply, request, message, BusinessCode.FORBIDDEN)
  }

  /**
   * 发送资源不存在响应
   */
  static notFound(
    reply: FastifyReply,
    request: FastifyRequest,
    message: string = ResponseMessage.NOT_FOUND
  ): FastifyReply {
    return this.error(reply, request, message, BusinessCode.NOT_FOUND)
  }

  /**
   * 发送请求过于频繁响应
   */
  static tooManyRequests(
    reply: FastifyReply,
    request: FastifyRequest,
    message: string = '请求过于频繁'
  ): FastifyReply {
    return this.error(reply, request, message, 42900)
  }

  /**
   * 发送服务不可用响应
   */
  static serviceUnavailable(
    reply: FastifyReply,
    request: FastifyRequest,
    message: string = ResponseMessage.INTERNAL_SERVER_ERROR
  ): FastifyReply {
    return this.error(reply, request, message, BusinessCode.SYSTEM_ERROR)
  }
}

/**
 * 响应装饰器
 * 为FastifyReply添加响应方法
 */
export function decorateReply(fastify: any) {
  fastify.decorateReply('sendSuccess', function<T>(
    this: FastifyReply,
    data: T,
    message?: string,
    code: number = ResponseUtil.DEFAULT_SUCCESS_CODE
  ): FastifyReply {
    return ResponseUtil.send(this, this.request, data, message, code)
  })

  fastify.decorateReply('sendCreated', function<T>(
    this: FastifyReply,
    data: T,
    message?: string
  ): FastifyReply {
    return ResponseUtil.created(this, this.request, data, message)
  })

  fastify.decorateReply('sendUpdated', function<T>(
    this: FastifyReply,
    data?: T,
    message?: string
  ): FastifyReply {
    return ResponseUtil.updated(this, this.request, data, message)
  })

  fastify.decorateReply('sendDeleted', function(
    this: FastifyReply,
    message?: string
  ): FastifyReply {
    return ResponseUtil.deleted(this, this.request, message)
  })

  fastify.decorateReply('sendList', function<T>(
    this: FastifyReply,
    data: T[],
    message?: string,
    code: number = ResponseUtil.DEFAULT_SUCCESS_CODE
  ): FastifyReply {
    return ResponseUtil.list(this, this.request, data, message, code)
  })

  fastify.decorateReply('sendPaginated', function<T>(
    this: FastifyReply,
    data: T[],
    total: number,
    page: number,
    pageSize: number,
    message?: string,
    code: number = ResponseUtil.DEFAULT_SUCCESS_CODE
  ): FastifyReply {
    return ResponseUtil.paginated(this, this.request, data, total, page, pageSize, message, code)
  })

  fastify.decorateReply('sendError', function(
    this: FastifyReply,
    message?: string,
    code?: number,
    error?: any
  ): FastifyReply {
    return ResponseUtil.error(this, this.request, message, code, error)
  })

  fastify.decorateReply('sendValidationError', function(
    this: FastifyReply,
    validation: Record<string, string[]>,
    message?: string
  ): FastifyReply {
    return ResponseUtil.validationError(this, this.request, validation, message)
  })

  fastify.decorateReply('sendUnauthorized', function(
    this: FastifyReply,
    message?: string
  ): FastifyReply {
    return ResponseUtil.unauthorized(this, this.request, message)
  })

  fastify.decorateReply('sendForbidden', function(
    this: FastifyReply,
    message?: string
  ): FastifyReply {
    return ResponseUtil.forbidden(this, this.request, message)
  })

  fastify.decorateReply('sendNotFound', function(
    this: FastifyReply,
    message?: string
  ): FastifyReply {
    return ResponseUtil.notFound(this, this.request, message)
  })

  fastify.decorateReply('sendTooManyRequests', function(
    this: FastifyReply,
    message?: string
  ): FastifyReply {
    return ResponseUtil.tooManyRequests(this, this.request, message)
  })

  fastify.decorateReply('sendServiceUnavailable', function(
    this: FastifyReply,
    message?: string
  ): FastifyReply {
    return ResponseUtil.serviceUnavailable(this, this.request, message)
  })
}