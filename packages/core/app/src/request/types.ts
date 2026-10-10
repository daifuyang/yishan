/**
 * 通用 API 响应结构
 */
export interface ApiResponse<T = unknown> {
  success: boolean
  code: number
  message: string
  data: T
  timestamp: string
  pagination?: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

export interface ApiErrorPayload {
  code: number
  message: string
  details?: string
}

/**
 * API 业务错误：与后端业务码约定对齐
 */
export class ApiError extends Error {
  code: number
  httpStatus?: number
  details?: string

  constructor(code: number, message: string, httpStatus?: number, details?: string) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.httpStatus = httpStatus
    this.details = details
  }
}

/**
 * 401 错误：用于触发跳登录
 */
export class UnauthorizedError extends ApiError {
  constructor(message = '未登录或登录已过期') {
    super(401, message, 401)
    this.name = 'UnauthorizedError'
  }
}

export class RequestCancelledError extends ApiError {
  constructor() {
    super(-3, '请求已取消')
    this.name = 'RequestCancelledError'
  }
}

export interface TokenData {
  token: string
  refreshToken?: string
  expiresIn: number
  refreshTokenExpiresIn?: number
  expiresAt?: number
  refreshTokenExpiresAt?: number
}
