// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 模块列表 扫描 src/modules/ 并合并 sys_module 行；标注 enabled 与是否已挂载。routePrefix 由 moduleRoutePrefix() 统一生成为 /api/${id}。 GET /api/v1/admin/system/module-management/list/ */
export async function listModuleManagement(options?: { [key: string]: any }) {
  return request<{
    success: boolean;
    code: number;
    message: string;
    data: {
      items: {
        id: string;
        name: string;
        routePrefix: string;
        tablePrefix: string;
        version: string;
        enabled: boolean;
        mounted: boolean;
      }[];
    };
    timestamp: string;
  }>("/api/v1/admin/system/module-management/list/", {
    method: "GET",
    ...(options || {}),
  });
}

/** 切换模块启停 UPDATE sys_module.enabled 并清 enabled 缓存；由全局 onRequest gate 即时拦截，无需重启。 POST /api/v1/admin/system/module-management/toggle/${param0}/toggle */
export async function toggleModuleManagement(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.toggleModuleManagementParams,
  body: {
    enabled: boolean;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    success: boolean;
    code: number;
    message: string;
    data: { id: string; enabled: boolean };
    timestamp: string;
  }>(`/api/v1/admin/system/module-management/toggle/${param0}/toggle`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}
