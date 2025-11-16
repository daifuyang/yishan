// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 获取字典类型列表 分页获取字典类型列表 GET /api/v1/admin/dicts/types */
export async function getDictTypeList(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getDictTypeListParams,
  options?: { [key: string]: any }
) {
  return request<API.dictTypeListResp>("/api/v1/admin/dicts/types", {
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

/** 创建字典类型 创建字典类型 POST /api/v1/admin/dicts/types */
export async function createDictType(
  body: API.saveDictTypeReq,
  options?: { [key: string]: any }
) {
  return request<API.dictTypeDetailResp>("/api/v1/admin/dicts/types", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 获取字典类型详情 根据字典类型ID获取详情 GET /api/v1/admin/dicts/types/${param0} */
export async function getDictTypeDetail(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getDictTypeDetailParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.dictTypeDetailResp>(
    `/api/v1/admin/dicts/types/${param0}`,
    {
      method: "GET",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 更新字典类型 更新字典类型 PUT /api/v1/admin/dicts/types/${param0} */
export async function updateDictType(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.updateDictTypeParams,
  body: API.updateDictTypeReq,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.dictTypeDetailResp>(
    `/api/v1/admin/dicts/types/${param0}`,
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

/** 删除字典类型 软删除字典类型 DELETE /api/v1/admin/dicts/types/${param0} */
export async function deleteDictType(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.deleteDictTypeParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.dictTypeDeleteResp>(
    `/api/v1/admin/dicts/types/${param0}`,
    {
      method: "DELETE",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}
