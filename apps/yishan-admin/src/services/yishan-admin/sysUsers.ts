// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 获取用户列表 获取用户列表，支持分页和筛选 GET /api/v1/admin/users/ */
export async function getUserList(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getUserListParams,
  options?: { [key: string]: any }
) {
  return request<{
    code?: number;
    message?: string;
    data?: API.sysUserListResponse;
    success?: boolean;
    timestamp?: string;
    request_id?: string;
  }>("/api/v1/admin/users/", {
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

/** 创建用户 创建新用户 POST /api/v1/admin/users/ */
export async function createUser(
  body: API.sysUserCreateRequest,
  options?: { [key: string]: any }
) {
  return request<{
    code?: number;
    message?: string;
    data?: API.sysUser;
    success?: boolean;
    timestamp?: string;
    request_id?: string;
  }>("/api/v1/admin/users/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 获取用户详情 根据ID获取用户详细信息 GET /api/v1/admin/users/${param0} */
export async function getUserById(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getUserByIdParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    code?: number;
    message?: string;
    data?: API.sysUser;
    success?: boolean;
    timestamp?: string;
    request_id?: string;
  }>(`/api/v1/admin/users/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 更新用户信息 根据ID更新用户信息 PUT /api/v1/admin/users/${param0} */
export async function updateUser(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.updateUserParams,
  body: API.sysUserUpdateRequest,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{ code?: number; message?: string; data?: API.sysUser }>(
    `/api/v1/admin/users/${param0}`,
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

/** 删除用户 根据ID删除用户 DELETE /api/v1/admin/users/${param0} */
export async function deleteUser(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.deleteUserParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{ code?: number; message?: string; data?: null }>(
    `/api/v1/admin/users/${param0}`,
    {
      method: "DELETE",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 修改用户密码 修改指定用户的密码 PATCH /api/v1/admin/users/${param0}/password */
export async function updateUserPassword(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.updateUserPasswordParams,
  body: API.sysUserPasswordChangeRequest,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    code?: number;
    message?: string;
    data?: { success?: boolean };
  }>(`/api/v1/admin/users/${param0}/password`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 重置用户密码 重置指定用户的密码为默认密码 PATCH /api/v1/admin/users/${param0}/password/reset */
export async function resetUserPassword(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.resetUserPasswordParams,
  body: {
    /** 新密码（可选，不提供则使用默认密码） */
    newPassword?: string;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    code?: number;
    message?: string;
    data?: { success?: boolean; defaultPassword?: string };
  }>(`/api/v1/admin/users/${param0}/password/reset`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 修改用户状态 修改指定用户的状态 PATCH /api/v1/admin/users/${param0}/status */
export async function updateUserStatus(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.updateUserStatusParams,
  body: API.sysUserStatusRequest,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{ code?: number; message?: string; data?: API.sysUser }>(
    `/api/v1/admin/users/${param0}/status`,
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

/** 批量删除用户 根据ID批量删除用户 DELETE /api/v1/admin/users/batch */
export async function batchDeleteUsers(
  body: API.sysUserBatchDeleteRequest,
  options?: { [key: string]: any }
) {
  return request<{
    code?: number;
    message?: string;
    data?: API.sysUserBatchResponse;
    success?: boolean;
    timestamp?: string;
    request_id?: string;
  }>("/api/v1/admin/users/batch", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 清除用户缓存 DELETE /api/v1/admin/users/cache */
export async function clearUserCache(options?: { [key: string]: any }) {
  return request<{
    code?: number;
    message?: string;
    data?: null;
    success?: boolean;
    timestamp?: string;
  }>("/api/v1/admin/users/cache", {
    method: "DELETE",
    ...(options || {}),
  });
}

/** 根据用户名获取用户详情 根据用户名获取用户详细信息 GET /api/v1/admin/users/username/${param0} */
export async function getUserByUsername(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getUserByUsernameParams,
  options?: { [key: string]: any }
) {
  const { username: param0, ...queryParams } = params;
  return request<{
    code?: number;
    message?: string;
    data?: API.sysUser;
    success?: boolean;
    timestamp?: string;
    request_id?: string;
  }>(`/api/v1/admin/users/username/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}
