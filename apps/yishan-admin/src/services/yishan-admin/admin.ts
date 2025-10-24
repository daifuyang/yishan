// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 获取管理员用户列表 分页获取系统用户列表，支持关键词搜索和状态筛选 GET /api/v1/admin/users/ */
export async function getAdminUserList(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getAdminUserListParams,
  options?: { [key: string]: any }
) {
  return request<API.userListResponse>("/api/v1/admin/users/", {
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
