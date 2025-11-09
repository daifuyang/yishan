// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 获取菜单列表 分页获取菜单列表，支持关键词、状态、类型与父级过滤 GET /api/v1/admin/menus/ */
export async function getMenuList(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getMenuListParams,
  options?: { [key: string]: any }
) {
  return request<API.menuListResp>("/api/v1/admin/menus/", {
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

/** 创建菜单 创建一个新的菜单 POST /api/v1/admin/menus/ */
export async function createMenu(
  body: API.saveMenuReq,
  options?: { [key: string]: any }
) {
  return request<API.menuDetailResp>("/api/v1/admin/menus/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 获取菜单详情 根据菜单ID获取菜单详情 GET /api/v1/admin/menus/${param0} */
export async function getMenuDetail(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getMenuDetailParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.menuDetailResp>(`/api/v1/admin/menus/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 更新菜单 根据菜单ID更新菜单信息 PUT /api/v1/admin/menus/${param0} */
export async function updateMenu(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.updateMenuParams,
  body: API.updateMenuReq,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.menuDetailResp>(`/api/v1/admin/menus/${param0}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 删除菜单 根据菜单ID进行软删除，存在子菜单或已绑定角色禁止删除 DELETE /api/v1/admin/menus/${param0} */
export async function deleteMenu(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.deleteMenuParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.menuDeleteResp>(`/api/v1/admin/menus/${param0}`, {
    method: "DELETE",
    params: { ...queryParams },
    ...(options || {}),
  });
}
