// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 获取用户列表 获取系统用户列表，支持分页、搜索和排序 GET /api/v1/admin/users/ */
export async function getUserList(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getUserListParams,
  options?: { [key: string]: any }
) {
  return request<{
    code?: number;
    message?: string;
    isSuccess?: boolean;
    data?: API.sysUserListResponse;
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

/** 创建新用户 创建一个新的用户账户 POST /api/v1/admin/users/ */
export async function postAdminUsers(
  body: API.sysUserCreateRequest,
  options?: { [key: string]: any }
) {
  return request<{
    code?: number;
    message?: string;
    isSuccess?: boolean;
    data?: API.sysUser;
  }>("/api/v1/admin/users/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 获取用户详情 根据用户ID获取用户详细信息 GET /api/v1/admin/users/${param0} */
export async function getUserDetail(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getUserDetailParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    code?: number;
    message?: string;
    isSuccess?: boolean;
    data?: API.sysUser;
  }>(`/api/v1/admin/users/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 更新用户信息 更新指定用户的信息 PUT /api/v1/admin/users/${param0} */
export async function updateUser(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.updateUserParams,
  body: API.sysUserUpdateRequest,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    code?: number;
    message?: string;
    isSuccess?: boolean;
    data?: API.sysUser;
  }>(`/api/v1/admin/users/${param0}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 删除用户 删除指定用户（软删除） DELETE /api/v1/admin/users/${param0} */
export async function deleteUser(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.deleteUserParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{ code?: number; message?: string; isSuccess?: boolean }>(
    `/api/v1/admin/users/${param0}`,
    {
      method: "DELETE",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 重置用户密码 重置指定用户的密码 PATCH /api/v1/admin/users/${param0}/password */
export async function resetUserPassword(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.resetUserPasswordParams,
  body: {
    /** 新密码 */
    newPassword: string;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{ code?: number; message?: string }>(
    `/api/v1/admin/users/${param0}/password`,
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

/** 修改用户状态 修改指定用户的状态 PATCH /api/v1/admin/users/${param0}/status */
export async function updateUserStatus(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.updateUserStatusParams,
  body: API.sysUserStatusRequest,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    code?: number;
    message?: string;
    isSuccess?: boolean;
    data?: API.sysUserStatusResponse;
  }>(`/api/v1/admin/users/${param0}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 根据搜索条件获取单个管理员信息 根据搜索条件(用户名、邮箱、真实姓名、手机号)获取单个管理员信息 GET /api/v1/admin/users/findOne */
export async function getUserBySearch(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getUserBySearchParams,
  options?: { [key: string]: any }
) {
  return request<{
    code?: number;
    message?: string;
    isSuccess?: boolean;
    data?: API.sysUser;
  }>("/api/v1/admin/users/findOne", {
    method: "GET",
    params: {
      ...params,
    },
    ...(options || {}),
  });
}
