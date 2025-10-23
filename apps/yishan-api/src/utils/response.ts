import { FastifyReply } from 'fastify';
import { SUCCESS_CODE, BusinessCode } from '../constants/business-code.js';

// 基础响应接口
export interface BaseResponse<T = any> {
  success: boolean;
  code: number;
  message: string;
  data: T;
  timestamp?: string;
}

// 分页响应接口
export interface PaginatedResponse<T = any> extends BaseResponse<T[]> {
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

// 错误响应接口
export interface ErrorResponse extends BaseResponse<null> {
  error?: {
    details?: string;
    stack?: string;
    validation?: Record<string, string[]>;
  };
}

export class ResponseUtil {
  /**
   * 成功响应
   */
  static success<T>(data: T, message = '操作成功'): BaseResponse<T> {
    return {
      success: true,
      code: SUCCESS_CODE,
      message,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 分页成功响应
   */
  static paginated<T>(
    data: T[],
    page: number,
    pageSize: number,
    total: number,
    message = '获取成功'
  ): PaginatedResponse<T> {
    return {
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
    };
  }

  /**
   * 错误响应
   */
  static error(
    code: number,
    message?: string,
    details?: string,
    validation?: Record<string, string[]>
  ): ErrorResponse {
    return {
      success: false,
      code,
      message: message || BusinessCode.getMessage(code),
      data: null,
      error: {
        details,
        validation,
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 发送成功响应
   */
  static sendSuccess<T>(
    reply: FastifyReply,
    data: T,
    message = '操作成功'
  ): FastifyReply {
    return reply.code(200).send(this.success(data, message));
  }

  /**
   * 发送分页响应
   */
  static sendPaginated<T>(
    reply: FastifyReply,
    data: T[],
    page: number,
    pageSize: number,
    total: number,
    message = '获取成功'
  ): FastifyReply {
    return reply.code(200).send(this.paginated(data, page, pageSize, total, message));
  }

  /**
   * 发送错误响应
   */
  static sendError(
    reply: FastifyReply,
    code: number,
    message?: string,
    details?: string,
    validation?: Record<string, string[]>
  ): FastifyReply {
    const httpStatus = BusinessCode.getHttpStatus(code);
    return reply.code(httpStatus).send(this.error(code, message, details, validation));
  }
}