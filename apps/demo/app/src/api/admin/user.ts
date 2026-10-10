/**
 * 系统管理 - 用户管理 API
 * 后端路径：/api/v1/admin/users
 */
import { request, requestPaginated } from '../client'
import type {
  AdminUser,
  AdminUserListQuery,
  CreateAdminUserReq,
  UpdateAdminUserReq,
} from './types'

/** 用户列表（带分页） */
export function listAdminUsers(query: AdminUserListQuery) {
  return requestPaginated<AdminUser[]>({
    method: 'GET',
    path: '/api/v1/admin/users',
    query,
  })
}

/** 用户详情 */
export function getAdminUser(id: number) {
  return request<AdminUser>({
    method: 'GET',
    path: `/api/v1/admin/users/${id}`,
  })
}

/** 创建用户 */
export function createAdminUser(data: CreateAdminUserReq) {
  return request<AdminUser>({
    method: 'POST',
    path: '/api/v1/admin/users',
    data,
  })
}

/** 更新用户 */
export function updateAdminUser(id: number, data: UpdateAdminUserReq) {
  return request<AdminUser>({
    method: 'PUT',
    path: `/api/v1/admin/users/${id}`,
    data,
  })
}

/** 删除用户 */
export function deleteAdminUser(id: number) {
  return request<{ id: number; deleted: boolean }>({
    method: 'DELETE',
    path: `/api/v1/admin/users/${id}`,
  })
}

/** 重置密码（后端字段约定：newPassword） */
export function resetAdminUserPassword(id: number, newPassword: string) {
  return request<null>({
    method: 'PUT',
    path: `/api/v1/admin/users/${id}/password`,
    data: { newPassword },
  })
}
