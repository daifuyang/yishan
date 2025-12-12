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

/** 设置页面模板 为页面设置或取消模板 PATCH /api/v1/admin/pages/${param0}/template */
export async function assignPageTemplate(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.assignPageTemplateParams,
  body: API.assignTemplateReq,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.pageDetailResp>(`/api/v1/admin/pages/${param0}/template`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 获取页面模板列表 分页获取页面模板列表 GET /api/v1/admin/pages/templates */
export async function getPageTemplateList(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getPageTemplateListParams,
  options?: { [key: string]: any }
) {
  return request<API.templateListResp>("/api/v1/admin/pages/templates", {
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

/** 创建页面模板 创建页面模板并设置结构/配置 POST /api/v1/admin/pages/templates */
export async function createPageTemplate(
  body: API.createTemplateReq,
  options?: { [key: string]: any }
) {
  return request<API.templateDetailResp>("/api/v1/admin/pages/templates", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 更新页面模板 根据ID更新页面模板 PUT /api/v1/admin/pages/templates/${param0} */
export async function updatePageTemplate(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.updatePageTemplateParams,
  body: API.updateTemplateReq,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.templateDetailResp>(
    `/api/v1/admin/pages/templates/${param0}`,
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

/** 删除页面模板 根据ID软删除页面模板 DELETE /api/v1/admin/pages/templates/${param0} */
export async function deletePageTemplate(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.deletePageTemplateParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.templateDeleteResp>(
    `/api/v1/admin/pages/templates/${param0}`,
    {
      method: "DELETE",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 获取页面模板结构 根据模板ID获取模板结构元配置 GET /api/v1/admin/pages/templates/${param0}/schema */
export async function getPageTemplateSchema(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getPageTemplateSchemaParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.templateSchemaResp>(
    `/api/v1/admin/pages/templates/${param0}/schema`,
    {
      method: "GET",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 更新页面模板结构 根据模板ID更新模板结构元配置 PUT /api/v1/admin/pages/templates/${param0}/schema */
export async function updatePageTemplateSchema(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.updatePageTemplateSchemaParams,
  body: API.updateTemplateSchemaReq,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.templateSchemaResp>(
    `/api/v1/admin/pages/templates/${param0}/schema`,
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
