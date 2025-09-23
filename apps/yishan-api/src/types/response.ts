/**
 * 统一响应体类型定义
 */

/**
 * 统一响应体基础接口
 */
export interface BaseResponse<T = any> {
  /**
   * 响应状态码
   * 遵循 HTTP 状态码规范
   */
  code: number
  
  /**
   * 响应消息
   * 用于描述请求处理结果
   */
  message: string
  
  /**
   * 响应数据
   * 泛型类型，可根据具体接口返回不同数据结构
   */
  data?: T
  
  /**
   * 时间戳
   * 响应生成的时间戳（毫秒）
   */
  timestamp: number
  
  /**
   * 请求ID
   * 用于请求链路追踪
   */
  requestId?: string
  
  /**
   * 响应路径
   * 当前请求的API路径
   */
  path?: string
  
  /**
   * 响应方法
   * HTTP请求方法
   */
  method?: string
}

/**
 * 成功响应体
 */
export interface SuccessResponse<T = any> extends BaseResponse<T> {
  code: 200 | 201 | 204
  message: string
  data: T
}

/**
 * 错误响应体
 */
export interface ErrorResponse extends BaseResponse<null> {
  code: number
  message: string
  data: null
  
  /**
   * 错误详情
   * 包含详细的错误信息
   */
  error?: {
    /**
     * 错误类型
     */
    type: string
    
    /**
     * 错误描述
     */
    description: string
    
    /**
     * 错误堆栈（开发环境）
     */
    stack?: string
    
    /**
     * 验证错误详情
     */
    validation?: Record<string, string[]>
  }
}

/**
 * 分页响应数据
 */
export interface PaginatedData<T = any> {
  /**
   * 数据列表
   */
  list: T[]
  
  /**
   * 总记录数
   */
  total: number
  
  /**
   * 当前页码
   */
  page: number
  
  /**
   * 每页记录数
   */
  pageSize: number
  
  /**
   * 总页数
   */
  totalPages: number
  
  /**
   * 是否有下一页
   */
  hasNext: boolean
  
  /**
   * 是否有上一页
   */
  hasPrev: boolean
}

/**
 * 分页响应体
 */
export interface PaginatedResponse<T = any> extends BaseResponse<PaginatedData<T>> {
  code: 200
  data: PaginatedData<T>
}

/**
 * 列表响应体
 */
export interface ListResponse<T = any> extends BaseResponse<T[]> {
  code: 200
  data: T[]
}

/**
 * 通用响应类型
 */
export type ApiResponse<T = any> = SuccessResponse<T> | ErrorResponse | PaginatedResponse<T> | ListResponse<T>

/**
 * 响应码枚举
 */
export enum ResponseCode {
  // 成功状态码
  SUCCESS = 200,
  CREATED = 201,
  ACCEPTED = 202,
  NO_CONTENT = 204,
  
  // 客户端错误
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  METHOD_NOT_ALLOWED = 405,
  CONFLICT = 409,
  UNPROCESSABLE_ENTITY = 422,
  TOO_MANY_REQUESTS = 429,
  
  // 服务器错误
  INTERNAL_SERVER_ERROR = 500,
  NOT_IMPLEMENTED = 501,
  BAD_GATEWAY = 502,
  SERVICE_UNAVAILABLE = 503,
  GATEWAY_TIMEOUT = 504
}

/**
 * 响应消息枚举
 */
export enum ResponseMessage {
  SUCCESS = '操作成功',
  CREATED = '创建成功',
  UPDATED = '更新成功',
  DELETED = '删除成功',
  BAD_REQUEST = '请求参数错误',
  UNAUTHORIZED = '未授权访问',
  FORBIDDEN = '权限不足',
  NOT_FOUND = '资源不存在',
  METHOD_NOT_ALLOWED = '请求方法不允许',
  CONFLICT = '资源冲突',
  UNPROCESSABLE_ENTITY = '请求参数验证失败',
  TOO_MANY_REQUESTS = '请求过于频繁',
  INTERNAL_SERVER_ERROR = '服务器内部错误',
  SERVICE_UNAVAILABLE = '服务暂不可用'
}