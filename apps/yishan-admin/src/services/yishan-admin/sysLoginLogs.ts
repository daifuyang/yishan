// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 获取登录日志列表 分页获取系统登录日志列表，支持关键词搜索与状态筛选 GET /api/v1/admin/system/login-logs/ */
export async function getLoginLogList(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getLoginLogListParams,
  options?: { [key: string]: any }
) {
  return request<API.sysLoginLogListResp>("/api/v1/admin/system/login-logs/", {
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

/** 获取登录日志详情 根据日志ID获取登录日志详情 GET /api/v1/admin/system/login-logs/${param0} */
export async function getLoginLogDetail(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getLoginLogDetailParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.sysLoginLogDetailResp>(
    `/api/v1/admin/system/login-logs/${param0}`,
    {
      method: "GET",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}
