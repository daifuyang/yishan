export interface CliSession {
  baseUrl: string
  accessToken?: string
  refreshToken?: string
  user?: {
    id: number
    username: string
    email?: string
    roleIds?: number[]
  }
}

export interface ApiEnvelope<T> {
  success: boolean
  code: number
  message: string
  data: T
  pagination?: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
  error?: string
  timestamp: string
}

export interface LoginResponseData {
  token: string
  refreshToken: string
  userInfo?: {
    id: number
    username: string
    email?: string
    roleIds?: number[]
  }
}

export type ResourceAction = 'list' | 'detail' | 'create' | 'update' | 'delete'

export interface ResourceEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  path: string
  requireId?: boolean
}

export interface ResourceSpec {
  resource: string
  description?: string
  endpoints: Partial<Record<ResourceAction, ResourceEndpoint>>
}
