// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 获取应用列表 分页获取应用列表，支持关键词与状态过滤 GET /api/v1/admin/apps/ */
export async function getAppList(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getAppListParams,
  options?: { [key: string]: any }
) {
  return request<API.appListResp>("/api/v1/admin/apps/", {
    method: "GET",
    params: {
      // page has a default value: 1
      page: "1",
      // pageSize has a default value: 10
      pageSize: "10",

      // sortBy has a default value: sort_order
      sortBy: "sort_order",
      // sortOrder has a default value: asc
      sortOrder: "asc",
      ...params,
    },
    ...(options || {}),
  });
}

/** 创建应用 创建一个新的应用 POST /api/v1/admin/apps/ */
export async function createApp(
  body: API.saveAppReq,
  options?: { [key: string]: any }
) {
  return request<API.appDetailResp>("/api/v1/admin/apps/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 获取应用详情 根据应用ID获取应用详情 GET /api/v1/admin/apps/${param0} */
export async function getAppDetail(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getAppDetailParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.appDetailResp>(`/api/v1/admin/apps/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 更新应用 根据应用ID更新应用 PUT /api/v1/admin/apps/${param0} */
export async function updateApp(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.updateAppParams,
  body: API.updateAppReq,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.appDetailResp>(`/api/v1/admin/apps/${param0}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 删除应用 根据应用ID软删除应用 DELETE /api/v1/admin/apps/${param0} */
export async function deleteApp(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.deleteAppParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.appDeleteResp>(`/api/v1/admin/apps/${param0}`, {
    method: "DELETE",
    params: { ...queryParams },
    ...(options || {}),
  });
}
