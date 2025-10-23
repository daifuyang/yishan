import fp from 'fastify-plugin'
import { ResponseUtil } from '../../utils/response.js'
import { ErrorCode } from '../../constants/business-code.js'

export interface SupportPluginOptions {
  // Specify Support plugin options here
}

// 将 HTTP 状态码映射为业务码
function mapStatusToBusinessCode(status?: number): number {
  switch (status) {
    case 400:
      return ErrorCode.VALIDATION_ERROR
    case 401:
      return ErrorCode.UNAUTHORIZED
    case 403:
      return ErrorCode.FORBIDDEN
    case 404:
      return ErrorCode.USER_NOT_FOUND
    case 405:
      return ErrorCode.METHOD_NOT_ALLOWED
    case 409:
      return ErrorCode.USER_ALREADY_EXISTS
    case 413:
      return ErrorCode.REQUEST_ENTITY_TOO_LARGE
    case 429:
      return ErrorCode.TOO_MANY_REQUESTS
    case 503:
      return ErrorCode.SERVICE_UNAVAILABLE
    default:
      return ErrorCode.SYSTEM_ERROR
  }
}

// The use of fastify-plugin is required to be able
// to export the decorators to the outer scope
export default fp<SupportPluginOptions>(async (fastify, opts) => {
  // 保留示例装饰器
  fastify.decorate('someSupport', function () {
    return 'hugs'
  })

  // 统一响应的 reply 助手方法
  fastify.decorateReply('sendSuccess', function (this: any, data: any, message?: string) {
    return ResponseUtil.success(this, this.request, data, message)
  })

  fastify.decorateReply('sendCreated', function (this: any, data: any, message?: string) {
    return ResponseUtil.success(this, this.request, data, message)
  })

  fastify.decorateReply('sendUpdated', function (this: any, data?: any, message?: string) {
    return ResponseUtil.success(this, this.request, data, message)
  })

  fastify.decorateReply('sendDeleted', function (this: any, message?: string) {
    return ResponseUtil.success(this, this.request, null, message)
  })

  fastify.decorateReply('sendList', function (this: any, data: any[], message?: string) {
    return ResponseUtil.success(this, this.request, data, message)
  })

  fastify.decorateReply('sendPaginated', function (
    this: any,
    data: any[],
    total: number,
    page: number,
    pageSize: number,
    message?: string
  ) {
    return ResponseUtil.paginated(this, this.request, data, total, page, pageSize, message)
  })

  fastify.decorateReply('sendError', function (this: any, message?: string, statusCode?: number, error?: any) {
    const businessCode = mapStatusToBusinessCode(statusCode)
    const subCode = error?.code || undefined
    return ResponseUtil.error(this, this.request, businessCode, message, { subCode })
  })

  fastify.decorateReply('sendValidationError', function (this: any, validation: Record<string, string[]>, message?: string) {
    return ResponseUtil.validation(this, this.request, validation, message)
  })

  fastify.decorateReply('sendUnauthorized', function (this: any, message?: string) {
    return ResponseUtil.unauthorized(this, this.request, message)
  })

  fastify.decorateReply('sendForbidden', function (this: any, message?: string) {
    return ResponseUtil.forbidden(this, this.request, message)
  })

  fastify.decorateReply('sendTooManyRequests', function (this: any, message?: string) {
    return ResponseUtil.tooManyRequests(this, this.request, message)
  })

  fastify.decorateReply('sendServiceUnavailable', function (this: any, message?: string) {
    return ResponseUtil.serviceUnavailable(this, this.request, message)
  })
})

// When using .decorate you have to specify added properties for Typescript
declare module 'fastify' {
  export interface FastifyInstance {
    someSupport(): string;
  }
}
