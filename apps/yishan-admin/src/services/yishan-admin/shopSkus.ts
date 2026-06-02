// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 获取SKU列表 GET /api/modules/shop/v1/admin/skus/ */
export async function getModulesShopV1AdminSkus(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getModulesShopV1AdminSkusParams,
  options?: { [key: string]: any }
) {
  return request<any>("/api/modules/shop/v1/admin/skus/", {
    method: "GET",
    params: {
      ...params,
    },
    ...(options || {}),
  });
}

/** 创建SKU POST /api/modules/shop/v1/admin/skus/ */
export async function postModulesShopV1AdminSkus(
  body: {
    productId: number;
    skuCode: string;
    skuName: string;
    price: number;
    costPrice?: number;
    stock?: number;
    weight?: number;
    coverImage?: string;
    status?: number;
    attributes?: { attributeId: number; valueId: number }[];
  },
  options?: { [key: string]: any }
) {
  return request<any>("/api/modules/shop/v1/admin/skus/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 获取SKU详情 GET /api/modules/shop/v1/admin/skus/${param0} */
export async function getModulesShopV1AdminSkusId(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getModulesShopV1AdminSkusIdParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/modules/shop/v1/admin/skus/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 更新SKU PUT /api/modules/shop/v1/admin/skus/${param0} */
export async function putModulesShopV1AdminSkusId(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.putModulesShopV1AdminSkusIdParams,
  body: {
    skuCode?: string;
    skuName?: string;
    price?: number;
    costPrice?: number;
    stock?: number;
    weight?: number;
    coverImage?: string;
    status?: number;
    attributes?: { attributeId: number; valueId: number }[];
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/modules/shop/v1/admin/skus/${param0}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 删除SKU DELETE /api/modules/shop/v1/admin/skus/${param0} */
export async function deleteModulesShopV1AdminSkusId(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.deleteModulesShopV1AdminSkusIdParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/modules/shop/v1/admin/skus/${param0}`, {
    method: "DELETE",
    params: { ...queryParams },
    ...(options || {}),
  });
}
