// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 生成模块迁移文件 调用本模块的 drizzle-kit generate。 POST /api/v1/admin/system/module-management/generate/${param0}/generate */
export async function generateModuleManagementMigration(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.generateModuleManagementMigrationParams,
  body: {
    name?: string;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    success: boolean;
    code: number;
    message: string;
    data: {
      success: boolean;
      code: number;
      stdout: string;
      stderr: string;
      message: string;
    };
    timestamp: string;
  }>(`/api/v1/admin/system/module-management/generate/${param0}/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 模块列表 扫描 src/modules/ 并合并 sys_module 行；标注 enabled、是否已挂载、applied vs pending 迁移。routePrefix 由 moduleRoutePrefix() 统一生成为 /api/${id}。 GET /api/v1/admin/system/module-management/list/ */
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
        hasSchema: boolean;
        hasDrizzle: boolean;
        appliedMigrations: string[];
        pendingMigrations: string[];
      }[];
    };
    timestamp: string;
  }>("/api/v1/admin/system/module-management/list/", {
    method: "GET",
    ...(options || {}),
  });
}

/** 执行模块迁移 调用本模块的 drizzle-kit migrate；完成后把 journal 中所有 entry 同步进 sys_module_migration。 POST /api/v1/admin/system/module-management/migrate/${param0}/migrate */
export async function migrateModuleManagement(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.migrateModuleManagementParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    success: boolean;
    code: number;
    message: string;
    data: {
      success: boolean;
      code: number;
      stdout: string;
      stderr: string;
      message: string;
    };
    timestamp: string;
  }>(`/api/v1/admin/system/module-management/migrate/${param0}/migrate`, {
    method: "POST",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 运行模块 seed 脚本 执行 dist/modules/<id>/{seed,scripts/seed,db/seed}.js。 POST /api/v1/admin/system/module-management/seed/${param0}/seed */
export async function seedModuleManagement(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.seedModuleManagementParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    success: boolean;
    code: number;
    message: string;
    data: {
      success: boolean;
      code: number;
      stdout: string;
      stderr: string;
      message: string;
    };
    timestamp: string;
  }>(`/api/v1/admin/system/module-management/seed/${param0}/seed`, {
    method: "POST",
    params: { ...queryParams },
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
