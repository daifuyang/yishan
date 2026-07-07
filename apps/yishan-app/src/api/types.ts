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

/* ===================== 业务模型类型 ===================== */

export interface LoginData {
  token: string
  refreshToken?: string
  expiresIn: number
  refreshTokenExpiresIn?: number
  expiresAt?: number
  refreshTokenExpiresAt?: number
}

export interface CurrentUser {
  id: number
  username?: string
  email?: string
  phone?: string
  realName?: string
  nickname?: string
  avatar?: string
  gender: '0' | '1' | '2'
  genderName: string
  birthDate?: string
  status: '0' | '1' | '2'
  statusName: string
  lastLoginTime?: string
  lastLoginIp?: string
  loginCount: number
  createdAt: string
  updatedAt: string
  deptIds?: number[]
  roleIds?: number[]
  accessPath?: string[]
  /**
   * 当前用户拥有的权限码列表（用于按权限控制写动作）
   * TODO: 后端在 /api/v1/app/auth/me 暂未下发此字段，缺失时前端默认放行
   */
  permissions?: string[]
}

export interface SysMenuNode {
  id: number
  name: string
  type: 0 | 1 | 2
  path?: string
  icon?: string
  component?: string
  parentId?: number
  parentName?: string
  status: '0' | '1'
  sort_order: number
  hideInMenu: boolean
  isExternalLink: boolean
  perm?: string
  keepAlive: boolean
  children?: SysMenuNode[] | null
  createdAt: string
  updatedAt: string
}

export interface DeptUser {
  id: number
  username?: string
  realName: string
  phone: string
  email: string
  avatar: string
  gender: string
  genderName: string
}

export interface LoginLog {
  id: number
  userId?: number
  username: string
  realName?: string
  status: '0' | '1'
  message?: string
  ipAddress?: string
  userAgent?: string
  createdAt: string
  updatedAt: string
}

export interface DictItem {
  id: number
  typeId: number
  type: string
  label: string
  value: string
  tag?: string
  sortOrder: number
  isDefault: boolean
}

export interface DashboardStats {
  userTotal: number
  deptTotal: number
  todayLogin: number
  online: number
}

