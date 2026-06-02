// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 获取属性列表 GET /api/modules/shop/v1/admin/attributes/ */
export async function getModulesShopV1AdminAttributes(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getModulesShopV1AdminAttributesParams,
  options?: { [key: string]: any }
) {
  return request<any>("/api/modules/shop/v1/admin/attributes/", {
    method: "GET",
    params: {
      ...params,
    },
    ...(options || {}),
  });
}

/** 创建属性 POST /api/modules/shop/v1/admin/attributes/ */
export async function postModulesShopV1AdminAttributes(
  body: {
    name: string;
    type?: number;
    sortOrder?: number;
    status?: number;
    values?: { value: string; image?: string; sortOrder?: number }[];
  },
  options?: { [key: string]: any }
) {
  return request<any>("/api/modules/shop/v1/admin/attributes/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 获取属性详情 GET /api/modules/shop/v1/admin/attributes/${param0} */
export async function getModulesShopV1AdminAttributesId(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getModulesShopV1AdminAttributesIdParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/modules/shop/v1/admin/attributes/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 更新属性 PUT /api/modules/shop/v1/admin/attributes/${param0} */
export async function putModulesShopV1AdminAttributesId(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.putModulesShopV1AdminAttributesIdParams,
  body: {
    name?: string;
    type?: number;
    sortOrder?: number;
    status?: number;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/modules/shop/v1/admin/attributes/${param0}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 删除属性 DELETE /api/modules/shop/v1/admin/attributes/${param0} */
export async function deleteModulesShopV1AdminAttributesId(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.deleteModulesShopV1AdminAttributesIdParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/modules/shop/v1/admin/attributes/${param0}`, {
    method: "DELETE",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 创建属性值 POST /api/modules/shop/v1/admin/attributes/${param0}/values */
export async function postModulesShopV1AdminAttributesIdValues(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.postModulesShopV1AdminAttributesIdValuesParams,
  body: {
    value: string;
    image?: string;
    sortOrder?: number;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(
    `/api/modules/shop/v1/admin/attributes/${param0}/values`,
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

/** 获取规格属性列表 GET /api/modules/shop/v1/admin/attributes/specs */
export async function getModulesShopV1AdminAttributesSpecs(options?: {
  [key: string]: any;
}) {
  return request<any>("/api/modules/shop/v1/admin/attributes/specs", {
    method: "GET",
    ...(options || {}),
  });
}

/** 更新属性值 PUT /api/modules/shop/v1/admin/attributes/values/${param0} */
export async function putModulesShopV1AdminAttributesValuesValueId(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.putModulesShopV1AdminAttributesValuesValueIdParams,
  body: {
    value?: string;
    image?: string;
    sortOrder?: number;
    status?: number;
  },
  options?: { [key: string]: any }
) {
  const { valueId: param0, ...queryParams } = params;
  return request<any>(
    `/api/modules/shop/v1/admin/attributes/values/${param0}`,
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

/** 删除属性值 DELETE /api/modules/shop/v1/admin/attributes/values/${param0} */
export async function deleteModulesShopV1AdminAttributesValuesValueId(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.deleteModulesShopV1AdminAttributesValuesValueIdParams,
  options?: { [key: string]: any }
) {
  const { valueId: param0, ...queryParams } = params;
  return request<any>(
    `/api/modules/shop/v1/admin/attributes/values/${param0}`,
    {
      method: "DELETE",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}
