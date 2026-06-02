// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

type ShopIdActionResp = {
  code: number;
  message: string;
  success: boolean;
  data: {
    id: number;
  };
  timestamp: string;
};

/** 获取商品列表 分页获取商品列表，支持关键词、分类、状态等筛选 GET /api/modules/shop/v1/admin/products/ */
export async function getProductList(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getProductListParams,
  options?: { [key: string]: any }
) {
  return request<API.shopProductListResp>(
    "/api/modules/shop/v1/admin/products/",
    {
      method: "GET",
      params: {
        // page has a default value: 1
        page: "1",
        // pageSize has a default value: 10
        pageSize: "10",

        ...params,
      },
      ...(options || {}),
    }
  );
}

/** 创建商品 创建新商品，支持多SKU POST /api/modules/shop/v1/admin/products/ */
export async function createProduct(
  body: API.shopCreateProductReq,
  options?: { [key: string]: any }
) {
  return request<API.shopProductDetailResp>(
    "/api/modules/shop/v1/admin/products/",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      data: body,
      ...(options || {}),
    }
  );
}

/** 获取商品详情 根据商品ID获取商品详情，包含SKU信息 GET /api/modules/shop/v1/admin/products/${param0} */
export async function getProductDetail(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getProductDetailParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.shopProductDetailResp>(
    `/api/modules/shop/v1/admin/products/${param0}`,
    {
      method: "GET",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 更新商品 根据商品ID更新商品信息 PUT /api/modules/shop/v1/admin/products/${param0} */
export async function updateProduct(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.updateProductParams,
  body: API.shopUpdateProductReq,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.shopProductDetailResp>(
    `/api/modules/shop/v1/admin/products/${param0}`,
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

/** 删除商品 根据商品ID永久删除商品 DELETE /api/modules/shop/v1/admin/products/${param0} */
export async function deleteProduct(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.deleteProductParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<ShopIdActionResp>(
    `/api/modules/shop/v1/admin/products/${param0}`,
    {
      method: "DELETE",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 移到回收站 将商品移至回收站 PUT /api/modules/shop/v1/admin/products/${param0}/recycle */
export async function moveProductToRecycle(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.moveProductToRecycleParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<ShopIdActionResp>(
    `/api/modules/shop/v1/admin/products/${param0}/recycle`,
    {
      method: "PUT",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 从回收站恢复 将商品从回收站恢复 PUT /api/modules/shop/v1/admin/products/${param0}/restore */
export async function restoreProductFromRecycle(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.restoreProductFromRecycleParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<ShopIdActionResp>(
    `/api/modules/shop/v1/admin/products/${param0}/restore`,
    {
      method: "PUT",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}
