import type { FastifyReply } from 'fastify'

export const SUCCESS_CODE = 10000
const SYSTEM_ERROR_CODE = 20001

function isValidBusinessCode(code: number): boolean {
  return code === SUCCESS_CODE || (Number.isInteger(code) && code >= 20000 && code < 100000)
}

function getHttpStatus(code: number): number {
  const overrides: Record<number, number> = {
    20004: 503,
    20005: 503,
    20006: 408,
    21007: 422,
    21008: 429,
    22002: 403,
    22008: 403,
    25001: 401,
    25002: 500,
    25003: 403,
    25004: 404,
    31001: 404,
    31002: 409,
    31003: 403,
    31004: 410,
    31005: 409,
    31006: 413,
    31007: 415,
    31008: 413,
    31009: 400,
  }
  if (overrides[code] !== undefined) return overrides[code]
  if (code === SUCCESS_CODE) return 200
  if (code >= 20000 && code < 21000) return 500
  if (code >= 21000 && code < 22000) return 400
  if (code >= 22000 && code < 23000) return 401
  if (code >= 30000 && code < 33000) return 200
  return 500
}

/** Response envelope helpers shared by core and runtime plugins. */
export class ResponseUtil {
  static success<T>(reply: FastifyReply, data: T, message = '操作成功') {
    return reply.send({
      success: true,
      code: SUCCESS_CODE,
      message,
      data,
      timestamp: new Date().toISOString(),
    })
  }

  static paginated<T>(
    reply: FastifyReply,
    data: T[],
    page = 1,
    pageSize = 10,
    total: number,
    message = '获取成功',
  ) {
    return reply.send({
      success: true,
      code: SUCCESS_CODE,
      message,
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
      timestamp: new Date().toISOString(),
    })
  }

  static error(
    reply: FastifyReply,
    code: number,
    message?: string,
    details?: string,
  ) {
    const validCode = isValidBusinessCode(code) ? code : SYSTEM_ERROR_CODE
    return reply.code(getHttpStatus(validCode)).send({
      success: false,
      code: validCode,
      message: message || (validCode === SYSTEM_ERROR_CODE ? '系统内部错误' : '未知错误'),
      data: null,
      error: details,
      timestamp: new Date().toISOString(),
    })
  }
}
