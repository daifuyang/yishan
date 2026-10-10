export { ApiError, UnauthorizedError, RequestCancelledError } from '@yishan/core-app/request/types'
export type { ApiResponse, ApiErrorPayload, TokenData as LoginData } from '@yishan/core-app/request/types'

/* ===================== 业务模型类型 ===================== */

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
  /** 当前用户拥有的权限码列表（服务端未下发时前端默认拒绝） */
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
  permissionCodes?: string[]
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
