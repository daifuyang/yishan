import { request } from '@umijs/max';

export type SyncStrategy = 'strict' | 'safe';

export interface SysPluginMenu {
  name: string;
  path: string;
  perm?: string;
}

export interface SysPluginSyncStatus {
  strategy: string;
  status: string;
  created: number;
  updated: number;
  skipped: number;
  conflicted: number;
  conflictDetails: Array<{ path?: string; existingPluginName?: string; reason?: string }>;
  lastSyncAt: string | null;
}

export interface SysPlugin {
  pluginId?: string;
  name: string;
  version?: string;
  state?: string;
  enabled?: boolean;
  coreCompatibility?: string;
  lastError?: string;
  updatedAt?: string;
  menus?: SysPluginMenu[];
  syncStatus?: SysPluginSyncStatus | null;
}

export interface SysPluginHookReport {
  id?: string | number;
  hookName: string;
  pluginName: string;
  phase: 'before' | 'after';
  status: 'success' | 'failed';
  startedAt?: string;
  createdAt?: string;
  durationMs?: number;
  message?: string;
  error?: string;
}

export interface SysPluginSyncLog {
  strategy: string;
  status: string;
  created: number;
  updated: number;
  skipped: number;
  conflicted: number;
  createdAt: string;
  conflictDetails?: Array<{ path?: string; existingPluginName?: string; reason?: string }>;
  errors?: string[];
}

interface ApiResp<T> {
  code: number;
  message: string;
  success: boolean;
  data: T;
  timestamp: string;
}

export async function listPlugins(options?: { [key: string]: unknown }) {
  return request<ApiResp<SysPlugin[]>>('/api/v1/admin/system/plugins/', {
    method: 'GET',
    ...(options || {}),
  });
}

export async function enablePlugin(name: string, strategy: SyncStrategy = 'safe', options?: { [key: string]: unknown }) {
  return request<ApiResp<SysPlugin>>(`/api/v1/admin/system/plugins/${name}/enable`, {
    method: 'POST',
    params: { strategy },
    ...(options || {}),
  });
}

export async function syncPlugin(name: string, strategy: SyncStrategy = 'safe', options?: { [key: string]: unknown }) {
  return request<ApiResp<SysPlugin>>(`/api/v1/admin/system/plugins/${name}/sync`, {
    method: 'POST',
    params: { strategy },
    ...(options || {}),
  });
}

export async function disablePlugin(name: string, options?: { [key: string]: unknown }) {
  return request<ApiResp<SysPlugin>>(`/api/v1/admin/system/plugins/${name}/disable`, {
    method: 'POST',
    ...(options || {}),
  });
}

export async function getPluginHookReports(params?: { limit?: number }, options?: { [key: string]: unknown }) {
  return request<ApiResp<SysPluginHookReport[]>>('/api/v1/admin/system/plugins/hooks/reports', {
    method: 'GET',
    params,
    ...(options || {}),
  });
}

export async function getSyncLogs(name: string, limit = 10, options?: { [key: string]: unknown }) {
  return request<ApiResp<SysPluginSyncLog[]>>(`/api/v1/admin/system/plugins/${name}/sync-logs`, {
    method: 'GET',
    params: { limit },
    ...(options || {}),
  });
}
