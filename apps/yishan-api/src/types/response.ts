/**
 * 统一响应体类型定义
 * 基于业务码体系，而非HTTP状态码
 */

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
   * 响应数据
   * 泛型类型，可根据具体接口返回不同数据结构
   * 错误响应时此字段为可选
   */
  data?: T
  
  /**
   * 时间戳
   * 响应生成的时间戳（毫秒）
   */
  timestamp: number
  
  /**
   * 请求ID
   * 用于请求链路追踪，分布式系统调试
   */
  requestId?: string
  
  /**
   * 响应路径
   * 当前请求的API路径
   */
  path?: string
  
  /**
   * 响应方法
   * HTTP请求方法（GET, POST, PUT, DELETE等）
   */
  method?: string
}

/**
 * 成功响应体
 * 用于标准成功响应场景
 */
export interface SuccessResponse<T = any> extends BaseResponse<T> {
  code: number
  message: string
  data: T
}

/**
 * 创建成功响应体
 * 专用于资源创建成功的响应
 */
export interface CreatedResponse<T = any> extends BaseResponse<T> {
  code: number
  message: string
  data: T
}

/**
 * 更新成功响应体
 * 专用于资源更新成功的响应
 */
export interface UpdatedResponse<T = any> extends BaseResponse<T> {
  code: number
  message: string
  data: T
}

/**
 * 删除成功响应体
 * 专用于资源删除成功的响应
 */
export interface DeletedResponse extends BaseResponse<null> {
  code: number
  message: string
  data: null
}

/**
 * 错误响应体
 * 用于所有错误响应场景
 */
export interface ErrorResponse extends BaseResponse<null> {
  code: number
  message: string
  data: null
  
  /**
   * 错误详情
   * 包含详细的错误信息，便于调试和错误处理
   */
  error?: {
    /**
     * 错误类型
     * 错误分类标识，如ValidationError, BusinessError, SystemError等
     */
    type: string
    
    /**
     * 错误描述
     * 详细的错误信息，可能包含解决方案建议
     */
    description: string
    
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
 * 分页响应数据
 * 用于分页查询的标准数据结构
 */
export interface PaginatedData<T = any> {
  /**
   * 数据列表
   * 当前页的数据集合
   */
  list: T[]
  
  /**
   * 总记录数
   * 符合查询条件的总记录数
   */
  total: number
  
  /**
   * 当前页码
   * 从1开始的页码
   */
  page: number
  
  /**
   * 每页记录数
   */
  pageSize: number
  
  /**
   * 总页数
   * 基于总记录数和每页记录数计算得出
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
 * 分页查询的标准响应格式
 */
export interface PaginatedResponse<T = any> extends BaseResponse<PaginatedData<T>> {
  code: number
  data: PaginatedData<T>
}

/**
 * 列表响应体
 * 非分页列表数据的标准响应格式
 */
export interface ListResponse<T = any> extends BaseResponse<T[]> {
  code: number
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
 */
export const BusinessCode = {
  // 通用成功码
  SUCCESS: 20000,
  CREATED: 20001,
  UPDATED: 20002,
  DELETED: 20003,
  
  // 通用客户端错误码
  BAD_REQUEST: 40000,
  UNAUTHORIZED: 40001,
  FORBIDDEN: 40003,
  NOT_FOUND: 40004,
  VALIDATION_ERROR: 40010,
  
  // 用户模块
  USER_NOT_FOUND: 40100,
  USER_ALREADY_EXISTS: 40101,
  USER_DISABLED: 40102,
  
  // 订单模块
  ORDER_NOT_FOUND: 40200,
  ORDER_STATUS_INVALID: 40201,
  ORDER_PAYMENT_FAILED: 40202,
  
  // 商品模块
  PRODUCT_NOT_FOUND: 40300,
  PRODUCT_OUT_OF_STOCK: 40301,
  
  // 支付模块
  PAYMENT_FAILED: 40400,
  PAYMENT_TIMEOUT: 40401,
  
  // 系统模块
  SYSTEM_ERROR: 50000,
  DATABASE_ERROR: 50001,
  EXTERNAL_SERVICE_ERROR: 50002,
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