/**
 * 统一响应类型定义
 * 基于支付宝风格的响应格式，使用新的业务码体系
 */

import { 
  SUCCESS_CODE
} from '../constants/business-code.js'

/**
 * 基础响应接口
 */
export interface BaseResponse<T = any> {
  /**
   * 业务码
   */
  code: number
  
  /**
   * 响应消息
   */
  message: string
  
  /**
   * 是否成功（支付宝风格）
   */
  success: boolean
  
  /**
   * 响应数据
   */
  data?: T
  
  /**
   * 时间戳
   */
  timestamp?: string
  
  /**
   * 请求ID
   */
  request_id?: string
  
  /**
   * 子错误码
   */
  sub_code?: string
  
  /**
   * 子错误消息
   */
  sub_message?: string
}

/**
 * 成功响应体
 */
export interface SuccessResponse<T = any> extends BaseResponse<T> {
  code: typeof SUCCESS_CODE
  message: string
  success: true
  data: T
}

/**
 * 创建成功响应体
 */
export interface CreatedResponse<T = any> extends BaseResponse<T> {
  code: typeof SUCCESS_CODE
  message: string
  success: true
  data: T
}

/**
 * 更新成功响应体
 */
export interface UpdatedResponse<T = any> extends BaseResponse<T> {
  code: typeof SUCCESS_CODE
  message: string
  success: true
  data?: T
}

/**
 * 删除成功响应体
 */
export interface DeletedResponse extends BaseResponse {
  code: typeof SUCCESS_CODE
  message: string
  success: true
}

/**
 * 错误响应体
 */
export interface ErrorResponse extends BaseResponse {
  code: number
  message: string
  success: false
  sub_code?: string
  sub_message?: string
}

/**
 * 分页数据结构
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
     * 每页数量
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
 */
export interface PaginatedResponse<T = any> extends BaseResponse {
  code: typeof SUCCESS_CODE
  message: string
  success: true
  data: PaginatedData<T>
}

/**
 * 列表响应体
 */
export interface ListResponse<T = any> extends BaseResponse<T[]> {
  code: typeof SUCCESS_CODE
  message: string
  success: true
  data: T[]
}

/**
 * 统一API响应类型
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
 * 响应消息常量
 */
export const ResponseMessage = {
  // 成功消息
  SUCCESS: '操作成功',
  CREATED: '创建成功',
  UPDATED: '更新成功',
  DELETED: '删除成功',
  
  // 错误消息
  BAD_REQUEST: '请求参数错误',
  UNAUTHORIZED: '未授权访问',
  FORBIDDEN: '权限不足',
  NOT_FOUND: '资源不存在',
  VALIDATION_ERROR: '参数验证失败',
  
  // 系统错误消息
  INTERNAL_SERVER_ERROR: '服务器内部错误',
  SERVICE_UNAVAILABLE: '服务暂不可用',
  
  // 通用错误消息
  UNKNOWN_ERROR: '未知错误',
} as const

/**
 * 响应消息类型
 */
export type ResponseMessageType = typeof ResponseMessage[keyof typeof ResponseMessage]