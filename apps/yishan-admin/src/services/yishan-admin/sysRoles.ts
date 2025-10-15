// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 获取角色列表 获取系统角色列表，支持分页、搜索和排序 GET /api/v1/admin/roles/ */
export async function getRoleList(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getRoleListParams,
  options?: { [key: string]: any }
) {
  return request<{
    code?: number;
    message?: string;
    data?: {
      list?: {
        id?: number;
        roleName?: string;
        roleDesc?: string;
        status?: number;
        isSystem?: number;
        sortOrder?: number;
        createdAt?: string;
        updatedAt?: string;
      }[];
      pagination?: {
        page?: number;
        pageSize?: number;
        total?: number;
        totalPages?: number;
      };
    };
  }>("/api/v1/admin/roles/", {
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

/** 创建新角色 创建一个新的系统角色 POST /api/v1/admin/roles/ */
export async function postAdminRoles(
  body: {
    /** 角色名称 */
    name: string;
    /** 角色描述 */
    description?: string;
    /** 角色类型：system-系统角色，custom-自定义角色 */
    type?: "system" | "custom";
    /** 状态：0-禁用，1-启用 */
    status?: 0 | 1;
    /** 排序顺序 */
    sortOrder?: number;
  },
  options?: { [key: string]: any }
) {
  return request<{
    code?: number;
    message?: string;
    data?: {
      id?: number;
      roleName?: string;
      roleDesc?: string;
      status?: number;
      isSystem?: number;
      sortOrder?: number;
      createdAt?: string;
      updatedAt?: string;
    };
  }>("/api/v1/admin/roles/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 获取角色详情 根据ID获取角色的详细信息 GET /api/v1/admin/roles/${param0} */
export async function getRoleDetail(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getRoleDetailParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    code?: number;
    message?: string;
    data?: {
      id?: number;
      roleName?: string;
      roleDesc?: string;
      status?: number;
      isSystemRole?: number;
      sortOrder?: number;
      createdAt?: string;
      updatedAt?: string;
    };
  }>(`/api/v1/admin/roles/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 更新角色 更新指定角色的信息 PUT /api/v1/admin/roles/${param0} */
export async function updateRole(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.updateRoleParams,
  body: {
    /** 角色名称 */
    name?: string;
    /** 角色描述 */
    description?: string;
    /** 状态：0-禁用，1-启用 */
    status?: 0 | 1;
    /** 排序顺序 */
    sortOrder?: number;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    code?: number;
    message?: string;
    data?: {
      id?: number;
      roleName?: string;
      roleDesc?: string;
      status?: number;
      isSystemRole?: number;
      sortOrder?: number;
      createdAt?: string;
      updatedAt?: string;
    };
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

/** 删除角色 删除指定的角色 DELETE /api/v1/admin/roles/${param0} */
export async function deleteRole(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.deleteRoleParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{ code?: number; message?: string }>(
    `/api/v1/admin/roles/${param0}`,
    {
      method: "DELETE",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 修改角色状态 修改指定角色的状态 PATCH /api/v1/admin/roles/${param0}/status */
export async function updateRoleStatus(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.updateRoleStatusParams,
  body: {
    /** 状态：0-禁用，1-启用 */
    status: 0 | 1;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{ code?: number; message?: string }>(
    `/api/v1/admin/roles/${param0}/status`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      params: { ...queryParams },
      data: body,
      ...(options || {}),
    }
  );
}

/** 为用户分配角色 为指定用户分配一个或多个角色 POST /api/v1/admin/roles/assign */
export async function assignRolesToUser(
  body: {
    /** 用户ID */
    userId: number;
    /** 角色ID列表 */
    roleIds: number[];
    /** 过期时间（可选） */
    expiresAt?: string;
  },
  options?: { [key: string]: any }
) {
  return request<{ code?: number; message?: string }>(
    "/api/v1/admin/roles/assign",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      data: body,
      ...(options || {}),
    }
  );
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
    data?: {
      id?: number;
      roleName?: string;
      roleDesc?: string;
      status?: number;
      isSystemRole?: number;
    }[];
  }>(`/api/v1/admin/roles/user/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}
