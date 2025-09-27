/**
 * 全局业务码定义
 * 业务码与HTTP状态码分离，采用5位数字格式
 * 
 * 编码规则：
 * - 第1位：业务模块标识
 *   - 1: 系统模块
 *   - 2: 用户模块
 *   - 3: 订单模块
 *   - 4: 商品模块
 *   - 5: 支付模块
 *   - 9: 通用模块
 * 
 * - 第2-3位：业务功能标识
 * - 第4-5位：具体状态标识
 * 
 * 状态码范围：
 * - 20000-29999: 成功状态
 * - 40000-49999: 客户端错误
 * - 50000-59999: 服务器错误
 */

/**
 * 通用业务码
 */
export enum CommonBusinessCode {
  // 成功状态码
  SUCCESS = 20000,
  CREATED = 20001,
  UPDATED = 20002,
  DELETED = 20003,
  OPERATION_SUCCESS = 20004,
  
  // 客户端错误
  BAD_REQUEST = 40000,
  UNAUTHORIZED = 40001,
  FORBIDDEN = 40002,
  NOT_FOUND = 40003,
  METHOD_NOT_ALLOWED = 40004,
  CONFLICT = 40005,
  UNPROCESSABLE_ENTITY = 40006,
  TOO_MANY_REQUESTS = 40007,
  
  // 服务器错误
  INTERNAL_SERVER_ERROR = 50000,
  SERVICE_UNAVAILABLE = 50001,
  BAD_GATEWAY = 50002,
  GATEWAY_TIMEOUT = 50003
}

/**
 * 用户模块业务码
 */
export enum UserBusinessCode {
  // 成功状态码
  USER_CREATED = 20010,
  USER_RETRIEVED = 20011,
  USERS_RETRIEVED = 20012,
  USER_UPDATED = 20013,
  USER_DELETED = 20014,
  USER_LOGIN_SUCCESS = 20015,
  USER_LOGOUT_SUCCESS = 20016,
  USER_PASSWORD_CHANGED = 20017,
  USER_PROFILE_UPDATED = 20018,
  CACHE_CLEARED = 20019,
  USER_LIST_SUCCESS = 20020,
  USER_DETAIL_SUCCESS = 20021,
  USER_STATUS_CHANGED = 20022,
  PASSWORD_RESET_SUCCESS = 20023,
  
  // 客户端错误
  USER_NOT_FOUND = 40010,
  USER_ALREADY_EXISTS = 40011,
  INVALID_USER_ID = 40012,
  INVALID_EMAIL_FORMAT = 40013,
  INVALID_PASSWORD_FORMAT = 40014,
  USER_DISABLED = 40015,
  USER_NOT_ACTIVATED = 40016,
  INVALID_CREDENTIALS = 40017,
  TOKEN_EXPIRED = 40018,
  TOKEN_INVALID = 40019,
  USER_VERSION_CONFLICT = 40020,
  
  // 服务器错误
  USER_CREATE_FAILED = 50010,
  USER_UPDATE_FAILED = 50011,
  USER_DELETE_FAILED = 50012,
  USER_FETCH_FAILED = 50013,
  USER_LOGIN_FAILED = 50014,
  USER_LOGOUT_FAILED = 50015,
  PASSWORD_CHANGE_FAILED = 50016,
  PROFILE_UPDATE_FAILED = 50017,
  CACHE_CLEAR_FAILED = 50018,
  TOKEN_GENERATION_FAILED = 50019,
  USER_LIST_FAILED = 50020,
  USER_DETAIL_FAILED = 50021,
  USER_STATUS_CHANGE_FAILED = 50022,
  PASSWORD_RESET_FAILED = 50023
}

/**
 * 订单模块业务码
 */
export enum OrderBusinessCode {
  // 成功状态码
  ORDER_CREATED = 20020,
  ORDER_RETRIEVED = 20021,
  ORDERS_RETRIEVED = 20022,
  ORDER_UPDATED = 20023,
  ORDER_CANCELLED = 20024,
  ORDER_CONFIRMED = 20025,
  ORDER_SHIPPED = 20026,
  ORDER_DELIVERED = 20027,
  
  // 客户端错误
  ORDER_NOT_FOUND = 40020,
  ORDER_ALREADY_EXISTS = 40021,
  INVALID_ORDER_ID = 40022,
  ORDER_STATUS_INVALID = 40023,
  ORDER_CANNOT_BE_CANCELLED = 40024,
  ORDER_CANNOT_BE_UPDATED = 40025,
  
  // 服务器错误
  ORDER_CREATE_FAILED = 50020,
  ORDER_UPDATE_FAILED = 50021,
  ORDER_CANCEL_FAILED = 50022,
  ORDER_FETCH_FAILED = 50023
}

/**
 * 商品模块业务码
 */
export enum ProductBusinessCode {
  // 成功状态码
  PRODUCT_CREATED = 20030,
  PRODUCT_RETRIEVED = 20031,
  PRODUCTS_RETRIEVED = 20032,
  PRODUCT_UPDATED = 20033,
  PRODUCT_DELETED = 20034,
  INVENTORY_UPDATED = 20035,
  
  // 客户端错误
  PRODUCT_NOT_FOUND = 40030,
  PRODUCT_ALREADY_EXISTS = 40031,
  INVALID_PRODUCT_ID = 40032,
  PRODUCT_OUT_OF_STOCK = 40033,
  INVALID_INVENTORY_QUANTITY = 40034,
  
  // 服务器错误
  PRODUCT_CREATE_FAILED = 50030,
  PRODUCT_UPDATE_FAILED = 50031,
  PRODUCT_DELETE_FAILED = 50032,
  PRODUCT_FETCH_FAILED = 50033,
  INVENTORY_UPDATE_FAILED = 50034
}

/**
 * 支付模块业务码
 */
export enum PaymentBusinessCode {
  // 成功状态码
  PAYMENT_SUCCESS = 20040,
  PAYMENT_INITIATED = 20041,
  PAYMENT_CONFIRMED = 20042,
  REFUND_SUCCESS = 20043,
  
  // 客户端错误
  PAYMENT_NOT_FOUND = 40040,
  INVALID_PAYMENT_ID = 40041,
  PAYMENT_ALREADY_PROCESSED = 40042,
  INSUFFICIENT_BALANCE = 40043,
  PAYMENT_METHOD_INVALID = 40044,
  
  // 服务器错误
  PAYMENT_PROCESSING_FAILED = 50040,
  PAYMENT_INITIATION_FAILED = 50041,
  REFUND_FAILED = 50042,
  PAYMENT_GATEWAY_ERROR = 50043
}

/**
 * 系统模块业务码
 */
export enum SystemBusinessCode {
  // 成功状态码
  HEALTH_CHECK_SUCCESS = 20050,
  SYSTEM_STATUS_OK = 20051,
  MAINTENANCE_MODE_ENABLED = 20052,
  MAINTENANCE_MODE_DISABLED = 20053,
  
  // 客户端错误
  SYSTEM_MAINTENANCE = 40050,
  API_VERSION_NOT_SUPPORTED = 40051,
  
  // 服务器错误
  SYSTEM_ERROR = 50050,
  DATABASE_CONNECTION_FAILED = 50051,
  CACHE_CONNECTION_FAILED = 50052,
  EXTERNAL_SERVICE_ERROR = 50053
}

/**
 * 业务码工具类
 */
export class BusinessCodeUtil {
  /**
   * 获取业务码对应的HTTP状态码
   */
  static getHttpStatus(businessCode: number): number {
    const codeStr = businessCode.toString()
    const prefix = parseInt(codeStr.substring(0, 1))
    
    // 根据业务码前缀确定HTTP状态码
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
   * 判断是否为成功状态码
   */
  static isSuccess(businessCode: number): boolean {
    return businessCode >= 20000 && businessCode < 30000
  }

  /**
   * 判断是否为客户端错误
   */
  static isClientError(businessCode: number): boolean {
    return businessCode >= 40000 && businessCode < 50000
  }

  /**
   * 判断是否为服务器错误
   */
  static isServerError(businessCode: number): boolean {
    return businessCode >= 50000 && businessCode < 60000
  }

  /**
   * 获取业务码描述
   */
  static getDescription(businessCode: number): string {
    // 这里可以根据需要扩展，从枚举值反向获取描述
    const allCodes = {
      ...CommonBusinessCode,
      ...UserBusinessCode,
      ...OrderBusinessCode,
      ...ProductBusinessCode,
      ...PaymentBusinessCode,
      ...SystemBusinessCode
    }
    
    const entry = Object.entries(allCodes).find(([_, value]) => value === businessCode)
    return entry ? entry[0] : 'Unknown Business Code'
  }
}

/**
 * 导出所有业务码枚举
 */
export const BusinessCode = {
  ...CommonBusinessCode,
  ...UserBusinessCode,
  ...OrderBusinessCode,
  ...ProductBusinessCode,
  ...PaymentBusinessCode,
  ...SystemBusinessCode
} as const

// 类型定义
export type BusinessCodeType = typeof BusinessCode[keyof typeof BusinessCode]