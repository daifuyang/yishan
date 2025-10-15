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
    data?: {
      list?: {
        id?: number;
        username?: string;
        email?: string;
        phone?: string;
        real_name?: string;
        avatar?: string;
        gender?: number;
        birth_date?: string;
        status?: number;
        last_login_time?: string;
        last_login_ip?: string;
        login_count?: number;
        created_at?: string;
        updated_at?: string;
      }[];
      pagination?: {
        page?: number;
        pageSize?: number;
        total?: number;
        totalPages?: number;
      };
    };
  }>("/api/v1/admin/users/", {
    method: "GET",
    params: {
      // page has a default value: 1
      page: "1",
      // pageSize has a default value: 10
      pageSize: "10",

      // sort_by has a default value: created_at
      sort_by: "created_at",
      // sort_order has a default value: desc
      sort_order: "desc",
      ...params,
    },
    ...(options || {}),
  });
}

/** 创建新用户 创建一个新的用户账户 POST /api/v1/admin/users/ */
export async function postAdminUsers(
  body: {
    /** 用户名 */
    username: string;
    /** 用户邮箱 */
    email: string;
    /** 手机号 */
    phone?: string;
    /** 用户密码 */
    password: string;
    /** 真实姓名 */
    realName: string;
    /** 头像URL */
    avatar?: string;
    /** 性别：0-未知，1-男，2-女 */
    gender?: 0 | 1 | 2;
    /** 出生日期 */
    birthDate?: string;
    /** 状态：0-禁用，1-启用，2-锁定 */
    status?: 0 | 1 | 2;
  },
  options?: { [key: string]: any }
) {
  return request<{
    code?: number;
    message?: string;
    data?: {
      id?: number;
      username?: string;
      email?: string;
      phone?: string;
      real_name?: string;
      avatar?: string;
      gender?: number;
      birth_date?: string;
      status?: number;
      created_at?: string;
      updated_at?: string;
    };
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
    data?: {
      id?: number;
      username?: string;
      email?: string;
      phone?: string;
      realName?: string;
      avatar?: string;
      gender?: number;
      birthDate?: string;
      status?: number;
      last_login_time?: string;
      last_login_ip?: string;
      login_count?: number;
      created_at?: string;
      updated_at?: string;
    };
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
  body: {
    /** 用户名 */
    username?: string;
    /** 用户邮箱 */
    email?: string;
    /** 手机号 */
    phone?: string;
    /** 真实姓名 */
    real_name?: string;
    /** 头像URL */
    avatar?: string;
    /** 性别：0-未知，1-男，2-女 */
    gender?: 0 | 1 | 2;
    /** 出生日期 */
    birth_date?: string;
    /** 状态：0-禁用，1-启用，2-锁定 */
    status?: 0 | 1 | 2;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    code?: number;
    message?: string;
    data?: {
      id?: number;
      username?: string;
      email?: string;
      phone?: string;
      real_name?: string;
      avatar?: string;
      gender?: number;
      birth_date?: string;
      status?: number;
      updated_at?: string;
    };
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
  return request<{ code?: number; message?: string }>(
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
  body: {
    /** 状态：0-禁用，1-启用，2-锁定 */
    status: 0 | 1 | 2;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    code?: number;
    message?: string;
    data?: { id?: number; username?: string; status?: number };
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
    data?: {
      id?: number;
      username?: string;
      email?: string;
      phone?: string;
      real_name?: string;
      avatar?: string;
      gender?: number;
      birth_date?: string;
      status?: number;
      created_at?: string;
      updated_at?: string;
    };
  }>("/api/v1/admin/users/findOne", {
    method: "GET",
    params: {
      ...params,
    },
    ...(options || {}),
  });
}
