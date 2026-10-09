// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 获取管理员用户列表 分页获取系统用户列表，支持关键词搜索和状态筛选 GET /api/v1/admin/users/ */
export async function getUserList(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getUserListParams,
  options?: { [key: string]: any }
) {
  return request<API.userListResp>("/api/v1/admin/users/", {
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

/** 创建用户 创建一个新的系统用户 POST /api/v1/admin/users/ */
export async function createUser(
  body: API.createUserReq,
  options?: { [key: string]: any }
) {
  return request<API.userDetailResp>("/api/v1/admin/users/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 获取用户详情 根据用户ID获取用户详情 GET /api/v1/admin/users/${param0} */
export async function getUserDetail(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getUserDetailParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.userDetailResp>(`/api/v1/admin/users/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 更新用户 根据用户ID更新用户信息 PUT /api/v1/admin/users/${param0} */
export async function updateUser(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.updateUserParams,
  body: API.updateUserReq,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.userDetailResp>(`/api/v1/admin/users/${param0}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 删除用户 根据用户ID进行软删除，并撤销所有令牌 DELETE /api/v1/admin/users/${param0} */
export async function deleteUser(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.deleteUserParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.userDeleteResp>(`/api/v1/admin/users/${param0}`, {
    method: "DELETE",
    params: { ...queryParams },
    ...(options || {}),
  });
}
