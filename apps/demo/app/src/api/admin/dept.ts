/**
 * 系统管理 - 部门管理 API
 * 后端路径：/api/v1/admin/departments
 */
import { request, requestPaginated } from '../client'
import type { AdminDept, AdminDeptListQuery } from './types'

/** 部门列表（带分页） */
export function listAdminDepts(query: AdminDeptListQuery = {}) {
  return requestPaginated<AdminDept[]>({
    method: 'GET',
    path: '/api/v1/admin/departments',
    query,
  })
}

/** 部门树（无需分页，用于表单选择） */
export function getAdminDeptTree() {
  return request<AdminDept[]>({
    method: 'GET',
    path: '/api/v1/admin/departments/tree',
  })
}

/** 部门详情 */
export function getAdminDept(id: number) {
  return request<AdminDept>({
    method: 'GET',
    path: `/api/v1/admin/departments/${id}`,
  })
}

/** 创建部门 */
export function createAdminDept(data: {
  name: string
  parentId?: number
  status?: '0' | '1'
  sort_order?: number
  description?: string
  leaderId?: number
}) {
  return request<AdminDept>({
    method: 'POST',
    path: '/api/v1/admin/departments',
    data,
  })
}

/** 更新部门 */
export function updateAdminDept(id: number, data: Partial<{
  name: string
  parentId: number
  status: '0' | '1'
  sort_order: number
  description: string
  leaderId: number
}>) {
  return request<AdminDept>({
    method: 'PUT',
    path: `/api/v1/admin/departments/${id}`,
    data,
  })
}

/** 删除部门 */
export function deleteAdminDept(id: number) {
  return request<{ id: number }>({
    method: 'DELETE',
    path: `/api/v1/admin/departments/${id}`,
  })
}
