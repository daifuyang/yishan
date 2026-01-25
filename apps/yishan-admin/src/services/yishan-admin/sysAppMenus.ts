// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 获取应用菜单列表 分页获取应用菜单列表，支持关键词、状态、类型与父级过滤 GET /api/v1/admin/apps/${param0}/menus */
export async function getAppMenuList(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getAppMenuListParams,
  options?: { [key: string]: any }
) {
  const { appId: param0, ...queryParams } = params;
  return request<API.appMenuListResp>(`/api/v1/admin/apps/${param0}/menus`, {
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
      ...queryParams,
    },
    ...(options || {}),
  });
}

/** 创建应用菜单 在指定应用下创建菜单 POST /api/v1/admin/apps/${param0}/menus */
export async function createAppMenu(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.createAppMenuParams,
  body: API.saveAppMenuReq,
  options?: { [key: string]: any }
) {
  const { appId: param0, ...queryParams } = params;
  return request<API.appMenuDetailResp>(`/api/v1/admin/apps/${param0}/menus`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 获取应用菜单详情 根据应用菜单ID获取详情 GET /api/v1/admin/apps/${param0}/menus/${param1} */
export async function getAppMenuDetail(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getAppMenuDetailParams,
  options?: { [key: string]: any }
) {
  const { appId: param0, id: param1, ...queryParams } = params;
  return request<API.appMenuDetailResp>(
    `/api/v1/admin/apps/${param0}/menus/${param1}`,
    {
      method: "GET",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 更新应用菜单 根据应用菜单ID更新菜单信息 PUT /api/v1/admin/apps/${param0}/menus/${param1} */
export async function updateAppMenu(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.updateAppMenuParams,
  body: API.updateAppMenuReq,
  options?: { [key: string]: any }
) {
  const { appId: param0, id: param1, ...queryParams } = params;
  return request<API.appMenuDetailResp>(
    `/api/v1/admin/apps/${param0}/menus/${param1}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      params: { ...queryParams },
      data: body,
      ...(options || {}),
    }
  );
}

/** 删除应用菜单 根据应用菜单ID软删除菜单 DELETE /api/v1/admin/apps/${param0}/menus/${param1} */
export async function deleteAppMenu(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.deleteAppMenuParams,
  options?: { [key: string]: any }
) {
  const { appId: param0, id: param1, ...queryParams } = params;
  return request<API.appMenuDeleteResp>(
    `/api/v1/admin/apps/${param0}/menus/${param1}`,
    {
      method: "DELETE",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 获取应用菜单树 获取指定应用的树形菜单 GET /api/v1/admin/apps/${param0}/menus/tree */
export async function getAppMenuTree(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getAppMenuTreeParams,
  options?: { [key: string]: any }
) {
  const { appId: param0, ...queryParams } = params;
  return request<API.appMenuTreeResp>(
    `/api/v1/admin/apps/${param0}/menus/tree`,
    {
      method: "GET",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}
