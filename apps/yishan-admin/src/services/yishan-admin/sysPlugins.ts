import { request } from '@umijs/max';

export type SysPluginMenu = {
  name: string;
  path: string;
  perm?: string;
};

export type ConflictDetail = {
  path: string;
  name: string;
  existingPluginName: string;
  reason: string;
};

export type PluginSyncStatus = {
  strategy: string;
  status: string;
  created: number;
  updated: number;
  skipped: number;
  conflicted: number;
  conflictDetails: ConflictDetail[];
  lastSyncAt: string | null;
};

export type SysPlugin = {
  pluginId?: string;
  name: string;
  version?: string;
  state?: string;
  enabled?: boolean;
  coreCompatibility?: string;
  lastError?: string;
  updatedAt?: string;
  menus?: SysPluginMenu[];
  syncStatus?: PluginSyncStatus | null;
};

export type SysPluginHookReport = {
  id?: string;
  pluginName?: string;
  hookName?: string;
  status?: string;
  message?: string;
  createdAt?: string;
};

export type SysPluginSyncLog = {
  id: number;
  strategy: string;
  status: string;
  created: number;
  updated: number;
  skipped: number;
  conflicted: number;
  conflictDetails: ConflictDetail[];
  errorMessage: string | null;
  createdAt: string;
};

export async function listPlugins(options?: { [key: string]: any }) {
  return request<{ success: boolean; message?: string; data?: SysPlugin[] }>(
    '/api/v1/admin/system/plugins',
    {
      method: 'GET',
      ...(options || {}),
    }
  );
}

export async function getPlugin(name: string, options?: { [key: string]: any }) {
  return request<{ success: boolean; message?: string; data?: SysPlugin }>(
    `/api/v1/admin/system/plugins/${name}`,
    {
      method: 'GET',
      ...(options || {}),
    }
  );
}

export async function enablePlugin(
  name: string,
  strategy?: 'strict' | 'safe',
  options?: { [key: string]: any }
) {
  return request<{ success: boolean; message?: string; data?: SysPlugin }>(
    `/api/v1/admin/system/plugins/${name}/enable`,
    {
      method: 'POST',
      params: strategy ? { strategy } : undefined,
      ...(options || {}),
    }
  );
}

export async function disablePlugin(name: string, options?: { [key: string]: any }) {
  return request<{ success: boolean; message?: string; data?: SysPlugin }>(
    `/api/v1/admin/system/plugins/${name}/disable`,
    {
      method: 'POST',
      ...(options || {}),
    }
  );
}

export async function syncPlugin(
  name: string,
  strategy?: 'strict' | 'safe',
  options?: { [key: string]: any }
) {
  return request<{ success: boolean; message?: string; data?: SysPlugin }>(
    `/api/v1/admin/system/plugins/${name}/sync`,
    {
      method: 'POST',
      params: strategy ? { strategy } : undefined,
      ...(options || {}),
    }
  );
}

export async function getSyncLogs(name: string, limit = 10, options?: { [key: string]: any }) {
  return request<{ success: boolean; message?: string; data?: SysPluginSyncLog[] }>(
    `/api/v1/admin/system/plugins/${name}/sync-logs`,
    {
      method: 'GET',
      params: { limit },
      ...(options || {}),
    }
  );
}

export async function getPluginHookReports(
  params: { limit?: number } = { limit: 50 },
  options?: { [key: string]: any }
) {
  return request<{ success: boolean; message?: string; data?: SysPluginHookReport[] }>(
    '/api/v1/admin/system/plugins/hooks/reports',
    {
      method: 'GET',
      params: {
        limit: 50,
        ...params,
      },
      ...(options || {}),
    }
  );
}
