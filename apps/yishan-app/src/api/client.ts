/**
 * Taro.request 封装：统一注入 token、统一错误归一、401 跳登录
 */
import Taro from '@tarojs/taro'

import { API_BASE_URL } from '../config'
import { ApiError, type ApiResponse, UnauthorizedError } from './types'
import { storage, STORAGE_KEYS } from '../utils/storage'

// 我们走的是 core 端 app 通道（/api/v1/app/...），不是 plugin 通道
const _APP_PREFIX = '/api/v1/app'

/** 分页响应（与后端 response.pagination 对齐） */
export interface Pagination {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface PaginatedResponse<T> {
  data: T
  pagination: Pagination
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  path: string
  data?: unknown
  query?: Record<string, unknown>
  headers?: Record<string, string>
  /** 不注入 Authorization */
  skipAuth?: boolean
  /** 自定义 timeout (ms) */
  timeout?: number
}

function buildUrl(path: string, query?: Record<string, unknown>): string {
  const base = API_BASE_URL.replace(/\/$/, '')
  let p = path
  if (!p.startsWith('/')) p = `/${p}`
  return `${base}${p}${query ? qs(query) : ''}`
}

function qs(query: Record<string, unknown>): string {
  const entries = Object.entries(query)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
  return entries.length ? `?${entries.join('&')}` : ''
}

let unauthorizedHandler: (() => void) | null = null

/**
 * 注册全局 401 处理（一般在 auth store 初始化时调用）
 */
export function setUnauthorizedHandler(handler: () => void) {
  unauthorizedHandler = handler
}

export async function request<T = unknown>(opts: RequestOptions): Promise<T> {
  const { method = 'GET', path, data, query, headers = {}, skipAuth, timeout = 15000 } = opts

  const finalHeaders: Record<string, string> = { ...headers }
  if (!skipAuth) {
    const token = storage.get<string>(STORAGE_KEYS.ACCESS_TOKEN)
    if (token) {
      finalHeaders.Authorization = `Bearer ${token}`
    }
  }

  let res: Taro.request.SuccessCallbackResult<ApiResponse<T>>
  try {
    res = await Taro.request<ApiResponse<T>>({
      url: buildUrl(path, query),
      method,
      data,
      header: finalHeaders,
      timeout,
    })
  } catch (err) {
    throw new ApiError(-1, (err as Error).message || '网络请求失败', 0)
  }

  const body = res.data
  if (!body) {
    throw new ApiError(-2, '响应为空', res.statusCode)
  }

  // HTTP 401 单独处理
  if (res.statusCode === 401) {
    unauthorizedHandler?.()
    throw new UnauthorizedError(body.message || '未登录或登录已过期')
  }

  if (!body.success) {
    // 业务码 401 / 4030 / 401001 等也视情况触发跳登录
    if (
      body.code === 401 ||
      body.code === 401000 ||
      body.code === 401001 ||
      body.code === 401003
    ) {
      unauthorizedHandler?.()
      throw new UnauthorizedError(body.message)
    }
    throw new ApiError(body.code, body.message || '请求失败', res.statusCode, body.data as unknown as string | undefined)
  }

  return body.data
}

/**
 * 分页请求：返回 { data, pagination }
 * 后端 ResponseUtil.paginated 的结构为：
 *   { success, code, message, data: T[], pagination: { page, pageSize, total, totalPages } }
 */
export async function requestPaginated<T = unknown>(
  opts: RequestOptions,
): Promise<PaginatedResponse<T>> {
  const { method = 'GET', path, data, query, headers = {}, skipAuth, timeout = 15000 } = opts

  const finalHeaders: Record<string, string> = { ...headers }
  if (!skipAuth) {
    const token = storage.get<string>(STORAGE_KEYS.ACCESS_TOKEN)
    if (token) {
      finalHeaders.Authorization = `Bearer ${token}`
    }
  }

  let res: Taro.request.SuccessCallbackResult<ApiResponse<T> & { pagination?: Pagination }>
  try {
    res = await Taro.request<ApiResponse<T> & { pagination?: Pagination }>({
      url: buildUrl(path, query),
      method,
      data,
      header: finalHeaders,
      timeout,
    })
  } catch (err) {
    throw new ApiError(-1, (err as Error).message || '网络请求失败', 0)
  }

  const body = res.data
  if (!body) {
    throw new ApiError(-2, '响应为空', res.statusCode)
  }

  if (res.statusCode === 401) {
    unauthorizedHandler?.()
    throw new UnauthorizedError(body.message || '未登录或登录已过期')
  }

  if (!body.success) {
    if (
      body.code === 401 ||
      body.code === 401000 ||
      body.code === 401001 ||
      body.code === 401003
    ) {
      unauthorizedHandler?.()
      throw new UnauthorizedError(body.message)
    }
    throw new ApiError(body.code, body.message || '请求失败', res.statusCode, body.data as unknown as string | undefined)
  }

  return {
    data: body.data as T,
    pagination: body.pagination ?? { page: 1, pageSize: 0, total: 0, totalPages: 0 },
  }
}
