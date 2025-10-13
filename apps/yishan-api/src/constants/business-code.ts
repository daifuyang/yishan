/**
 * 全局业务码定义 - 动态扩展版
 * 业务码与HTTP状态码分离，采用5位数字格式
 * 
 * 编码规则（动态扩展版）：
 * - 第1位：状态类型标识
 *   - 2: 成功状态 (20000-29999)
 *   - 4: 客户端错误 (40000-49999)  
 *   - 5: 服务器错误 (50000-59999)
 * 
 * - 第2-3位：业务模块标识
 *   - 00: 通用模块
 *   - 01: 用户模块  
 *   - 02: 订单模块
 *   - 03: 商品模块
 *   - 04: 支付模块
 *   - 05: 系统模块
 *   - 06: 角色模块
 *   - ...可扩展到99
 * 
 * - 第4-5位：具体操作标识 (00-99)
 * 
 * 示例：
 * - 20000: 通用成功
 * - 20101: 用户创建成功  
 * - 40110: 用户不存在
 * - 50101: 用户创建失败
 */

/**
 * 业务模块枚举 - 支持动态扩展
 */
export enum BusinessModule {
  COMMON = 0,      // 通用模块
  USER = 1,        // 用户模块
  ORDER = 2,       // 订单模块
  PRODUCT = 3,     // 商品模块
  PAYMENT = 4,     // 支付模块
  SYSTEM = 5,      // 系统模块
  ROLE = 6,        // 角色模块
  // 预留扩展空间，可添加新模块：
  // PERMISSION = 7,  // 权限模块
  // ORGANIZATION = 8, // 组织模块
  // LOG = 9,         // 日志模块
  // FILE = 10,       // 文件模块
  // ...可扩展到99
}

/**
 * 状态类型枚举
 */
export enum StatusType {
  SUCCESS = 2,     // 成功状态
  CLIENT_ERROR = 4, // 客户端错误
  SERVER_ERROR = 5, // 服务器错误
}

/**
 * 业务码生成器 - 核心动态生成类
 */
export class BusinessCodeGenerator {
  /**
   * 生成业务码
   * @param statusType 状态类型
   * @param module 业务模块
   * @param operation 操作标识 (0-99)
   * @returns 5位业务码
   */
  static generate(statusType: StatusType, module: BusinessModule, operation: number): number {
    if (operation < 0 || operation > 99) {
      throw new Error('操作标识必须在0-99之间')
    }
    
    const moduleStr = module.toString().padStart(2, '0')
    const operationStr = operation.toString().padStart(2, '0')
    
    return parseInt(`${statusType}${moduleStr}${operationStr}`)
  }

  /**
   * 批量生成业务码
   * @param statusType 状态类型
   * @param module 业务模块
   * @param operations 操作标识数组
   * @returns 业务码数组
   */
  static generateBatch(statusType: StatusType, module: BusinessModule, operations: number[]): number[] {
    return operations.map(op => this.generate(statusType, module, op))
  }

  /**
   * 获取模块名称
   * @param module 业务模块
   * @returns 模块名称
   */
  static getModuleName(module: BusinessModule): string {
    const moduleMap: Record<BusinessModule, string> = {
      [BusinessModule.COMMON]: '通用模块',
      [BusinessModule.USER]: '用户模块',
      [BusinessModule.ORDER]: '订单模块',
      [BusinessModule.PRODUCT]: '商品模块',
      [BusinessModule.PAYMENT]: '支付模块',
      [BusinessModule.SYSTEM]: '系统模块',
      [BusinessModule.ROLE]: '角色模块'
    }
    return moduleMap[module] || '未知模块'
  }
}

/**
 * 通用业务码 (模块码: 00) - 使用动态生成
 */
export const CommonBusinessCode = {
  // 成功状态码 (20000-20099)
  SUCCESS: BusinessCodeGenerator.generate(StatusType.SUCCESS, BusinessModule.COMMON, 0),
  CREATED: BusinessCodeGenerator.generate(StatusType.SUCCESS, BusinessModule.COMMON, 1),
  UPDATED: BusinessCodeGenerator.generate(StatusType.SUCCESS, BusinessModule.COMMON, 2),
  DELETED: BusinessCodeGenerator.generate(StatusType.SUCCESS, BusinessModule.COMMON, 3),
  OPERATION_SUCCESS: BusinessCodeGenerator.generate(StatusType.SUCCESS, BusinessModule.COMMON, 4),
  
  // 客户端错误 (40000-40099)
  BAD_REQUEST: BusinessCodeGenerator.generate(StatusType.CLIENT_ERROR, BusinessModule.COMMON, 0),
  INVALID_PARAMETER: BusinessCodeGenerator.generate(StatusType.CLIENT_ERROR, BusinessModule.COMMON, 1),
  UNAUTHORIZED: BusinessCodeGenerator.generate(StatusType.CLIENT_ERROR, BusinessModule.COMMON, 2),
  FORBIDDEN: BusinessCodeGenerator.generate(StatusType.CLIENT_ERROR, BusinessModule.COMMON, 3),
  NOT_FOUND: BusinessCodeGenerator.generate(StatusType.CLIENT_ERROR, BusinessModule.COMMON, 4),
  METHOD_NOT_ALLOWED: BusinessCodeGenerator.generate(StatusType.CLIENT_ERROR, BusinessModule.COMMON, 5),
  CONFLICT: BusinessCodeGenerator.generate(StatusType.CLIENT_ERROR, BusinessModule.COMMON, 6),
  UNPROCESSABLE_ENTITY: BusinessCodeGenerator.generate(StatusType.CLIENT_ERROR, BusinessModule.COMMON, 7),
  TOO_MANY_REQUESTS: BusinessCodeGenerator.generate(StatusType.CLIENT_ERROR, BusinessModule.COMMON, 8),
  
  // 服务器错误 (50000-50099)
  INTERNAL_SERVER_ERROR: BusinessCodeGenerator.generate(StatusType.SERVER_ERROR, BusinessModule.COMMON, 0),
  SERVICE_UNAVAILABLE: BusinessCodeGenerator.generate(StatusType.SERVER_ERROR, BusinessModule.COMMON, 1),
  BAD_GATEWAY: BusinessCodeGenerator.generate(StatusType.SERVER_ERROR, BusinessModule.COMMON, 2),
  GATEWAY_TIMEOUT: BusinessCodeGenerator.generate(StatusType.SERVER_ERROR, BusinessModule.COMMON, 3),
  DATABASE_ERROR: BusinessCodeGenerator.generate(StatusType.SERVER_ERROR, BusinessModule.COMMON, 4),
  CACHE_ERROR: BusinessCodeGenerator.generate(StatusType.SERVER_ERROR, BusinessModule.COMMON, 5)
} as const

/**
 * 用户模块业务码 (模块码: 01) - 使用动态生成
 */
export const UserBusinessCode = {
  // 成功状态码 (20100-20199)
  USER_CREATED: BusinessCodeGenerator.generate(StatusType.SUCCESS, BusinessModule.USER, 1),
  USER_RETRIEVED: BusinessCodeGenerator.generate(StatusType.SUCCESS, BusinessModule.USER, 2),
  USERS_RETRIEVED: BusinessCodeGenerator.generate(StatusType.SUCCESS, BusinessModule.USER, 3),
  USER_UPDATED: BusinessCodeGenerator.generate(StatusType.SUCCESS, BusinessModule.USER, 4),
  USER_DELETED: BusinessCodeGenerator.generate(StatusType.SUCCESS, BusinessModule.USER, 5),
  USER_LOGIN_SUCCESS: BusinessCodeGenerator.generate(StatusType.SUCCESS, BusinessModule.USER, 6),
  USER_LOGOUT_SUCCESS: BusinessCodeGenerator.generate(StatusType.SUCCESS, BusinessModule.USER, 7),
  USER_PASSWORD_CHANGED: BusinessCodeGenerator.generate(StatusType.SUCCESS, BusinessModule.USER, 8),
  USER_PROFILE_UPDATED: BusinessCodeGenerator.generate(StatusType.SUCCESS, BusinessModule.USER, 9),
  USER_LIST_SUCCESS: BusinessCodeGenerator.generate(StatusType.SUCCESS, BusinessModule.USER, 10),
  USER_DETAIL_SUCCESS: BusinessCodeGenerator.generate(StatusType.SUCCESS, BusinessModule.USER, 11),
  USER_STATUS_CHANGED: BusinessCodeGenerator.generate(StatusType.SUCCESS, BusinessModule.USER, 12),
  PASSWORD_RESET_SUCCESS: BusinessCodeGenerator.generate(StatusType.SUCCESS, BusinessModule.USER, 13),
  CACHE_CLEARED: BusinessCodeGenerator.generate(StatusType.SUCCESS, BusinessModule.USER, 14),
  
  // 客户端错误 (40100-40199)
  USER_NOT_FOUND: BusinessCodeGenerator.generate(StatusType.CLIENT_ERROR, BusinessModule.USER, 10),
  USER_ALREADY_EXISTS: BusinessCodeGenerator.generate(StatusType.CLIENT_ERROR, BusinessModule.USER, 11),
  INVALID_USER_ID: BusinessCodeGenerator.generate(StatusType.CLIENT_ERROR, BusinessModule.USER, 12),
  INVALID_EMAIL_FORMAT: BusinessCodeGenerator.generate(StatusType.CLIENT_ERROR, BusinessModule.USER, 13),
  INVALID_PASSWORD_FORMAT: BusinessCodeGenerator.generate(StatusType.CLIENT_ERROR, BusinessModule.USER, 14),
  USER_DISABLED: BusinessCodeGenerator.generate(StatusType.CLIENT_ERROR, BusinessModule.USER, 15),
  USER_NOT_ACTIVATED: BusinessCodeGenerator.generate(StatusType.CLIENT_ERROR, BusinessModule.USER, 16),
  INVALID_CREDENTIALS: BusinessCodeGenerator.generate(StatusType.CLIENT_ERROR, BusinessModule.USER, 17),
  TOKEN_EXPIRED: BusinessCodeGenerator.generate(StatusType.CLIENT_ERROR, BusinessModule.USER, 18),
  TOKEN_INVALID: BusinessCodeGenerator.generate(StatusType.CLIENT_ERROR, BusinessModule.USER, 19),
  USER_VERSION_CONFLICT: BusinessCodeGenerator.generate(StatusType.CLIENT_ERROR, BusinessModule.USER, 20),
  
  // 服务器错误 (50100-50199)
  USER_CREATE_FAILED: BusinessCodeGenerator.generate(StatusType.SERVER_ERROR, BusinessModule.USER, 10),
  USER_UPDATE_FAILED: BusinessCodeGenerator.generate(StatusType.SERVER_ERROR, BusinessModule.USER, 11),
  USER_DELETE_FAILED: BusinessCodeGenerator.generate(StatusType.SERVER_ERROR, BusinessModule.USER, 12),
  USER_FETCH_FAILED: BusinessCodeGenerator.generate(StatusType.SERVER_ERROR, BusinessModule.USER, 13),
  USER_LOGIN_FAILED: BusinessCodeGenerator.generate(StatusType.SERVER_ERROR, BusinessModule.USER, 14),
  USER_LOGOUT_FAILED: BusinessCodeGenerator.generate(StatusType.SERVER_ERROR, BusinessModule.USER, 15),
  PASSWORD_CHANGE_FAILED: BusinessCodeGenerator.generate(StatusType.SERVER_ERROR, BusinessModule.USER, 16),
  PROFILE_UPDATE_FAILED: BusinessCodeGenerator.generate(StatusType.SERVER_ERROR, BusinessModule.USER, 17),
  CACHE_CLEAR_FAILED: BusinessCodeGenerator.generate(StatusType.SERVER_ERROR, BusinessModule.USER, 18),
  TOKEN_GENERATION_FAILED: BusinessCodeGenerator.generate(StatusType.SERVER_ERROR, BusinessModule.USER, 19),
  USER_LIST_FAILED: BusinessCodeGenerator.generate(StatusType.SERVER_ERROR, BusinessModule.USER, 20),
  USER_DETAIL_FAILED: BusinessCodeGenerator.generate(StatusType.SERVER_ERROR, BusinessModule.USER, 21),
  USER_STATUS_CHANGE_FAILED: BusinessCodeGenerator.generate(StatusType.SERVER_ERROR, BusinessModule.USER, 22),
  PASSWORD_RESET_FAILED: BusinessCodeGenerator.generate(StatusType.SERVER_ERROR, BusinessModule.USER, 23)
} as const

/**
 * 订单模块业务码 (模块码: 02) - 使用动态生成
 */
export const OrderBusinessCode = {
  // 成功状态码 (20200-20299)
  ORDER_CREATED: BusinessCodeGenerator.generate(StatusType.SUCCESS, BusinessModule.ORDER, 1),
  ORDER_RETRIEVED: BusinessCodeGenerator.generate(StatusType.SUCCESS, BusinessModule.ORDER, 2),
  ORDERS_RETRIEVED: BusinessCodeGenerator.generate(StatusType.SUCCESS, BusinessModule.ORDER, 3),
  ORDER_UPDATED: BusinessCodeGenerator.generate(StatusType.SUCCESS, BusinessModule.ORDER, 4),
  ORDER_CANCELLED: BusinessCodeGenerator.generate(StatusType.SUCCESS, BusinessModule.ORDER, 5),
  ORDER_CONFIRMED: BusinessCodeGenerator.generate(StatusType.SUCCESS, BusinessModule.ORDER, 6),
  ORDER_SHIPPED: BusinessCodeGenerator.generate(StatusType.SUCCESS, BusinessModule.ORDER, 7),
  ORDER_DELIVERED: BusinessCodeGenerator.generate(StatusType.SUCCESS, BusinessModule.ORDER, 8),
  
  // 客户端错误 (40200-40299)
  ORDER_NOT_FOUND: BusinessCodeGenerator.generate(StatusType.CLIENT_ERROR, BusinessModule.ORDER, 10),
  ORDER_ALREADY_EXISTS: BusinessCodeGenerator.generate(StatusType.CLIENT_ERROR, BusinessModule.ORDER, 11),
  INVALID_ORDER_ID: BusinessCodeGenerator.generate(StatusType.CLIENT_ERROR, BusinessModule.ORDER, 12),
  ORDER_STATUS_INVALID: BusinessCodeGenerator.generate(StatusType.CLIENT_ERROR, BusinessModule.ORDER, 13),
  ORDER_CANNOT_BE_CANCELLED: BusinessCodeGenerator.generate(StatusType.CLIENT_ERROR, BusinessModule.ORDER, 14),
  ORDER_CANNOT_BE_UPDATED: BusinessCodeGenerator.generate(StatusType.CLIENT_ERROR, BusinessModule.ORDER, 15),
  
  // 服务器错误 (50200-50299)
  ORDER_CREATE_FAILED: BusinessCodeGenerator.generate(StatusType.SERVER_ERROR, BusinessModule.ORDER, 10),
  ORDER_UPDATE_FAILED: BusinessCodeGenerator.generate(StatusType.SERVER_ERROR, BusinessModule.ORDER, 11),
  ORDER_CANCEL_FAILED: BusinessCodeGenerator.generate(StatusType.SERVER_ERROR, BusinessModule.ORDER, 12),
  ORDER_FETCH_FAILED: BusinessCodeGenerator.generate(StatusType.SERVER_ERROR, BusinessModule.ORDER, 13)
} as const

/**
 * 商品模块业务码 (模块码: 03) - 使用动态生成
 */
export const ProductBusinessCode = {
  // 成功状态码 (20300-20399)
  PRODUCT_CREATED: BusinessCodeGenerator.generate(StatusType.SUCCESS, BusinessModule.PRODUCT, 1),
  PRODUCT_RETRIEVED: BusinessCodeGenerator.generate(StatusType.SUCCESS, BusinessModule.PRODUCT, 2),
  PRODUCTS_RETRIEVED: BusinessCodeGenerator.generate(StatusType.SUCCESS, BusinessModule.PRODUCT, 3),
  PRODUCT_UPDATED: BusinessCodeGenerator.generate(StatusType.SUCCESS, BusinessModule.PRODUCT, 4),
  PRODUCT_DELETED: BusinessCodeGenerator.generate(StatusType.SUCCESS, BusinessModule.PRODUCT, 5),
  INVENTORY_UPDATED: BusinessCodeGenerator.generate(StatusType.SUCCESS, BusinessModule.PRODUCT, 6),
  
  // 客户端错误 (40300-40399)
  PRODUCT_NOT_FOUND: BusinessCodeGenerator.generate(StatusType.CLIENT_ERROR, BusinessModule.PRODUCT, 10),
  PRODUCT_ALREADY_EXISTS: BusinessCodeGenerator.generate(StatusType.CLIENT_ERROR, BusinessModule.PRODUCT, 11),
  INVALID_PRODUCT_ID: BusinessCodeGenerator.generate(StatusType.CLIENT_ERROR, BusinessModule.PRODUCT, 12),
  PRODUCT_OUT_OF_STOCK: BusinessCodeGenerator.generate(StatusType.CLIENT_ERROR, BusinessModule.PRODUCT, 13),
  INVALID_INVENTORY_QUANTITY: BusinessCodeGenerator.generate(StatusType.CLIENT_ERROR, BusinessModule.PRODUCT, 14),
  
  // 服务器错误 (50300-50399)
  PRODUCT_CREATE_FAILED: BusinessCodeGenerator.generate(StatusType.SERVER_ERROR, BusinessModule.PRODUCT, 10),
  PRODUCT_UPDATE_FAILED: BusinessCodeGenerator.generate(StatusType.SERVER_ERROR, BusinessModule.PRODUCT, 11),
  PRODUCT_DELETE_FAILED: BusinessCodeGenerator.generate(StatusType.SERVER_ERROR, BusinessModule.PRODUCT, 12),
  PRODUCT_FETCH_FAILED: BusinessCodeGenerator.generate(StatusType.SERVER_ERROR, BusinessModule.PRODUCT, 13),
  INVENTORY_UPDATE_FAILED: BusinessCodeGenerator.generate(StatusType.SERVER_ERROR, BusinessModule.PRODUCT, 14)
} as const

/**
 * 支付模块业务码 (模块码: 04) - 使用动态生成
 */
export const PaymentBusinessCode = {
  // 成功状态码 (20400-20499)
  PAYMENT_SUCCESS: BusinessCodeGenerator.generate(StatusType.SUCCESS, BusinessModule.PAYMENT, 1),
  PAYMENT_INITIATED: BusinessCodeGenerator.generate(StatusType.SUCCESS, BusinessModule.PAYMENT, 2),
  PAYMENT_CONFIRMED: BusinessCodeGenerator.generate(StatusType.SUCCESS, BusinessModule.PAYMENT, 3),
  REFUND_SUCCESS: BusinessCodeGenerator.generate(StatusType.SUCCESS, BusinessModule.PAYMENT, 4),
  
  // 客户端错误 (40400-40499)
  PAYMENT_NOT_FOUND: BusinessCodeGenerator.generate(StatusType.CLIENT_ERROR, BusinessModule.PAYMENT, 10),
  INVALID_PAYMENT_ID: BusinessCodeGenerator.generate(StatusType.CLIENT_ERROR, BusinessModule.PAYMENT, 11),
  PAYMENT_ALREADY_PROCESSED: BusinessCodeGenerator.generate(StatusType.CLIENT_ERROR, BusinessModule.PAYMENT, 12),
  INSUFFICIENT_BALANCE: BusinessCodeGenerator.generate(StatusType.CLIENT_ERROR, BusinessModule.PAYMENT, 13),
  PAYMENT_METHOD_INVALID: BusinessCodeGenerator.generate(StatusType.CLIENT_ERROR, BusinessModule.PAYMENT, 14),
  
  // 服务器错误 (50400-50499)
  PAYMENT_PROCESSING_FAILED: BusinessCodeGenerator.generate(StatusType.SERVER_ERROR, BusinessModule.PAYMENT, 10),
  PAYMENT_INITIATION_FAILED: BusinessCodeGenerator.generate(StatusType.SERVER_ERROR, BusinessModule.PAYMENT, 11),
  REFUND_FAILED: BusinessCodeGenerator.generate(StatusType.SERVER_ERROR, BusinessModule.PAYMENT, 12),
  PAYMENT_GATEWAY_ERROR: BusinessCodeGenerator.generate(StatusType.SERVER_ERROR, BusinessModule.PAYMENT, 13)
} as const

/**
 * 角色模块业务码 (模块码: 06) - 使用动态生成
 */
export const RoleBusinessCode = {
  // 成功状态码 (20600-20699)
  ROLE_CREATED: BusinessCodeGenerator.generate(StatusType.SUCCESS, BusinessModule.ROLE, 1),
  ROLE_RETRIEVED: BusinessCodeGenerator.generate(StatusType.SUCCESS, BusinessModule.ROLE, 2),
  ROLES_RETRIEVED: BusinessCodeGenerator.generate(StatusType.SUCCESS, BusinessModule.ROLE, 3),
  ROLE_UPDATED: BusinessCodeGenerator.generate(StatusType.SUCCESS, BusinessModule.ROLE, 4),
  ROLE_DELETED: BusinessCodeGenerator.generate(StatusType.SUCCESS, BusinessModule.ROLE, 5),
  ROLE_STATUS_CHANGED: BusinessCodeGenerator.generate(StatusType.SUCCESS, BusinessModule.ROLE, 6),
  ROLE_ASSIGNED: BusinessCodeGenerator.generate(StatusType.SUCCESS, BusinessModule.ROLE, 7),
  ROLE_UNASSIGNED: BusinessCodeGenerator.generate(StatusType.SUCCESS, BusinessModule.ROLE, 8),
  PERMISSION_ASSIGNED: BusinessCodeGenerator.generate(StatusType.SUCCESS, BusinessModule.ROLE, 9),
  PERMISSION_UNASSIGNED: BusinessCodeGenerator.generate(StatusType.SUCCESS, BusinessModule.ROLE, 10),
  USER_ROLES_RETRIEVED: BusinessCodeGenerator.generate(StatusType.SUCCESS, BusinessModule.ROLE, 11),
  ROLE_PERMISSIONS_RETRIEVED: BusinessCodeGenerator.generate(StatusType.SUCCESS, BusinessModule.ROLE, 12),
  ROLE_CACHE_CLEARED: BusinessCodeGenerator.generate(StatusType.SUCCESS, BusinessModule.ROLE, 13),
  
  // 客户端错误 (40600-40699)
  ROLE_NOT_FOUND: BusinessCodeGenerator.generate(StatusType.CLIENT_ERROR, BusinessModule.ROLE, 10),
  ROLE_ALREADY_EXISTS: BusinessCodeGenerator.generate(StatusType.CLIENT_ERROR, BusinessModule.ROLE, 11),
  INVALID_ROLE_ID: BusinessCodeGenerator.generate(StatusType.CLIENT_ERROR, BusinessModule.ROLE, 12),
  ROLE_NAME_ALREADY_EXISTS: BusinessCodeGenerator.generate(StatusType.CLIENT_ERROR, BusinessModule.ROLE, 13),
  ROLE_CODE_ALREADY_EXISTS: BusinessCodeGenerator.generate(StatusType.CLIENT_ERROR, BusinessModule.ROLE, 14),
  ROLE_DISABLED: BusinessCodeGenerator.generate(StatusType.CLIENT_ERROR, BusinessModule.ROLE, 15),
  ROLE_CANNOT_BE_DELETED: BusinessCodeGenerator.generate(StatusType.CLIENT_ERROR, BusinessModule.ROLE, 16),
  SYSTEM_ROLE_CANNOT_BE_MODIFIED: BusinessCodeGenerator.generate(StatusType.CLIENT_ERROR, BusinessModule.ROLE, 17),
  INVALID_ROLE_STATUS: BusinessCodeGenerator.generate(StatusType.CLIENT_ERROR, BusinessModule.ROLE, 18),
  ROLE_ASSIGNMENT_EXISTS: BusinessCodeGenerator.generate(StatusType.CLIENT_ERROR, BusinessModule.ROLE, 19),
  ROLE_ASSIGNMENT_NOT_FOUND: BusinessCodeGenerator.generate(StatusType.CLIENT_ERROR, BusinessModule.ROLE, 20),
  PERMISSION_NOT_FOUND: BusinessCodeGenerator.generate(StatusType.CLIENT_ERROR, BusinessModule.ROLE, 21),
  PERMISSION_ASSIGNMENT_EXISTS: BusinessCodeGenerator.generate(StatusType.CLIENT_ERROR, BusinessModule.ROLE, 22),
  PERMISSION_ASSIGNMENT_NOT_FOUND: BusinessCodeGenerator.generate(StatusType.CLIENT_ERROR, BusinessModule.ROLE, 23),
  INVALID_PERMISSION_ID: BusinessCodeGenerator.generate(StatusType.CLIENT_ERROR, BusinessModule.ROLE, 24),
  USER_NOT_FOUND_FOR_ROLE: BusinessCodeGenerator.generate(StatusType.CLIENT_ERROR, BusinessModule.ROLE, 25),
  
  // 服务器错误 (50600-50699)
  ROLE_CREATE_FAILED: BusinessCodeGenerator.generate(StatusType.SERVER_ERROR, BusinessModule.ROLE, 10),
  ROLE_UPDATE_FAILED: BusinessCodeGenerator.generate(StatusType.SERVER_ERROR, BusinessModule.ROLE, 11),
  ROLE_DELETE_FAILED: BusinessCodeGenerator.generate(StatusType.SERVER_ERROR, BusinessModule.ROLE, 12),
  ROLE_FETCH_FAILED: BusinessCodeGenerator.generate(StatusType.SERVER_ERROR, BusinessModule.ROLE, 13),
  ROLE_STATUS_CHANGE_FAILED: BusinessCodeGenerator.generate(StatusType.SERVER_ERROR, BusinessModule.ROLE, 14),
  ROLE_ASSIGNMENT_FAILED: BusinessCodeGenerator.generate(StatusType.SERVER_ERROR, BusinessModule.ROLE, 15),
  ROLE_UNASSIGNMENT_FAILED: BusinessCodeGenerator.generate(StatusType.SERVER_ERROR, BusinessModule.ROLE, 16),
  PERMISSION_ASSIGNMENT_FAILED: BusinessCodeGenerator.generate(StatusType.SERVER_ERROR, BusinessModule.ROLE, 17),
  PERMISSION_UNASSIGNMENT_FAILED: BusinessCodeGenerator.generate(StatusType.SERVER_ERROR, BusinessModule.ROLE, 18),
  USER_ROLES_FETCH_FAILED: BusinessCodeGenerator.generate(StatusType.SERVER_ERROR, BusinessModule.ROLE, 19),
  ROLE_PERMISSIONS_FETCH_FAILED: BusinessCodeGenerator.generate(StatusType.SERVER_ERROR, BusinessModule.ROLE, 20),
  ROLE_CACHE_CLEAR_FAILED: BusinessCodeGenerator.generate(StatusType.SERVER_ERROR, BusinessModule.ROLE, 21)
} as const

/**
 * 系统模块业务码 (模块码: 05) - 使用动态生成
 */
export const SystemBusinessCode = {
  // 成功状态码 (20500-20599)
  HEALTH_CHECK_SUCCESS: BusinessCodeGenerator.generate(StatusType.SUCCESS, BusinessModule.SYSTEM, 1),
  SYSTEM_STATUS_OK: BusinessCodeGenerator.generate(StatusType.SUCCESS, BusinessModule.SYSTEM, 2),
  MAINTENANCE_MODE_ENABLED: BusinessCodeGenerator.generate(StatusType.SUCCESS, BusinessModule.SYSTEM, 3),
  MAINTENANCE_MODE_DISABLED: BusinessCodeGenerator.generate(StatusType.SUCCESS, BusinessModule.SYSTEM, 4),
  
  // 客户端错误 (40500-40599)
  SYSTEM_MAINTENANCE: BusinessCodeGenerator.generate(StatusType.CLIENT_ERROR, BusinessModule.SYSTEM, 10),
  API_VERSION_NOT_SUPPORTED: BusinessCodeGenerator.generate(StatusType.CLIENT_ERROR, BusinessModule.SYSTEM, 11),
  
  // 服务器错误 (50500-50599)
  SYSTEM_ERROR: BusinessCodeGenerator.generate(StatusType.SERVER_ERROR, BusinessModule.SYSTEM, 10),
  DATABASE_CONNECTION_FAILED: BusinessCodeGenerator.generate(StatusType.SERVER_ERROR, BusinessModule.SYSTEM, 11),
  CACHE_CONNECTION_FAILED: BusinessCodeGenerator.generate(StatusType.SERVER_ERROR, BusinessModule.SYSTEM, 12),
  EXTERNAL_SERVICE_ERROR: BusinessCodeGenerator.generate(StatusType.SERVER_ERROR, BusinessModule.SYSTEM, 13)
} as const

/**
 * 业务码工具类 - 增强版，支持元数据管理
 */
export class BusinessCodeUtil {
  /**
   * 获取对应的HTTP状态码
   */
  static getHttpStatus(businessCode: number): number {
    // 优先从注册表获取
    const metadata = BusinessCodeRegistry.get(businessCode)
    if (metadata) {
      return metadata.httpStatus
    }

    // 回退到原有逻辑
    const firstDigit = Math.floor(businessCode / 10000)
    switch (firstDigit) {
      case 2: // 成功状态码
        return 200
      case 4: // 客户端错误
        if (businessCode === CommonBusinessCode.UNAUTHORIZED) return 401
        if (businessCode === CommonBusinessCode.FORBIDDEN) return 403
        if (businessCode === CommonBusinessCode.NOT_FOUND) return 404
        if (businessCode === CommonBusinessCode.METHOD_NOT_ALLOWED) return 405
        if (businessCode === CommonBusinessCode.CONFLICT) return 409
        if (businessCode === CommonBusinessCode.UNPROCESSABLE_ENTITY) return 422
        if (businessCode === CommonBusinessCode.TOO_MANY_REQUESTS) return 429
        return 400
      case 5: // 服务器错误
        if (businessCode === CommonBusinessCode.SERVICE_UNAVAILABLE) return 503
        if (businessCode === CommonBusinessCode.BAD_GATEWAY) return 502
        if (businessCode === CommonBusinessCode.GATEWAY_TIMEOUT) return 504
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
    // 优先从注册表获取
    const metadata = BusinessCodeRegistry.get(businessCode)
    if (metadata) {
      return metadata.description
    }

    // 回退到原有逻辑
    const allCodes = {
      ...CommonBusinessCode,
      ...UserBusinessCode,
      ...OrderBusinessCode,
      ...ProductBusinessCode,
      ...PaymentBusinessCode,
      ...SystemBusinessCode,
      ...RoleBusinessCode
    }
    
    const entry = Object.entries(allCodes).find(([_, value]) => value === businessCode)
    return entry ? entry[0] : 'Unknown Business Code'
  }

  /**
   * 获取业务码消息
   */
  static getMessage(businessCode: number): string {
    const metadata = BusinessCodeRegistry.get(businessCode)
    return metadata?.message || this.getDescription(businessCode)
  }

  /**
   * 获取业务码名称
   */
  static getName(businessCode: number): string {
    const metadata = BusinessCodeRegistry.get(businessCode)
    return metadata?.name || this.getDescription(businessCode)
  }

  /**
   * 解析业务码结构
   */
  static parseBusinessCode(businessCode: number): {
    statusType: 'success' | 'client_error' | 'server_error' | 'unknown',
    moduleCode: number,
    operationCode: number
  } {
    const codeStr = businessCode.toString().padStart(5, '0')
    const statusType = parseInt(codeStr[0])
    const moduleCode = parseInt(codeStr.substring(1, 3))
    const operationCode = parseInt(codeStr.substring(3, 5))

    let statusTypeName: 'success' | 'client_error' | 'server_error' | 'unknown'
    switch (statusType) {
      case 2: statusTypeName = 'success'; break
      case 4: statusTypeName = 'client_error'; break
      case 5: statusTypeName = 'server_error'; break
      default: statusTypeName = 'unknown'; break
    }

    return {
      statusType: statusTypeName,
      moduleCode,
      operationCode
    }
  }

  /**
   * 获取模块名称
   */
  static getModuleName(moduleCode: number): string {
    const moduleMap: Record<number, string> = {
      0: '通用模块',
      1: '用户模块',
      2: '订单模块',
      3: '商品模块',
      4: '支付模块',
      5: '系统模块',
      6: '角色模块'
    }
    return moduleMap[moduleCode] || '未知模块'
  }

  /**
   * 获取完整的业务码信息
   */
  static getFullInfo(businessCode: number): {
    code: number
    name: string
    description: string
    message: string
    httpStatus: number
    statusType: 'success' | 'client_error' | 'server_error' | 'unknown'
    moduleCode: number
    moduleName: string
    operationCode: number
    isRegistered: boolean
  } {
    const parsed = this.parseBusinessCode(businessCode)
    
    return {
      code: businessCode,
      name: this.getName(businessCode),
      description: this.getDescription(businessCode),
      message: this.getMessage(businessCode),
      httpStatus: this.getHttpStatus(businessCode),
      statusType: parsed.statusType,
      moduleCode: parsed.moduleCode,
      moduleName: this.getModuleName(parsed.moduleCode),
      operationCode: parsed.operationCode,
      isRegistered: BusinessCodeRegistry.has(businessCode)
    }
  }

  /**
   * 验证业务码格式
   */
  static isValidFormat(businessCode: number): boolean {
    if (businessCode < 10000 || businessCode > 99999) {
      return false
    }
    
    const parsed = this.parseBusinessCode(businessCode)
    return parsed.statusType !== 'unknown'
  }

  /**
   * 获取所有已注册的业务码列表
   */
  static getAllRegisteredCodes(): number[] {
    return BusinessCodeRegistry.getAllCodes()
  }

  /**
   * 获取指定模块的所有业务码
   */
  static getCodesByModule(module: BusinessModule): BusinessCodeMetadata[] {
    return BusinessCodeRegistry.getByModule(module)
  }

  /**
   * 获取指定状态类型的所有业务码
   */
  static getCodesByStatusType(statusType: 'success' | 'client_error' | 'server_error'): BusinessCodeMetadata[] {
    return BusinessCodeRegistry.getByStatusType(statusType)
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
  ...RoleBusinessCode,
  ...SystemBusinessCode
} as const

// 类型定义
export type BusinessCodeType = typeof BusinessCode[keyof typeof BusinessCode]


/**
 * 业务码元数据接口
 */
export interface BusinessCodeMetadata {
  code: number
  name: string
  description: string
  httpStatus: number
  statusType: 'success' | 'client_error' | 'server_error'
  module: BusinessModule
  operation: number
  message?: string
}

/**
 * 业务码注册表 - 管理所有业务码的元数据
 */
export class BusinessCodeRegistry {
  private static registry = new Map<number, BusinessCodeMetadata>()

  /**
   * 注册业务码元数据
   */
  static register(metadata: BusinessCodeMetadata): void {
    this.registry.set(metadata.code, metadata)
  }

  /**
   * 批量注册业务码元数据
   */
  static registerBatch(metadataList: BusinessCodeMetadata[]): void {
    metadataList.forEach(metadata => this.register(metadata))
  }

  /**
   * 获取业务码元数据
   */
  static get(code: number): BusinessCodeMetadata | undefined {
    return this.registry.get(code)
  }

  /**
   * 检查业务码是否已注册
   */
  static has(code: number): boolean {
    return this.registry.has(code)
  }

  /**
   * 获取所有已注册的业务码
   */
  static getAllCodes(): number[] {
    return Array.from(this.registry.keys())
  }

  /**
   * 获取指定模块的所有业务码
   */
  static getByModule(module: BusinessModule): BusinessCodeMetadata[] {
    return Array.from(this.registry.values()).filter(metadata => metadata.module === module)
  }

  /**
   * 获取指定状态类型的所有业务码
   */
  static getByStatusType(statusType: 'success' | 'client_error' | 'server_error'): BusinessCodeMetadata[] {
    return Array.from(this.registry.values()).filter(metadata => metadata.statusType === statusType)
  }

  /**
   * 清空注册表
   */
  static clear(): void {
    this.registry.clear()
  }

  /**
   * 获取注册表大小
   */
  static size(): number {
    return this.registry.size
  }
}

// 自动注册所有业务码到注册表
const registerAllBusinessCodes = () => {
  // 注册通用业务码
  BusinessCodeRegistry.registerBatch([
    { code: CommonBusinessCode.SUCCESS, name: 'SUCCESS', description: '操作成功', httpStatus: 200, statusType: 'success', module: BusinessModule.COMMON, operation: 0 },
    { code: CommonBusinessCode.CREATED, name: 'CREATED', description: '创建成功', httpStatus: 201, statusType: 'success', module: BusinessModule.COMMON, operation: 1 },
    { code: CommonBusinessCode.UPDATED, name: 'UPDATED', description: '更新成功', httpStatus: 200, statusType: 'success', module: BusinessModule.COMMON, operation: 2 },
    { code: CommonBusinessCode.DELETED, name: 'DELETED', description: '删除成功', httpStatus: 200, statusType: 'success', module: BusinessModule.COMMON, operation: 3 },
    { code: CommonBusinessCode.OPERATION_SUCCESS, name: 'OPERATION_SUCCESS', description: '操作成功', httpStatus: 200, statusType: 'success', module: BusinessModule.COMMON, operation: 4 },
    
    { code: CommonBusinessCode.BAD_REQUEST, name: 'BAD_REQUEST', description: '请求参数错误', httpStatus: 400, statusType: 'client_error', module: BusinessModule.COMMON, operation: 0 },
    { code: CommonBusinessCode.INVALID_PARAMETER, name: 'INVALID_PARAMETER', description: '参数无效', httpStatus: 400, statusType: 'client_error', module: BusinessModule.COMMON, operation: 1 },
    { code: CommonBusinessCode.UNAUTHORIZED, name: 'UNAUTHORIZED', description: '未授权', httpStatus: 401, statusType: 'client_error', module: BusinessModule.COMMON, operation: 2 },
    { code: CommonBusinessCode.FORBIDDEN, name: 'FORBIDDEN', description: '禁止访问', httpStatus: 403, statusType: 'client_error', module: BusinessModule.COMMON, operation: 3 },
    { code: CommonBusinessCode.NOT_FOUND, name: 'NOT_FOUND', description: '资源不存在', httpStatus: 404, statusType: 'client_error', module: BusinessModule.COMMON, operation: 4 },
    { code: CommonBusinessCode.METHOD_NOT_ALLOWED, name: 'METHOD_NOT_ALLOWED', description: '方法不允许', httpStatus: 405, statusType: 'client_error', module: BusinessModule.COMMON, operation: 5 },
    { code: CommonBusinessCode.CONFLICT, name: 'CONFLICT', description: '资源冲突', httpStatus: 409, statusType: 'client_error', module: BusinessModule.COMMON, operation: 6 },
    { code: CommonBusinessCode.UNPROCESSABLE_ENTITY, name: 'UNPROCESSABLE_ENTITY', description: '无法处理的实体', httpStatus: 422, statusType: 'client_error', module: BusinessModule.COMMON, operation: 7 },
    { code: CommonBusinessCode.TOO_MANY_REQUESTS, name: 'TOO_MANY_REQUESTS', description: '请求过多', httpStatus: 429, statusType: 'client_error', module: BusinessModule.COMMON, operation: 8 },
    
    { code: CommonBusinessCode.INTERNAL_SERVER_ERROR, name: 'INTERNAL_SERVER_ERROR', description: '服务器内部错误', httpStatus: 500, statusType: 'server_error', module: BusinessModule.COMMON, operation: 0 },
    { code: CommonBusinessCode.SERVICE_UNAVAILABLE, name: 'SERVICE_UNAVAILABLE', description: '服务不可用', httpStatus: 503, statusType: 'server_error', module: BusinessModule.COMMON, operation: 1 },
    { code: CommonBusinessCode.BAD_GATEWAY, name: 'BAD_GATEWAY', description: '网关错误', httpStatus: 502, statusType: 'server_error', module: BusinessModule.COMMON, operation: 2 },
    { code: CommonBusinessCode.GATEWAY_TIMEOUT, name: 'GATEWAY_TIMEOUT', description: '网关超时', httpStatus: 504, statusType: 'server_error', module: BusinessModule.COMMON, operation: 3 },
    { code: CommonBusinessCode.DATABASE_ERROR, name: 'DATABASE_ERROR', description: '数据库错误', httpStatus: 500, statusType: 'server_error', module: BusinessModule.COMMON, operation: 4 },
    { code: CommonBusinessCode.CACHE_ERROR, name: 'CACHE_ERROR', description: '缓存错误', httpStatus: 500, statusType: 'server_error', module: BusinessModule.COMMON, operation: 5 }
  ])

  // 注册用户业务码
  BusinessCodeRegistry.registerBatch([
    { code: UserBusinessCode.USER_CREATED, name: 'USER_CREATED', description: '用户创建成功', httpStatus: 201, statusType: 'success', module: BusinessModule.USER, operation: 1 },
    { code: UserBusinessCode.USER_RETRIEVED, name: 'USER_RETRIEVED', description: '用户获取成功', httpStatus: 200, statusType: 'success', module: BusinessModule.USER, operation: 2 },
    { code: UserBusinessCode.USERS_RETRIEVED, name: 'USERS_RETRIEVED', description: '用户列表获取成功', httpStatus: 200, statusType: 'success', module: BusinessModule.USER, operation: 3 },
    { code: UserBusinessCode.USER_UPDATED, name: 'USER_UPDATED', description: '用户更新成功', httpStatus: 200, statusType: 'success', module: BusinessModule.USER, operation: 4 },
    { code: UserBusinessCode.USER_DELETED, name: 'USER_DELETED', description: '用户删除成功', httpStatus: 200, statusType: 'success', module: BusinessModule.USER, operation: 5 },
    { code: UserBusinessCode.USER_LOGIN_SUCCESS, name: 'USER_LOGIN_SUCCESS', description: '用户登录成功', httpStatus: 200, statusType: 'success', module: BusinessModule.USER, operation: 6 },
    { code: UserBusinessCode.USER_LOGOUT_SUCCESS, name: 'USER_LOGOUT_SUCCESS', description: '用户登出成功', httpStatus: 200, statusType: 'success', module: BusinessModule.USER, operation: 7 },
    
    { code: UserBusinessCode.USER_NOT_FOUND, name: 'USER_NOT_FOUND', description: '用户不存在', httpStatus: 404, statusType: 'client_error', module: BusinessModule.USER, operation: 10 },
    { code: UserBusinessCode.USER_ALREADY_EXISTS, name: 'USER_ALREADY_EXISTS', description: '用户已存在', httpStatus: 409, statusType: 'client_error', module: BusinessModule.USER, operation: 11 },
    { code: UserBusinessCode.INVALID_CREDENTIALS, name: 'INVALID_CREDENTIALS', description: '凭据无效', httpStatus: 401, statusType: 'client_error', module: BusinessModule.USER, operation: 17 },
    { code: UserBusinessCode.USER_DISABLED, name: 'USER_DISABLED', description: '用户已禁用', httpStatus: 403, statusType: 'client_error', module: BusinessModule.USER, operation: 15 },
    
    { code: UserBusinessCode.USER_CREATE_FAILED, name: 'USER_CREATE_FAILED', description: '用户创建失败', httpStatus: 500, statusType: 'server_error', module: BusinessModule.USER, operation: 10 },
    { code: UserBusinessCode.USER_UPDATE_FAILED, name: 'USER_UPDATE_FAILED', description: '用户更新失败', httpStatus: 500, statusType: 'server_error', module: BusinessModule.USER, operation: 11 }
  ])

  // 注册订单业务码
  BusinessCodeRegistry.registerBatch([
    { code: OrderBusinessCode.ORDER_CREATED, name: 'ORDER_CREATED', description: '订单创建成功', httpStatus: 201, statusType: 'success', module: BusinessModule.ORDER, operation: 1 },
    { code: OrderBusinessCode.ORDER_RETRIEVED, name: 'ORDER_RETRIEVED', description: '订单获取成功', httpStatus: 200, statusType: 'success', module: BusinessModule.ORDER, operation: 2 },
    { code: OrderBusinessCode.ORDER_UPDATED, name: 'ORDER_UPDATED', description: '订单更新成功', httpStatus: 200, statusType: 'success', module: BusinessModule.ORDER, operation: 4 },
    { code: OrderBusinessCode.ORDER_CANCELLED, name: 'ORDER_CANCELLED', description: '订单取消成功', httpStatus: 200, statusType: 'success', module: BusinessModule.ORDER, operation: 5 },
    
    { code: OrderBusinessCode.ORDER_NOT_FOUND, name: 'ORDER_NOT_FOUND', description: '订单不存在', httpStatus: 404, statusType: 'client_error', module: BusinessModule.ORDER, operation: 10 },
    { code: OrderBusinessCode.ORDER_CANNOT_BE_UPDATED, name: 'ORDER_CANNOT_BE_UPDATED', description: '订单无法修改', httpStatus: 400, statusType: 'client_error', module: BusinessModule.ORDER, operation: 15 },
    
    { code: OrderBusinessCode.ORDER_CREATE_FAILED, name: 'ORDER_CREATE_FAILED', description: '订单创建失败', httpStatus: 500, statusType: 'server_error', module: BusinessModule.ORDER, operation: 10 }
  ])

  // 注册商品业务码
  BusinessCodeRegistry.registerBatch([
    { code: ProductBusinessCode.PRODUCT_CREATED, name: 'PRODUCT_CREATED', description: '商品创建成功', httpStatus: 201, statusType: 'success', module: BusinessModule.PRODUCT, operation: 1 },
    { code: ProductBusinessCode.PRODUCT_UPDATED, name: 'PRODUCT_UPDATED', description: '商品更新成功', httpStatus: 200, statusType: 'success', module: BusinessModule.PRODUCT, operation: 4 },
    { code: ProductBusinessCode.PRODUCT_DELETED, name: 'PRODUCT_DELETED', description: '商品删除成功', httpStatus: 200, statusType: 'success', module: BusinessModule.PRODUCT, operation: 5 },
    
    { code: ProductBusinessCode.PRODUCT_NOT_FOUND, name: 'PRODUCT_NOT_FOUND', description: '商品不存在', httpStatus: 404, statusType: 'client_error', module: BusinessModule.PRODUCT, operation: 10 },
    { code: ProductBusinessCode.PRODUCT_ALREADY_EXISTS, name: 'PRODUCT_ALREADY_EXISTS', description: '商品已存在', httpStatus: 409, statusType: 'client_error', module: BusinessModule.PRODUCT, operation: 11 },
    
    { code: ProductBusinessCode.PRODUCT_CREATE_FAILED, name: 'PRODUCT_CREATE_FAILED', description: '商品创建失败', httpStatus: 500, statusType: 'server_error', module: BusinessModule.PRODUCT, operation: 10 }
  ])

  // 注册支付业务码
  BusinessCodeRegistry.registerBatch([
    { code: PaymentBusinessCode.PAYMENT_SUCCESS, name: 'PAYMENT_SUCCESS', description: '支付成功', httpStatus: 200, statusType: 'success', module: BusinessModule.PAYMENT, operation: 1 },
    { code: PaymentBusinessCode.REFUND_SUCCESS, name: 'REFUND_SUCCESS', description: '退款成功', httpStatus: 200, statusType: 'success', module: BusinessModule.PAYMENT, operation: 4 },
    
    { code: PaymentBusinessCode.PAYMENT_NOT_FOUND, name: 'PAYMENT_NOT_FOUND', description: '支付记录不存在', httpStatus: 404, statusType: 'client_error', module: BusinessModule.PAYMENT, operation: 10 },
    { code: PaymentBusinessCode.INSUFFICIENT_BALANCE, name: 'INSUFFICIENT_BALANCE', description: '余额不足', httpStatus: 400, statusType: 'client_error', module: BusinessModule.PAYMENT, operation: 13 },
    
    { code: PaymentBusinessCode.PAYMENT_PROCESSING_FAILED, name: 'PAYMENT_PROCESSING_FAILED', description: '支付处理失败', httpStatus: 500, statusType: 'server_error', module: BusinessModule.PAYMENT, operation: 10 }
  ])

  // 注册系统业务码
  BusinessCodeRegistry.registerBatch([
    { code: SystemBusinessCode.HEALTH_CHECK_SUCCESS, name: 'HEALTH_CHECK_SUCCESS', description: '健康检查成功', httpStatus: 200, statusType: 'success', module: BusinessModule.SYSTEM, operation: 1 },
    { code: SystemBusinessCode.SYSTEM_STATUS_OK, name: 'SYSTEM_STATUS_OK', description: '系统状态正常', httpStatus: 200, statusType: 'success', module: BusinessModule.SYSTEM, operation: 2 },
    
    { code: SystemBusinessCode.SYSTEM_MAINTENANCE, name: 'SYSTEM_MAINTENANCE', description: '系统维护中', httpStatus: 503, statusType: 'client_error', module: BusinessModule.SYSTEM, operation: 10 },
    
    { code: SystemBusinessCode.SYSTEM_ERROR, name: 'SYSTEM_ERROR', description: '系统错误', httpStatus: 500, statusType: 'server_error', module: BusinessModule.SYSTEM, operation: 10 },
    { code: SystemBusinessCode.DATABASE_CONNECTION_FAILED, name: 'DATABASE_CONNECTION_FAILED', description: '数据库连接失败', httpStatus: 500, statusType: 'server_error', module: BusinessModule.SYSTEM, operation: 11 }
  ])

  // 注册角色业务码
  BusinessCodeRegistry.registerBatch([
    { code: RoleBusinessCode.ROLE_CREATED, name: 'ROLE_CREATED', description: '角色创建成功', httpStatus: 201, statusType: 'success', module: BusinessModule.ROLE, operation: 1 },
    { code: RoleBusinessCode.ROLE_UPDATED, name: 'ROLE_UPDATED', description: '角色更新成功', httpStatus: 200, statusType: 'success', module: BusinessModule.ROLE, operation: 4 },
    { code: RoleBusinessCode.ROLE_DELETED, name: 'ROLE_DELETED', description: '角色删除成功', httpStatus: 200, statusType: 'success', module: BusinessModule.ROLE, operation: 5 },
    
    { code: RoleBusinessCode.ROLE_NOT_FOUND, name: 'ROLE_NOT_FOUND', description: '角色不存在', httpStatus: 404, statusType: 'client_error', module: BusinessModule.ROLE, operation: 10 },
    { code: RoleBusinessCode.ROLE_ALREADY_EXISTS, name: 'ROLE_ALREADY_EXISTS', description: '角色已存在', httpStatus: 409, statusType: 'client_error', module: BusinessModule.ROLE, operation: 11 },
    
    { code: RoleBusinessCode.ROLE_CREATE_FAILED, name: 'ROLE_CREATE_FAILED', description: '角色创建失败', httpStatus: 500, statusType: 'server_error', module: BusinessModule.ROLE, operation: 10 }
  ])
}

// 立即执行注册
registerAllBusinessCodes()

// 导出注册函数，供测试或重新初始化使用
export { registerAllBusinessCodes }