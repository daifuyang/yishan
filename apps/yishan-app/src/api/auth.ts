/**
 * 认证相关 API：login / logout / refresh / me
 */
import { request } from './client'
import type { CurrentUser, LoginData } from './types'

export interface LoginParams {
  username: string
  password: string
  rememberMe?: boolean
}

export function login(params: LoginParams) {
  return request<LoginData>({
    method: 'POST',
    path: '/api/v1/app/auth/login',
    data: params,
    skipAuth: true,
  })
}

export function logout() {
  return request<null>({
    method: 'POST',
    path: '/api/v1/app/auth/logout',
  })
}

export function refreshToken(refreshToken: string) {
  return request<LoginData>({
    method: 'POST',
    path: '/api/v1/app/auth/refresh',
    data: { refreshToken },
    skipAuth: true,
  })
}

export function getCurrentUser() {
  return request<CurrentUser>({
    method: 'GET',
    path: '/api/v1/app/auth/me',
  })
}
