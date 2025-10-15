/**
 * 统一响应体类型定义
 * 基于业务码体系，而非HTTP状态码
 */

import {
  CommonBusinessCode,
  UserBusinessCode,
  OrderBusinessCode,
  ProductBusinessCode,
  PaymentBusinessCode,
  SystemBusinessCode
} from '../constants/business-code.js'

/**
 * 统一响应体基础接口
 * 所有响应类型的基础结构
 */
export interface BaseResponse<T = any> {
  /**
   * 业务状态码
   * 5位数字编码，前两位表示模块，后三位表示具体业务场景
   * 成功: 200xx, 客户端错误: 400xx, 服务器错误: 500xx
   * 示例: 20000(成功), 40010(参数错误), 50000(服务器错误)
   */
  code: number
  
  /**
   * 响应消息
   * 用于描述请求处理结果，支持国际化
   */
  message: string
  
  /**
   * 请求是否成功
   * 基于业务码判断，true表示成功(20000-29999)，false表示失败
   */
  isSuccess: boolean
  
  /**
   * 响应数据
   * 泛型类型，可根据具体接口返回不同数据结构
   * 错误响应时此字段为可选
   */
  data?: T
}

/**
 * 成功响应体
 * 用于标准成功响应场景
 */
export interface SuccessResponse<T = any> extends BaseResponse<T> {
  code: number
  message: string
  isSuccess: true
  data: T
}

/**
 * 创建成功响应体
 * 专用于资源创建成功的响应
 */
export interface CreatedResponse<T = any> extends BaseResponse<T> {
  code: number
  message: string
  isSuccess: true
  data: T
}

/**
 * 更新成功响应体
 * 专用于资源更新成功的响应
 */
export interface UpdatedResponse<T = any> extends BaseResponse<T> {
  code: number
  message: string
  isSuccess: true
  data: T
}

/**
 * 删除成功响应体
 * 专用于资源删除成功的响应，通常不返回数据
 */
export interface DeletedResponse extends BaseResponse<null> {
  code: number
  message: string
  isSuccess: true
  data: null
}

/**
 * 错误响应体
 * 用于所有错误场景的统一响应格式
 */
export interface ErrorResponse extends BaseResponse<null> {
  code: number
  message: string
  isSuccess: false
  data: null
  
  /**
   * 错误详情
   * 包含错误的具体信息和调试数据
   */
  error?: {
    /**
     * 错误类型
     * 用于前端错误分类处理
     */
    type?: string
    
    /**
     * 错误详细描述
     * 开发者友好的错误信息
     */
    detail?: string
    
    /**
     * 错误堆栈（开发环境）
     * 仅在开发环境返回，生产环境应隐藏
     */
    stack?: string
    
    /**
     * 验证错误详情
     * 参数验证失败时的具体错误信息
     */
    validation?: Record<string, string[]>
    
    /**
     * 错误追踪ID
     * 用于错误日志关联和排查
     */
    errorId?: string
  }
}

/**
 * 分页数据结构
 * 用于分页响应的数据部分
 */
export interface PaginatedData<T = any> {
  /**
   * 数据列表
   */
  list: T[]
  
  /**
   * 分页信息
   */
  pagination: {
    /**
     * 当前页码
     */
    page: number
    
    /**
     * 每页条数
     */
    pageSize: number
    
    /**
     * 总记录数
     */
    total: number
    
    /**
     * 总页数
     */
    totalPages: number
  }
}

/**
 * 分页响应体
 * 用于分页查询响应
 */
export interface PaginatedResponse<T = any> extends BaseResponse {
  code: number
  message: string
  isSuccess: true
  data: PaginatedData<T>
}

/**
 * 列表响应体
 * 非分页列表数据的标准响应格式
 */
export interface ListResponse<T = any> extends BaseResponse<T[]> {
  code: number
  message: string
  isSuccess: true
  data: T[]
}

/**
 * 通用响应类型
 * 所有可能的响应类型联合
 */
export type ApiResponse<T = any> = 
  | SuccessResponse<T>
  | CreatedResponse<T>
  | UpdatedResponse<T>
  | DeletedResponse
  | ErrorResponse
  | PaginatedResponse<T>
  | ListResponse<T>

/**
 * 业务码类型
 * 用于类型约束，确保业务码的正确性
 */
export type BusinessCode = number

/**
 * 业务码分类
 * 按模块和业务场景分类的业务码常量
 * 从 business-code.ts 导入，保持一致性
 */
export const BusinessCode = {
  // 通用成功码
  SUCCESS: CommonBusinessCode.SUCCESS,
  CREATED: CommonBusinessCode.CREATED,
  UPDATED: CommonBusinessCode.UPDATED,
  DELETED: CommonBusinessCode.DELETED,
  
  // 通用客户端错误码
  BAD_REQUEST: CommonBusinessCode.BAD_REQUEST,
  UNAUTHORIZED: CommonBusinessCode.UNAUTHORIZED,
  FORBIDDEN: CommonBusinessCode.FORBIDDEN,
  NOT_FOUND: CommonBusinessCode.NOT_FOUND,
  VALIDATION_ERROR: CommonBusinessCode.UNPROCESSABLE_ENTITY,
  
  // 用户模块
  USER_NOT_FOUND: UserBusinessCode.USER_NOT_FOUND,
  USER_ALREADY_EXISTS: UserBusinessCode.USER_ALREADY_EXISTS,
  USER_DISABLED: UserBusinessCode.USER_DISABLED,
  
  // 订单模块
  ORDER_NOT_FOUND: OrderBusinessCode.ORDER_NOT_FOUND,
  ORDER_STATUS_INVALID: OrderBusinessCode.ORDER_STATUS_INVALID,
  ORDER_PAYMENT_FAILED: PaymentBusinessCode.PAYMENT_PROCESSING_FAILED,
  
  // 商品模块
  PRODUCT_NOT_FOUND: ProductBusinessCode.PRODUCT_NOT_FOUND,
  PRODUCT_OUT_OF_STOCK: ProductBusinessCode.PRODUCT_OUT_OF_STOCK,
  
  // 支付模块
  PAYMENT_FAILED: PaymentBusinessCode.PAYMENT_PROCESSING_FAILED,
  PAYMENT_TIMEOUT: PaymentBusinessCode.PAYMENT_GATEWAY_ERROR,
  
  // 系统模块
  SYSTEM_ERROR: CommonBusinessCode.INTERNAL_SERVER_ERROR,
  DATABASE_ERROR: CommonBusinessCode.DATABASE_ERROR,
  EXTERNAL_SERVICE_ERROR: SystemBusinessCode.EXTERNAL_SERVICE_ERROR,
} as const

/**
 * 业务码类型定义
 * 用于类型检查和自动补全
 */
export type BusinessCodeType = typeof BusinessCode[keyof typeof BusinessCode]

/**
 * 响应消息枚举
 * 标准化的响应消息模板
 */
export const ResponseMessage = {
  // 成功消息
  SUCCESS: '操作成功',
  CREATED: '创建成功',
  UPDATED: '更新成功',
  DELETED: '删除成功',
  
  // 客户端错误消息
  BAD_REQUEST: '请求参数错误',
  UNAUTHORIZED: '未授权访问',
  FORBIDDEN: '权限不足',
  NOT_FOUND: '资源不存在',
  VALIDATION_ERROR: '参数验证失败',
  
  // 服务器错误消息
  INTERNAL_SERVER_ERROR: '服务器内部错误',
  SERVICE_UNAVAILABLE: '服务暂不可用',
  
  // 默认消息
  UNKNOWN_ERROR: '未知错误',
} as const

/**
 * 响应消息类型
 */
export type ResponseMessageType = typeof ResponseMessage[keyof typeof ResponseMessage]