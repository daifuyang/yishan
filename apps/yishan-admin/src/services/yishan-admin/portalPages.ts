// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 获取页面列表 分页获取门户页面列表，支持关键词与状态筛选 GET /api/v1/admin/pages/ */
export async function getPageList(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getPageListParams,
  options?: { [key: string]: any }
) {
  return request<API.pageListResp>("/api/v1/admin/pages/", {
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

/** 创建页面 创建一个新的门户页面，支持自定义属性 POST /api/v1/admin/pages/ */
export async function createPage(
  body: API.createPageReq,
  options?: { [key: string]: any }
) {
  return request<API.pageDetailResp>("/api/v1/admin/pages/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 获取页面详情 根据页面ID获取页面详情 GET /api/v1/admin/pages/${param0} */
export async function getPageDetail(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getPageDetailParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.pageDetailResp>(`/api/v1/admin/pages/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 更新页面 根据页面ID更新页面信息 PUT /api/v1/admin/pages/${param0} */
export async function updatePage(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.updatePageParams,
  body: API.updatePageReq,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.pageDetailResp>(`/api/v1/admin/pages/${param0}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 删除页面 根据页面ID进行软删除 DELETE /api/v1/admin/pages/${param0} */
export async function deletePage(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.deletePageParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.pageDeleteResp>(`/api/v1/admin/pages/${param0}`, {
    method: "DELETE",
    params: { ...queryParams },
    ...(options || {}),
  });
}
