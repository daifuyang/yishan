/**
 * 通讯录 API（部门 / 部门成员）
 */
import { request } from './client'
import type { DeptUser, SysMenuNode } from './types'

/** 获取部门树 */
export function getDeptTree() {
  return request<SysMenuNode[]>({
    method: 'GET',
    path: '/api/v1/app/contacts/depts/tree',
  })
}

/** 获取部门成员 */
export function getDeptUsers(deptId: number) {
  return request<DeptUser[]>({
    method: 'GET',
    path: `/api/v1/app/contacts/depts/${deptId}/users`,
  })
}
