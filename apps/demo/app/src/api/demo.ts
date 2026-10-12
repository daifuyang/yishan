import { request, requestRaw } from './client'

export interface DemoTodo {
  id: number
  title: string
  description: string
  status: 0 | 1 | 2
  dueAt: string | null
  createdAt: string
  updatedAt: string
}

export interface TodoInput {
  title: string
  description?: string
  status?: 0 | 1 | 2
  dueAt?: string | null
}

export interface ServerInfo {
  module: 'demo'
  nodeVersion: string
  hostname: string
  platform: string
  arch: string
  cpus: number
  memory: { total: number; free: number }
  uptimeSeconds: number
  pid: number
  env: string
  timestamp: string
}

/** 列表查询：全部可选；keyword 同时匹配标题与描述，total 是筛选后的总数。 */
export type DemoTodoListQuery = {
  page?: number
  pageSize?: number
  keyword?: string
  status?: 0 | 1 | 2
}

export const listTodos = (query: DemoTodoListQuery = {}) => requestRaw<{ total: number; items: DemoTodo[] }>({ method: 'GET', path: '/api/demo/v1/todos', query })
export const getTodo = (id: number) => requestRaw<DemoTodo>({ method: 'GET', path: `/api/demo/v1/todos/${id}` })
export const createTodo = (data: Omit<TodoInput, 'dueAt'> & { dueAt?: string }) => requestRaw<DemoTodo>({ method: 'POST', path: '/api/demo/v1/todos', data })
export const updateTodo = (id: number, data: Partial<TodoInput>) => requestRaw<DemoTodo>({ method: 'PATCH', path: `/api/demo/v1/todos/${id}`, data })
export const deleteTodo = (id: number) => requestRaw<void>({ method: 'DELETE', path: `/api/demo/v1/todos/${id}` })
export const getServerInfo = () => requestRaw<ServerInfo>({ method: 'GET', path: '/api/demo/v1/info' })

export interface DemoRegion { code: number; name: string; level: number; parentCode: number; sortOrder: number; children?: DemoRegion[] }
export const listRegions = (parentCode = 0) => request<DemoRegion[]>({ method: 'GET', path: '/api/v1/admin/system/regions', query: { parentCode } })
export const getRegionTree = () => request<DemoRegion[]>({ method: 'GET', path: '/api/v1/admin/system/regions/tree', query: { level: 3 } })
export const getRegionPath = (code: number) => request<DemoRegion[]>({ method: 'GET', path: '/api/v1/admin/system/regions/path', query: { code } })
