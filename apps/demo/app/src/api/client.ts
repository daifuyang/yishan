import { createApiClient } from '@yishan/core-app/request'
import { API_BASE_URL } from '../config'
import { storage, STORAGE_KEYS } from '../utils/storage'

export type { Pagination, PaginatedResponse, RequestOptions } from '@yishan/core-app/request'

export const apiClient = createApiClient({
  baseUrl: API_BASE_URL,
  storage,
  storageKeys: STORAGE_KEYS,
  refreshPath: '/api/v1/app/auth/refresh',
})

export const { request, requestPaginated, getSessionVersion, invalidateSessionRequests, setUnauthorizedHandler, setTokenRefreshedHandler } = apiClient
