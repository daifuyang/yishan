// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 获取分类列表 分页获取文章分类列表，支持关键词、状态和父级过滤 GET /api/v1/admin/articles/categories */
export async function getCategoryList(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getCategoryListParams,
  options?: { [key: string]: any }
) {
  return request<API.categoryListResp>("/api/v1/admin/articles/categories", {
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
      ...params,
    },
    ...(options || {}),
  });
}

/** 创建分类 创建一个新的文章分类 POST /api/v1/admin/articles/categories */
export async function createCategory(
  body: API.saveCategoryReq,
  options?: { [key: string]: any }
) {
  return request<API.categoryDetailResp>("/api/v1/admin/articles/categories", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 获取分类详情 根据分类ID获取分类详情 GET /api/v1/admin/articles/categories/${param0} */
export async function getCategoryDetail(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getCategoryDetailParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.categoryDetailResp>(
    `/api/v1/admin/articles/categories/${param0}`,
    {
      method: "GET",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 更新分类 根据分类ID更新分类信息 PUT /api/v1/admin/articles/categories/${param0} */
export async function updateCategory(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.updateCategoryParams,
  body: API.updateCategoryReq,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.categoryDetailResp>(
    `/api/v1/admin/articles/categories/${param0}`,
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

/** 删除分类 根据分类ID进行软删除 DELETE /api/v1/admin/articles/categories/${param0} */
export async function deleteCategory(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.deleteCategoryParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.categoryDeleteResp>(
    `/api/v1/admin/articles/categories/${param0}`,
    {
      method: "DELETE",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}
