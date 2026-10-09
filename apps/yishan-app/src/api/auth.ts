/**
 * 认证相关 API：login / logout / refresh / me / capabilities
 */
import { request } from './client'
import type { CurrentUser, LoginData } from './types'

export interface LoginParams {
  username: string
  password: string
  rememberMe?: boolean
}

export interface Capabilities {
  permissions: string[]
  enabledModuleIds: string[]
}

export function login(params: LoginParams) {
  return request<LoginData>({
    method: 'POST',
    path: '/api/v1/app/auth/login',
    data: params,
    skipAuth: true,
  })
}

export function logout(token?: string | null, refreshToken?: string | null) {
  return request<null>({
    method: 'POST',
    path: '/api/v1/app/auth/logout',
    skipAuth: true,
    // softAuthenticate accepts refresh tokens, but an expired access header prevents body fallback.
    headers:
      refreshToken || token ? { Authorization: `Bearer ${refreshToken || token}` } : undefined,
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

export function getCapabilities() {
  return request<Capabilities>({
    method: 'GET',
    path: '/api/v1/app/auth/capabilities',
  })
}
