// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 获取岗位列表 分页获取系统岗位列表，支持关键词搜索和状态筛选 GET /api/v1/admin/positions/ */
export async function getPositionList(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getPositionListParams,
  options?: { [key: string]: any }
) {
  return request<API.positionListResp>("/api/v1/admin/positions/", {
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

/** 创建岗位 创建一个新的岗位 POST /api/v1/admin/positions/ */
export async function createPosition(
  body: API.savePositionReq,
  options?: { [key: string]: any }
) {
  return request<API.positionDetailResp>("/api/v1/admin/positions/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 获取岗位详情 根据岗位ID获取岗位详情 GET /api/v1/admin/positions/${param0} */
export async function getPositionDetail(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getPositionDetailParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.positionDetailResp>(`/api/v1/admin/positions/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 更新岗位 根据岗位ID更新岗位信息 PUT /api/v1/admin/positions/${param0} */
export async function updatePosition(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.updatePositionParams,
  body: API.updatePositionReq,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.positionDetailResp>(`/api/v1/admin/positions/${param0}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 删除岗位 根据岗位ID进行软删除 DELETE /api/v1/admin/positions/${param0} */
export async function deletePosition(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.deletePositionParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.positionDeleteResp>(`/api/v1/admin/positions/${param0}`, {
    method: "DELETE",
    params: { ...queryParams },
    ...(options || {}),
  });
}
