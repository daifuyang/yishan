// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 获取文章列表 分页获取门户文章列表，支持关键词、状态和分类过滤 GET /api/v1/admin/articles/ */
export async function getArticleList(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getArticleListParams,
  options?: { [key: string]: any }
) {
  return request<API.articleListResp>("/api/v1/admin/articles/", {
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

/** 创建文章 创建一个新的门户文章，支持分类与自定义属性 POST /api/v1/admin/articles/ */
export async function createArticle(
  body: API.createArticleReq,
  options?: { [key: string]: any }
) {
  return request<API.articleDetailResp>("/api/v1/admin/articles/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 获取文章详情 根据文章ID获取文章详情 GET /api/v1/admin/articles/${param0} */
export async function getArticleDetail(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getArticleDetailParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.articleDetailResp>(`/api/v1/admin/articles/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 更新文章 根据文章ID更新文章信息 PUT /api/v1/admin/articles/${param0} */
export async function updateArticle(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.updateArticleParams,
  body: API.updateArticleReq,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.articleDetailResp>(`/api/v1/admin/articles/${param0}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 删除文章 根据文章ID进行软删除 DELETE /api/v1/admin/articles/${param0} */
export async function deleteArticle(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.deleteArticleParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.articleDeleteResp>(`/api/v1/admin/articles/${param0}`, {
    method: "DELETE",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 发布文章 将文章状态改为已发布并设置发布时间 POST /api/v1/admin/articles/${param0}/publish */
export async function publishArticle(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.publishArticleParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.articleDetailResp>(
    `/api/v1/admin/articles/${param0}/publish`,
    {
      method: "POST",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 设置文章模板 为文章设置或取消模板 PATCH /api/v1/admin/articles/${param0}/template */
export async function assignArticleTemplate(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.assignArticleTemplateParams,
  body: API.assignTemplateReq,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.articleDetailResp>(
    `/api/v1/admin/articles/${param0}/template`,
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

/** 获取文章模板列表 分页获取文章模板列表 GET /api/v1/admin/articles/templates */
export async function getArticleTemplateList(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getArticleTemplateListParams,
  options?: { [key: string]: any }
) {
  return request<API.templateListResp>("/api/v1/admin/articles/templates", {
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

/** 创建文章模板 创建文章模板并设置结构/配置 POST /api/v1/admin/articles/templates */
export async function createArticleTemplate(
  body: API.createTemplateReq,
  options?: { [key: string]: any }
) {
  return request<API.templateDetailResp>("/api/v1/admin/articles/templates", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 更新文章模板 根据ID更新文章模板 PUT /api/v1/admin/articles/templates/${param0} */
export async function updateArticleTemplate(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.updateArticleTemplateParams,
  body: API.updateTemplateReq,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.templateDetailResp>(
    `/api/v1/admin/articles/templates/${param0}`,
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

/** 删除文章模板 根据ID软删除文章模板 DELETE /api/v1/admin/articles/templates/${param0} */
export async function deleteArticleTemplate(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.deleteArticleTemplateParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.templateDeleteResp>(
    `/api/v1/admin/articles/templates/${param0}`,
    {
      method: "DELETE",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 获取文章模板结构 根据模板ID获取模板结构元配置 GET /api/v1/admin/articles/templates/${param0}/schema */
export async function getArticleTemplateSchema(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getArticleTemplateSchemaParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.templateSchemaResp>(
    `/api/v1/admin/articles/templates/${param0}/schema`,
    {
      method: "GET",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 更新文章模板结构 根据模板ID更新模板结构元配置 PUT /api/v1/admin/articles/templates/${param0}/schema */
export async function updateArticleTemplateSchema(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.updateArticleTemplateSchemaParams,
  body: API.updateTemplateSchemaReq,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.templateSchemaResp>(
    `/api/v1/admin/articles/templates/${param0}/schema`,
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
