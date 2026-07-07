/**
 * 系统管理 - 字典管理 API
 * 后端路径：/api/v1/admin/dicts
 */
import { request, requestPaginated } from '../client'
import type {
  AdminDictData,
  AdminDictDataListQuery,
  AdminDictType,
  AdminDictTypeListQuery,
} from './types'

/** 字典类型列表（带分页） */
export function listAdminDictTypes(query: AdminDictTypeListQuery = {}) {
  return requestPaginated<AdminDictType[]>({
    method: 'GET',
    path: '/api/v1/admin/dicts/types',
    query,
  })
}

/** 字典项列表（带分页） */
export function listAdminDictData(query: AdminDictDataListQuery) {
  return requestPaginated<AdminDictData[]>({
    method: 'GET',
    path: '/api/v1/admin/dicts/data',
    query,
  })
}

/** 新建字典类型 */
export function createAdminDictType(data: {
  name: string
  type: string
  status?: '0' | '1'
  remark?: string
}) {
  return request<AdminDictType>({
    method: 'POST',
    path: '/api/v1/admin/dicts/types',
    data,
  })
}

/** 更新字典类型 */
export function updateAdminDictType(
  id: number,
  data: Partial<{ name: string; type: string; status: '0' | '1'; remark: string }>,
) {
  return request<AdminDictType>({
    method: 'PUT',
    path: `/api/v1/admin/dicts/types/${id}`,
    data,
  })
}

/** 删除字典类型 */
export function deleteAdminDictType(id: number) {
  return request<{ id: number }>({
    method: 'DELETE',
    path: `/api/v1/admin/dicts/types/${id}`,
  })
}

/** 新建字典项 */
export function createAdminDictData(data: {
  typeId: number
  label: string
  value: string
  sortOrder?: number
  isDefault?: boolean
  status?: '0' | '1'
  remark?: string
}) {
  return request<AdminDictData>({
    method: 'POST',
    path: '/api/v1/admin/dicts/data',
    data,
  })
}

/** 更新字典项 */
export function updateAdminDictData(
  id: number,
  data: Partial<{
    label: string
    value: string
    sortOrder: number
    isDefault: boolean
    status: '0' | '1'
    remark: string
  }>,
) {
  return request<AdminDictData>({
    method: 'PUT',
    path: `/api/v1/admin/dicts/data/${id}`,
    data,
  })
}

/** 删除字典项 */
export function deleteAdminDictData(id: number) {
  return request<{ id: number }>({
    method: 'DELETE',
    path: `/api/v1/admin/dicts/data/${id}`,
  })
}
