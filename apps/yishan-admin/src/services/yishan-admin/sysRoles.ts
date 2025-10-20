// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 获取角色列表 获取角色列表，支持分页和筛选 GET /api/v1/admin/roles/ */
export async function getRoleList(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getRoleListParams,
  options?: { [key: string]: any }
) {
  return request<{
    code?: number;
    message?: string;
    data?: API.sysRoleListResponse;
    success?: boolean;
    timestamp?: string;
    request_id?: string;
  }>("/api/v1/admin/roles/", {
    method: "GET",
    params: {
      // page has a default value: 1
      page: "1",
      // pageSize has a default value: 10
      pageSize: "10",

      // sortBy has a default value: sortOrder
      sortBy: "sortOrder",
      // sortOrder has a default value: asc
      sortOrder: "asc",
      ...params,
    },
    ...(options || {}),
  });
}

/** 创建角色 创建新角色 POST /api/v1/admin/roles/ */
export async function createRole(
  body: API.sysRoleCreateRequest,
  options?: { [key: string]: any }
) {
  return request<{
    code?: number;
    message?: string;
    data?: API.sysRole;
    success?: boolean;
    timestamp?: string;
    request_id?: string;
  }>("/api/v1/admin/roles/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 获取角色详情 根据ID获取角色详细信息 GET /api/v1/admin/roles/${param0} */
export async function getRoleById(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getRoleByIdParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    code?: number;
    message?: string;
    data?: API.sysRole;
    success?: boolean;
    timestamp?: string;
    request_id?: string;
  }>(`/api/v1/admin/roles/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 更新角色信息 更新指定角色的信息 PUT /api/v1/admin/roles/${param0} */
export async function updateRole(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.updateRoleParams,
  body: API.sysRoleUpdateRequest,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    code?: number;
    message?: string;
    data?: API.sysRole;
    success?: boolean;
    timestamp?: string;
    request_id?: string;
  }>(`/api/v1/admin/roles/${param0}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 删除角色 删除指定角色 DELETE /api/v1/admin/roles/${param0} */
export async function deleteRole(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.deleteRoleParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    code?: number;
    message?: string;
    data?: null;
    success?: boolean;
    timestamp?: string;
    request_id?: string;
  }>(`/api/v1/admin/roles/${param0}`, {
    method: "DELETE",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 获取角色权限 获取指定角色的权限列表 GET /api/v1/admin/roles/${param0}/permissions */
export async function getRolePermissions(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getRolePermissionsParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    code?: number;
    message?: string;
    data?: API.sysPermission[];
    success?: boolean;
    timestamp?: string;
    request_id?: string;
  }>(`/api/v1/admin/roles/${param0}/permissions`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 修改角色状态 修改指定角色的状态 PATCH /api/v1/admin/roles/${param0}/status */
export async function updateRoleStatus(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.updateRoleStatusParams,
  body: API.sysRoleStatusUpdateRequest,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    code?: number;
    message?: string;
    data?: API.sysRole;
    success?: boolean;
    timestamp?: string;
    request_id?: string;
  }>(`/api/v1/admin/roles/${param0}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 获取角色用户列表 获取指定角色的用户列表 GET /api/v1/admin/roles/${param0}/users */
export async function getRoleUsers(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getRoleUsersParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    code?: number;
    message?: string;
    data?: API.sysRoleUserListResponse;
    success?: boolean;
    timestamp?: string;
    request_id?: string;
  }>(`/api/v1/admin/roles/${param0}/users`, {
    method: "GET",
    params: {
      // page has a default value: 1
      page: "1",
      // pageSize has a default value: 10
      pageSize: "10",

      ...queryParams,
    },
    ...(options || {}),
  });
}

/** 为用户分配角色 为指定用户分配一个或多个角色 POST /api/v1/admin/roles/assign */
export async function assignUserRoles(
  body: API.sysRoleAssignRequest,
  options?: { [key: string]: any }
) {
  return request<{
    code?: number;
    message?: string;
    data?: null;
    success?: boolean;
    timestamp?: string;
    request_id?: string;
  }>("/api/v1/admin/roles/assign", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 获取用户角色 获取指定用户的角色列表 GET /api/v1/admin/roles/user/${param0} */
export async function getUserRoles(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getUserRolesParams,
  options?: { [key: string]: any }
) {
  const { userId: param0, ...queryParams } = params;
  return request<{
    code?: number;
    message?: string;
    data?: API.sysRole[];
    success?: boolean;
    timestamp?: string;
    request_id?: string;
  }>(`/api/v1/admin/roles/user/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}
