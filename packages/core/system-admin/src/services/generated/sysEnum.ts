// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 枚举分页列表 GET /api/v1/admin/enums/ */
export async function sysEnumList(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: SystemAPI.sysEnumListParams,
  options?: { [key: string]: any }
) {
  return request<{
    success: boolean;
    code: number;
    message: string;
    data: {
      items: {
        id: number;
        type: string;
        code: string;
        name: string;
        sort: number;
        enabled: number;
        remark: string | null;
        createdAt: string;
        updatedAt: string;
      }[];
      total: number;
      page: number;
      pageSize: number;
    };
    timestamp: string;
  }>("/api/v1/admin/enums/", {
    method: "GET",
    params: {
      // page has a default value: 1
      page: "1",
      // pageSize has a default value: 10
      pageSize: "10",

      ...params,
    },
    ...(options || {}),
  });
}

/** 新建枚举 POST /api/v1/admin/enums/ */
export async function sysEnumCreate(
  body: {
    type: string;
    code: string;
    name: string;
    sort?: number;
    enabled?: 0 | 1;
    remark?: string | null;
  },
  options?: { [key: string]: any }
) {
  return request<{
    success: boolean;
    code: number;
    message: string;
    data: {
      id: number;
      type: string;
      code: string;
      name: string;
      sort: number;
      enabled: number;
      remark: string | null;
      createdAt: string;
      updatedAt: string;
    };
    timestamp: string;
  }>("/api/v1/admin/enums/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 更新枚举 PUT /api/v1/admin/enums/${param0} */
export async function sysEnumUpdate(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: SystemAPI.sysEnumUpdateParams,
  body: {
    name?: string;
    sort?: number;
    enabled?: 0 | 1;
    remark?: string | null;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    success: boolean;
    code: number;
    message: string;
    data: {
      id: number;
      type: string;
      code: string;
      name: string;
      sort: number;
      enabled: number;
      remark: string | null;
      createdAt: string;
      updatedAt: string;
    };
    timestamp: string;
  }>(`/api/v1/admin/enums/${param0}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 软删除枚举 DELETE /api/v1/admin/enums/${param0} */
export async function sysEnumDelete(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: SystemAPI.sysEnumDeleteParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    success: boolean;
    code: number;
    message: string;
    data: { id: number; affected: number };
    timestamp: string;
  }>(`/api/v1/admin/enums/${param0}`, {
    method: "DELETE",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 按 type 拉启用项（dropdown 用，60s 缓存） GET /api/v1/admin/enums/by-type */
export async function sysEnumByType(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: SystemAPI.sysEnumByTypeParams,
  options?: { [key: string]: any }
) {
  return request<{
    success: boolean;
    code: number;
    message: string;
    data: {
      type: string;
      items: { code: string; name: string; sort: number }[];
      cachedAt: string;
    };
    timestamp: string;
  }>("/api/v1/admin/enums/by-type", {
    method: "GET",
    params: {
      ...params,
    },
    ...(options || {}),
  });
}

/** 批量拉多个 type 的启用项（首屏 SSR 用） GET /api/v1/admin/enums/by-types */
export async function sysEnumByTypes(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: SystemAPI.sysEnumByTypesParams,
  options?: { [key: string]: any }
) {
  return request<{
    success: boolean;
    code: number;
    message: string;
    data: { items: Record<string, any> };
    timestamp: string;
  }>("/api/v1/admin/enums/by-types", {
    method: "GET",
    params: {
      ...params,
    },
    ...(options || {}),
  });
}

/** 列出所有出现的 type（distinct） GET /api/v1/admin/enums/types */
export async function sysEnumTypes(options?: { [key: string]: any }) {
  return request<{
    success: boolean;
    code: number;
    message: string;
    data: string[];
    timestamp: string;
  }>("/api/v1/admin/enums/types", {
    method: "GET",
    ...(options || {}),
  });
}
