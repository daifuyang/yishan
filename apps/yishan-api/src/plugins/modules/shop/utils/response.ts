import { FastifyReply } from 'fastify';
import { SUCCESS_CODE } from '../../../../constants/business-codes/index.js';

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
    message?: string,
    code?: number,
    details?: string
  ) {
    const validCode = code || 20001;
    return reply.code(500).send({
      success: false,
      code: validCode,
      message: message || '系统错误',
      data: null,
      error: details,
      timestamp: new Date().toISOString(),
    });
  }
}
