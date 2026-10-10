import { request } from './client'
import type { DashboardStats } from './types'

export function getStats() {
  return request<DashboardStats>({ path: '/api/v1/app/dashboard/stats' })
}