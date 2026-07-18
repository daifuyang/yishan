import { request } from '@umijs/max';

export type SyncStrategy = 'strict' | 'safe';
export interface SysPluginMenu { name: string; path: string; perm?: string; }
export interface SysPlugin { pluginId?: string; name: string; version?: string; state?: string; enabled?: boolean; coreCompatibility?: string; lastError?: string; updatedAt?: string; menus?: SysPluginMenu[]; syncStatus?: any; }
interface ApiResp<T> { code: number; message: string; success: boolean; data: T; timestamp: string; }
export async function listPlugins(options?: any) { return request<ApiResp<SysPlugin[]>>('/api/v1/admin/system/plugins/', { method: 'GET', ...(options || {}) }); }
export async function enablePlugin(name: string, strategy: SyncStrategy = 'safe', options?: any) { return request<ApiResp<SysPlugin>>(`/api/v1/admin/system/plugins/${name}/enable`, { method: 'POST', params: { strategy }, ...(options || {}) }); }
export async function syncPlugin(name: string, strategy: SyncStrategy = 'safe', options?: any) { return request<ApiResp<SysPlugin>>(`/api/v1/admin/system/plugins/${name}/sync`, { method: 'POST', params: { strategy }, ...(options || {}) }); }
export async function disablePlugin(name: string, options?: any) { return request<ApiResp<SysPlugin>>(`/api/v1/admin/system/plugins/${name}/disable`, { method: 'POST', ...(options || {}) }); }
export async function getPluginHookReports(params?: { limit?: number }, options?: any) { return request<any>('/api/v1/admin/system/plugins/hooks/reports', { method: 'GET', params, ...(options || {}) }); }
export async function getSyncLogs(name: string, limit = 10, options?: any) { return request<any>(`/api/v1/admin/system/plugins/${name}/sync-logs`, { method: 'GET', params: { limit }, ...(options || {}) }); }
