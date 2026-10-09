// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 获取角色列表 分页获取系统角色列表，支持关键词搜索和状态筛选 GET /api/v1/admin/roles/ */
export async function getRoleList(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getRoleListParams,
  options?: { [key: string]: any }
) {
  return request<API.roleListResp>("/api/v1/admin/roles/", {
    method: "GET",
    params: {
      // page has a default value: 1
      page: "1",
      // pageSize has a default value: 10
      pageSize: "10",

      // sortBy has a default value: createdAt
      sortBy: "createdAt",
      // sortOrder has a default value: desc
      sortOrder: "desc",
      ...params,
    },
    ...(options || {}),
  });
}

/** 创建角色 创建一个新的系统角色 POST /api/v1/admin/roles/ */
export async function createRole(
  body: API.saveRoleReq,
  options?: { [key: string]: any }
) {
  return request<API.roleDetailResp>("/api/v1/admin/roles/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 获取角色详情 根据角色ID获取角色详情 GET /api/v1/admin/roles/${param0} */
export async function getRoleDetail(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getRoleDetailParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.roleDetailResp>(`/api/v1/admin/roles/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 更新角色 根据角色ID更新角色信息 PUT /api/v1/admin/roles/${param0} */
export async function updateRole(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.updateRoleParams,
  body: API.updateRoleReq,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.roleDetailResp>(`/api/v1/admin/roles/${param0}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 删除角色 根据角色ID进行软删除 DELETE /api/v1/admin/roles/${param0} */
export async function deleteRole(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.deleteRoleParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.roleDeleteResp>(`/api/v1/admin/roles/${param0}`, {
    method: "DELETE",
    params: { ...queryParams },
    ...(options || {}),
  });
}
