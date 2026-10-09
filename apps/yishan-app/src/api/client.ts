import Taro from '@tarojs/taro'

import { API_BASE_URL } from '../config'
import { storage, STORAGE_KEYS } from '../utils/storage'
import {
  ApiError,
  type ApiResponse,
  type LoginData,
  RequestCancelledError,
  UnauthorizedError,
} from './types'

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
  skipAuth?: boolean
  skipRefresh?: boolean
  timeout?: number
  signal?: AbortSignal
}

let sessionVersion = 0
let unauthorizedHandler: (() => void) | undefined
let tokenRefreshedHandler: ((data: LoginData) => void) | undefined
let refreshFlight: { version: number; promise: Promise<void> } | undefined

export function getSessionVersion() {
  return sessionVersion
}
export function invalidateSessionRequests() {
  sessionVersion++
  refreshFlight = undefined
}
export function setUnauthorizedHandler(handler: () => void) {
  unauthorizedHandler = handler
}
export function setTokenRefreshedHandler(handler: (data: LoginData) => void) {
  tokenRefreshedHandler = handler
}

function checkActive(version: number, signal?: AbortSignal) {
  if (version !== sessionVersion || signal?.aborted) throw new RequestCancelledError()
}

function expireSession(version: number): never {
  if (version === sessionVersion) {
    invalidateSessionRequests()
    storage.remove(STORAGE_KEYS.ACCESS_TOKEN)
    storage.remove(STORAGE_KEYS.REFRESH_TOKEN)
    storage.remove(STORAGE_KEYS.USER)
    unauthorizedHandler?.()
  }
  throw new UnauthorizedError()
}

function buildUrl(path: string, query?: Record<string, unknown>) {
  const entries = Object.entries(query ?? {})
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
  return `${API_BASE_URL.replace(/\/$/, '')}/${path.replace(/^\/+/, '')}${entries.length ? `?${entries.join('&')}` : ''}`
}

async function send<T>(
  opts: RequestOptions,
  token: string | null,
): Promise<Taro.request.SuccessCallbackResult<ApiResponse<T>>> {
  if (opts.signal?.aborted) throw new RequestCancelledError()
  const header = { ...opts.headers }
  if (!opts.skipAuth && token) header.Authorization = `Bearer ${token}`
  const task = Taro.request<ApiResponse<T>>({
    url: buildUrl(opts.path, opts.query),
    method: opts.method ?? 'GET',
    data: opts.data,
    header,
    timeout: opts.timeout ?? 15000,
  })
  const abort = () => task.abort()
  opts.signal?.addEventListener('abort', abort, { once: true })
  try {
    return await task
  } catch {
    if (opts.signal?.aborted) throw new RequestCancelledError()
    throw new ApiError(-1, '网络连接异常，请检查网络后重试', 0)
  } finally {
    opts.signal?.removeEventListener('abort', abort)
  }
}

function isUnauthorized(status: number, body?: ApiResponse<unknown>) {
  return (
    status === 401 ||
    [401, 401000, 401001, 401003, 22001, 22003, 22004, 22005, 22006, 22009].includes(
      body?.code ?? 0,
    )
  )
}

function validate<T>(response: Taro.request.SuccessCallbackResult<ApiResponse<T>>): ApiResponse<T> {
  const body = response.data
  if (!body || typeof body !== 'object' || typeof body.success !== 'boolean') {
    throw new ApiError(-2, '服务器响应异常，请稍后重试', response.statusCode)
  }
  if (response.statusCode < 200 || response.statusCode >= 300 || !body.success) {
    throw new ApiError(body.code, body.message || '请求失败', response.statusCode)
  }
  return body
}

async function refreshAccessToken(version: number) {
  if (refreshFlight?.version === version) return refreshFlight.promise
  const refreshToken = storage.get<string>(STORAGE_KEYS.REFRESH_TOKEN)
  if (!refreshToken) return expireSession(version)
  const flight = { version, promise: Promise.resolve() }
  flight.promise = (async () => {
    try {
      const response = await send<LoginData>(
        {
          path: '/api/v1/app/auth/refresh',
          method: 'POST',
          data: { refreshToken },
          skipAuth: true,
        },
        null,
      )
      checkActive(version)
      const data = validate(response).data
      if (!data?.token || !data.refreshToken) throw new UnauthorizedError()
      storage.set(STORAGE_KEYS.ACCESS_TOKEN, data.token)
      storage.set(STORAGE_KEYS.REFRESH_TOKEN, data.refreshToken)
      tokenRefreshedHandler?.(data)
    } catch (error) {
      if (error instanceof RequestCancelledError || version !== sessionVersion)
        throw new RequestCancelledError()
      return expireSession(version)
    } finally {
      if (refreshFlight === flight) refreshFlight = undefined
    }
  })()
  refreshFlight = flight
  return flight.promise
}

async function requestEnvelope<T>(opts: RequestOptions): Promise<ApiResponse<T>> {
  const version = sessionVersion
  const token = opts.skipAuth ? null : storage.get<string>(STORAGE_KEYS.ACCESS_TOKEN)
  let response = await send<T>(opts, token)
  if (!opts.skipAuth) checkActive(version, opts.signal)
  if (!opts.skipAuth && isUnauthorized(response.statusCode, response.data)) {
    if (opts.skipRefresh) return expireSession(version)
    // A late response may refer to a token that another request has already renewed.
    if (storage.get<string>(STORAGE_KEYS.ACCESS_TOKEN) === token) await refreshAccessToken(version)
    checkActive(version, opts.signal)
    response = await send<T>(opts, storage.get<string>(STORAGE_KEYS.ACCESS_TOKEN))
    checkActive(version, opts.signal)
    if (isUnauthorized(response.statusCode, response.data)) return expireSession(version)
  }
  if (opts.signal?.aborted) throw new RequestCancelledError()
  return validate(response)
}

export async function request<T = unknown>(opts: RequestOptions): Promise<T> {
  return (await requestEnvelope<T>(opts)).data
}

export async function requestPaginated<T = unknown>(
  opts: RequestOptions,
): Promise<PaginatedResponse<T>> {
  const body = await requestEnvelope<T>(opts)
  if (!body.pagination) throw new ApiError(-2, '服务器分页响应异常，请稍后重试')
  return { data: body.data, pagination: body.pagination }
}
