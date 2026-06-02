// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 获取分类列表 GET /api/modules/shop/v1/admin/categories/ */
export async function getModulesShopV1AdminCategories(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getModulesShopV1AdminCategoriesParams,
  options?: { [key: string]: any }
) {
  return request<any>("/api/modules/shop/v1/admin/categories/", {
    method: "GET",
    params: {
      ...params,
    },
    ...(options || {}),
  });
}

/** 创建分类 POST /api/modules/shop/v1/admin/categories/ */
export async function postModulesShopV1AdminCategories(
  body: {
    name: string;
    parentId?: number | null;
    coverImage?: string;
    icon?: string;
    description?: string;
    sortOrder?: number;
    status?: number;
  },
  options?: { [key: string]: any }
) {
  return request<any>("/api/modules/shop/v1/admin/categories/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 获取分类详情 GET /api/modules/shop/v1/admin/categories/${param0} */
export async function getModulesShopV1AdminCategoriesId(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getModulesShopV1AdminCategoriesIdParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/modules/shop/v1/admin/categories/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 更新分类 PUT /api/modules/shop/v1/admin/categories/${param0} */
export async function putModulesShopV1AdminCategoriesId(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.putModulesShopV1AdminCategoriesIdParams,
  body: {
    name?: string;
    parentId?: number | null;
    coverImage?: string;
    icon?: string;
    description?: string;
    sortOrder?: number;
    status?: number;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/modules/shop/v1/admin/categories/${param0}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 删除分类 DELETE /api/modules/shop/v1/admin/categories/${param0} */
export async function deleteModulesShopV1AdminCategoriesId(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.deleteModulesShopV1AdminCategoriesIdParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/modules/shop/v1/admin/categories/${param0}`, {
    method: "DELETE",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 获取分类树 GET /api/modules/shop/v1/admin/categories/tree */
export async function getModulesShopV1AdminCategoriesTree(options?: {
  [key: string]: any;
}) {
  return request<any>("/api/modules/shop/v1/admin/categories/tree", {
    method: "GET",
    ...(options || {}),
  });
}
