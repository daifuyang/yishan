/**
 * 用户相关 API
 */
import { request } from './client'
import type { LoginLog } from './types'

export interface UpdateMeParams {
  nickname?: string
  realName?: string
  email?: string
  gender?: '0' | '1' | '2'
  birthDate?: string
}

export function updateMe(data: UpdateMeParams) {
  return request<UpdateMeParams>({
    method: 'PUT',
    path: '/api/v1/app/users/me',
    data,
  })
}

export interface ChangePasswordParams {
  oldPassword: string
  newPassword: string
}

export function changeMyPassword(data: ChangePasswordParams) {
  return request<null>({
    method: 'PUT',
    path: '/api/v1/app/users/me/password',
    data,
  })
}

export function getMyLoginLogs(params: { page?: number; pageSize?: number } = {}) {
  return request<LoginLog[]>({
    method: 'GET',
    path: '/api/v1/app/users/me/login-logs',
    query: params,
  })
}
