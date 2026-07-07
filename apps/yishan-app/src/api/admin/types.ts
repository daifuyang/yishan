/**
 * 通用分页响应（与后端 PaginationResponse 对齐）
 * 注：实际使用从 @/api 的 client.Pagination 引入
 */
export type { Pagination } from '../client'

/* ============== 通用查询基类 ============== */

export interface AdminListQueryBase {
  page?: number
  pageSize?: number
  keyword?: string
}

/* ============== 用户 ============== */

export interface AdminUser {
  id: number
  username?: string
  email?: string
  phone: string
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
  creatorId: number
  creatorName?: string
  createdAt: string
  updaterId: number
  updaterName?: string
  updatedAt: string
  deptIds?: number[]
  roleIds?: number[]
}

export interface CreateAdminUserReq {
  username?: string
  email?: string
  password: string
  phone: string
  realName?: string
  nickname?: string
  avatar?: string
  gender?: '0' | '1' | '2'
  birthDate?: string
  status?: '0' | '1' | '2'
  deptIds?: number[]
  roleIds?: number[]
}

export type UpdateAdminUserReq = Partial<CreateAdminUserReq>

export interface AdminUserListQuery {
  page?: number
  pageSize?: number
  keyword?: string
  status?: '0' | '1' | '2'
  startTime?: string
  endTime?: string
  sortBy?: 'createdAt' | 'updatedAt' | 'lastLoginTime' | 'loginCount'
  sortOrder?: 'asc' | 'desc'
  [key: string]: unknown
}

export interface AdminUserListResp {
  list: AdminUser[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

/* ============== 部门 ============== */

export interface AdminDept {
  id: number
  name: string
  parentId?: number
  parentName?: string
  status: '0' | '1'
  sort_order: number
  description?: string
  leaderId?: number
  leaderName?: string
  creatorId?: number
  creatorName?: string
  createdAt: string
  updaterId?: number
  updaterName?: string
  updatedAt: string
  children?: AdminDept[] | null
}

export interface AdminDeptListQuery {
  page?: number
  pageSize?: number
  keyword?: string
  status?: '0' | '1'
  parentId?: number
  sortBy?: 'sort_order' | 'createdAt' | 'updatedAt'
  sortOrder?: 'asc' | 'desc'
  [key: string]: unknown
}

/* ============== 角色 ============== */

export interface AdminRole {
  id: number
  name: string
  description?: string
  status: '0' | '1'
  dataScope: '1' | '2' | '3' | '4' | '5'
  isSystemDefault?: boolean
  creatorId?: number
  creatorName?: string
  createdAt: string
  updaterId?: number
  updaterName?: string
  updatedAt: string
  menuIds?: number[]
}

export interface AdminRoleListQuery {
  page?: number
  pageSize?: number
  keyword?: string
  status?: '0' | '1'
  sortBy?: 'createdAt' | 'updatedAt'
  sortOrder?: 'asc' | 'desc'
  [key: string]: unknown
}

/* ============== 字典 ============== */

export interface AdminDictType {
  id: number
  name: string
  type: string
  status: '0' | '1'
  remark?: string
  createdAt: string
  updatedAt: string
}

export interface AdminDictData {
  id: number
  typeId: number
  type: string
  label: string
  value: string
  tag?: string
  sortOrder: number
  isDefault: boolean
  status: '0' | '1'
  remark?: string
}

export interface AdminDictTypeListQuery {
  page?: number
  pageSize?: number
  keyword?: string
  status?: '0' | '1'
  [key: string]: unknown
}

export interface AdminDictDataListQuery {
  page?: number
  pageSize?: number
  typeId?: number
  keyword?: string
  status?: '0' | '1'
  [key: string]: unknown
}

/* ============== 登录日志 ============== */

export interface AdminLoginLog {
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

export interface AdminLoginLogListQuery {
  page?: number
  pageSize?: number
  username?: string
  status?: '0' | '1'
  startTime?: string
  endTime?: string
  [key: string]: unknown
}
