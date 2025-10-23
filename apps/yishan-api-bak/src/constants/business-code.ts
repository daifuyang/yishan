/**
 * 精简业务码系统
 * 统一成功码，分层错误码，自动映射HTTP状态
 */

import DateTimeUtil from "../utils/datetime.js";

// ============= 成功码 =============
export const SUCCESS_CODE = 10000;

// ============= 错误码 =============
export const ErrorCode = {
  // 系统错误 (20xxx)
  SYSTEM_ERROR: 20001,
  DATABASE_ERROR: 20002,
  NETWORK_ERROR: 20003,
  SERVICE_UNAVAILABLE: 20004,
  
  // 参数错误 (21xxx)
  INVALID_PARAMETER: 21001,
  MISSING_PARAMETER: 21002,
  VALIDATION_ERROR: 21003,
  
  // 权限错误 (22xxx)
  UNAUTHORIZED: 22001,
  TOKEN_EXPIRED: 22002,
  TOKEN_INVALID: 22003,
  FORBIDDEN: 22004,
  INSUFFICIENT_PERMISSIONS: 22005,
  
  // 请求错误 (23xxx)
  METHOD_NOT_ALLOWED: 23001,
  TOO_MANY_REQUESTS: 23002,
  REQUEST_ENTITY_TOO_LARGE: 23003,
  
  // 用户模块 (30xxx)
  USER_NOT_FOUND: 30001,
  USER_ALREADY_EXISTS: 30002,
  USER_ACCOUNT_LOCKED: 30003,
  USER_ACCOUNT_DISABLED: 30004,
  INVALID_CREDENTIALS: 30005,
  INVALID_PASSWORD_FORMAT: 30006,
  
  // 部门模块 (31xxx)
  DEPARTMENT_NOT_FOUND: 31001,
  DEPARTMENT_ALREADY_EXISTS: 31002,
  DEPARTMENT_HAS_CHILDREN: 31003,
  DEPARTMENT_HAS_USERS: 31004,
  
  // 角色模块 (32xxx)
  ROLE_NOT_FOUND: 32001,
  ROLE_ALREADY_EXISTS: 32002,
  ROLE_IN_USE: 32003,
} as const;

// ============= 错误信息映射 =============
export const ErrorMessages = {
  [ErrorCode.SYSTEM_ERROR]: '系统内部错误',
  [ErrorCode.DATABASE_ERROR]: '数据库操作失败',
  [ErrorCode.NETWORK_ERROR]: '网络连接错误',
  [ErrorCode.SERVICE_UNAVAILABLE]: '服务暂不可用',
  
  [ErrorCode.INVALID_PARAMETER]: '参数格式不正确',
  [ErrorCode.MISSING_PARAMETER]: '缺少必要参数',
  [ErrorCode.VALIDATION_ERROR]: '数据验证失败',
  
  [ErrorCode.UNAUTHORIZED]: '未授权访问',
  [ErrorCode.TOKEN_EXPIRED]: '访问令牌已过期',
  [ErrorCode.TOKEN_INVALID]: '访问令牌无效',
  [ErrorCode.FORBIDDEN]: '权限不足',
  [ErrorCode.INSUFFICIENT_PERMISSIONS]: '权限不足',
  
  [ErrorCode.METHOD_NOT_ALLOWED]: '请求方法不允许',
  [ErrorCode.TOO_MANY_REQUESTS]: '请求过于频繁',
  [ErrorCode.REQUEST_ENTITY_TOO_LARGE]: '请求实体过大',
  
  [ErrorCode.USER_NOT_FOUND]: '用户不存在',
  [ErrorCode.USER_ALREADY_EXISTS]: '用户已存在',
  [ErrorCode.USER_ACCOUNT_LOCKED]: '用户账户已锁定',
  [ErrorCode.USER_ACCOUNT_DISABLED]: '用户账户已禁用',
  [ErrorCode.INVALID_CREDENTIALS]: '用户名或密码错误',
  [ErrorCode.INVALID_PASSWORD_FORMAT]: '密码格式不正确',
  
  [ErrorCode.DEPARTMENT_NOT_FOUND]: '部门不存在',
  [ErrorCode.DEPARTMENT_ALREADY_EXISTS]: '部门已存在',
  [ErrorCode.DEPARTMENT_HAS_CHILDREN]: '部门下存在子部门',
  [ErrorCode.DEPARTMENT_HAS_USERS]: '部门下存在用户',
  
  [ErrorCode.ROLE_NOT_FOUND]: '角色不存在',
  [ErrorCode.ROLE_ALREADY_EXISTS]: '角色已存在',
  [ErrorCode.ROLE_IN_USE]: '角色正在使用中',
} as const;

// ============= HTTP状态码映射 =============
export const HttpStatusMap = {
  [SUCCESS_CODE]: 200,
  
  // 系统错误 -> 500
  [ErrorCode.SYSTEM_ERROR]: 500,
  [ErrorCode.DATABASE_ERROR]: 500,
  [ErrorCode.NETWORK_ERROR]: 500,
  [ErrorCode.SERVICE_UNAVAILABLE]: 503,
  
  // 参数错误 -> 400
  [ErrorCode.INVALID_PARAMETER]: 400,
  [ErrorCode.MISSING_PARAMETER]: 400,
  [ErrorCode.VALIDATION_ERROR]: 400,
  
  // 权限错误 -> 401/403
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.TOKEN_EXPIRED]: 401,
  [ErrorCode.TOKEN_INVALID]: 401,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.INSUFFICIENT_PERMISSIONS]: 403,
  
  // 请求错误
  [ErrorCode.METHOD_NOT_ALLOWED]: 405,
  [ErrorCode.TOO_MANY_REQUESTS]: 429,
  [ErrorCode.REQUEST_ENTITY_TOO_LARGE]: 413,
  
  // 业务错误 -> 400/404/409
  [ErrorCode.USER_NOT_FOUND]: 404,
  [ErrorCode.USER_ALREADY_EXISTS]: 409,
  [ErrorCode.USER_ACCOUNT_LOCKED]: 423,
  [ErrorCode.USER_ACCOUNT_DISABLED]: 423,
  [ErrorCode.INVALID_CREDENTIALS]: 401,
  [ErrorCode.INVALID_PASSWORD_FORMAT]: 400,
  
  [ErrorCode.DEPARTMENT_NOT_FOUND]: 404,
  [ErrorCode.DEPARTMENT_ALREADY_EXISTS]: 409,
  [ErrorCode.DEPARTMENT_HAS_CHILDREN]: 400,
  [ErrorCode.DEPARTMENT_HAS_USERS]: 400,
  
  [ErrorCode.ROLE_NOT_FOUND]: 404,
  [ErrorCode.ROLE_ALREADY_EXISTS]: 409,
  [ErrorCode.ROLE_IN_USE]: 400,
} as const;

// ============= 工具函数 =============
export class BusinessCode {
  /**
   * 获取错误信息
   */
  static getMessage(code: number): string {
    return ErrorMessages[code as keyof typeof ErrorMessages] || '未知错误';
  }
  
  /**
   * 获取HTTP状态码
   */
  static getHttpStatus(code: number): number {
    return HttpStatusMap[code as keyof typeof HttpStatusMap] || 200;
  }
  
  /**
   * 判断是否为成功码
   */
  static isSuccess(code: number): boolean {
    return code === SUCCESS_CODE;
  }
}

// ============= 响应构建器 =============
export class ResponseBuilder {
  /**
   * 构建成功响应
   */
  static success<T = any>(data?: T, message = '操作成功', requestId?: string) {
    const result = {
      code: SUCCESS_CODE,
      message,
      data: data ?? null,
      success: true,
      request_id: requestId,
      timestamp: DateTimeUtil.now()
    };
    
    return result;
  }
  
  /**
   * 构建错误响应
   */
  static error(code: number, message?: string, subCode?: string, requestId?: string) {
    return {
      code,
      message: message || BusinessCode.getMessage(code),
      data: null,
      success: false,
      sub_code: subCode,
      request_id: requestId,
      timestamp: DateTimeUtil.now()
    };
  }
}