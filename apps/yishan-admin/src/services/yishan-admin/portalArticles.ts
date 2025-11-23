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
