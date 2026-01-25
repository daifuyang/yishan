// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 获取应用资源列表 分页获取应用资源列表，支持关键词、类型与状态过滤 GET /api/v1/admin/apps/${param0}/resources */
export async function getAppResourceList(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getAppResourceListParams,
  options?: { [key: string]: any }
) {
  const { appId: param0, ...queryParams } = params;
  return request<API.appResourceListResp>(
    `/api/v1/admin/apps/${param0}/resources`,
    {
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
        ...queryParams,
      },
      ...(options || {}),
    }
  );
}

/** 创建应用资源 在指定应用下创建资源 POST /api/v1/admin/apps/${param0}/resources */
export async function createAppResource(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.createAppResourceParams,
  body: API.createAppResourceReq,
  options?: { [key: string]: any }
) {
  const { appId: param0, ...queryParams } = params;
  return request<API.appResourceDetailResp>(
    `/api/v1/admin/apps/${param0}/resources`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      params: { ...queryParams },
      data: body,
      ...(options || {}),
    }
  );
}

/** 获取应用资源详情 根据应用资源ID获取详情 GET /api/v1/admin/apps/${param0}/resources/${param1} */
export async function getAppResourceDetail(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getAppResourceDetailParams,
  options?: { [key: string]: any }
) {
  const { appId: param0, id: param1, ...queryParams } = params;
  return request<API.appResourceDetailResp>(
    `/api/v1/admin/apps/${param0}/resources/${param1}`,
    {
      method: "GET",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 更新应用资源 根据资源ID更新应用资源 PUT /api/v1/admin/apps/${param0}/resources/${param1} */
export async function updateAppResource(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.updateAppResourceParams,
  body: API.updateAppResourceReq,
  options?: { [key: string]: any }
) {
  const { appId: param0, id: param1, ...queryParams } = params;
  return request<API.appResourceDetailResp>(
    `/api/v1/admin/apps/${param0}/resources/${param1}`,
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

/** 删除应用资源 根据资源ID软删除应用资源 DELETE /api/v1/admin/apps/${param0}/resources/${param1} */
export async function deleteAppResource(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.deleteAppResourceParams,
  options?: { [key: string]: any }
) {
  const { appId: param0, id: param1, ...queryParams } = params;
  return request<API.appResourceDeleteResp>(
    `/api/v1/admin/apps/${param0}/resources/${param1}`,
    {
      method: "DELETE",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 获取应用资源树 获取指定应用的资源树 GET /api/v1/admin/apps/${param0}/resources/tree */
export async function getAppResourceTree(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: { appId: number },
  options?: { [key: string]: any }
) {
  const { appId: param0 } = params;
  return request<API.appResourceTreeResp>(
    `/api/v1/admin/apps/${param0}/resources/tree`,
    {
      method: "GET",
      ...(options || {}),
    }
  );
}
