import { request } from '../client'

export interface ManagedModule {
  id: string; name: string; routePrefix: string; tablePrefix: string; version: string; enabled: boolean; mounted: boolean
}
export function listManagedModules() {
  return request<{ items: ManagedModule[] }>({ path: '/api/v1/admin/system/module-management/list/' })
}
export function toggleModule(id: string, enabled: boolean) {
  return request<{ id: string; enabled: boolean }>({ method: 'POST', path: `/api/v1/admin/system/module-management/toggle/${encodeURIComponent(id)}/toggle`, data: { enabled } })
}
