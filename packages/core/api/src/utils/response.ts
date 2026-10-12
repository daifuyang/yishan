import { FastifyReply } from 'fastify';
import { SUCCESS_CODE, BusinessCode } from '../constants/business-codes/index.js';

// 简化的响应工具类
export class ResponseUtil {
  /**
   * 成功响应
   */
  static success<T>(reply: FastifyReply, data: T, message = '操作成功') {
    return reply.send({
      success: true,
      code: SUCCESS_CODE,
      message,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 分页响应
   */
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

  /**
   * 错误响应
   */
  static error(
    reply: FastifyReply,
    code: number,
    message?: string,
    details?: string
  ) {
    // 验证业务码是否有效，如果无效则使用系统错误码
    const validCode = BusinessCode.isValidCode(code) ? code : 20001; // SystemErrorCode.SYSTEM_ERROR
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