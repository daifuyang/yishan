import { FastifyReply } from 'fastify';
import { SUCCESS_CODE, BusinessCode } from '@/constants/business-codes/index.js';

export class ResponseUtil {
  static success<T>(reply: FastifyReply, data: T, message = '操作成功') {
    return reply.send({
      success: true,
      code: SUCCESS_CODE,
      message,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  static paginated<T>(
    reply: FastifyReply,
    data: T[],
    page: number = 1,
    pageSize: number = 10,
    total: number,
    message = '获取成功'
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
    });
  }

  static error(
    reply: FastifyReply,
    code: number,
    message?: string,
    details?: string
  ) {
    const validCode = BusinessCode.isValidCode(code) ? code : 20001;
    const httpStatus = BusinessCode.getHttpStatus(validCode);

    return reply.code(httpStatus).send({
      success: false,
      code: validCode,
      message: message || BusinessCode.getMessage(validCode),
      data: null,
      error: details,
      timestamp: new Date().toISOString(),
    });
  }
}
