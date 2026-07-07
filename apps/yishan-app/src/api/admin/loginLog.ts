/**
 * 系统管理 - 登录日志 API
 * 后端路径：/api/v1/admin/system/login-logs
 */
import { requestPaginated } from '../client'
import type { AdminLoginLog, AdminLoginLogListQuery } from './types'

export function listAdminLoginLogs(query: AdminLoginLogListQuery = {}) {
  return requestPaginated<AdminLoginLog[]>({
    method: 'GET',
    path: '/api/v1/admin/system/login-logs',
    query,
  })
}
