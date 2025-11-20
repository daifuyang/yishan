// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 获取字典数据列表 分页获取字典数据列表 GET /api/v1/admin/dicts/data */
export async function getDictDataList(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getDictDataListParams,
  options?: { [key: string]: any }
) {
  return request<API.dictDataListResp>("/api/v1/admin/dicts/data", {
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

/** 创建字典数据 创建字典数据 POST /api/v1/admin/dicts/data */
export async function createDictData(
  body: API.saveDictDataReq,
  options?: { [key: string]: any }
) {
  return request<API.dictDataDetailResp>("/api/v1/admin/dicts/data", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 获取字典数据详情 根据字典数据ID获取详情 GET /api/v1/admin/dicts/data/${param0} */
export async function getDictDataDetail(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getDictDataDetailParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.dictDataDetailResp>(`/api/v1/admin/dicts/data/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 更新字典数据 更新字典数据 PUT /api/v1/admin/dicts/data/${param0} */
export async function updateDictData(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.updateDictDataParams,
  body: API.updateDictDataReq,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.dictDataDetailResp>(`/api/v1/admin/dicts/data/${param0}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 删除字典数据 软删除字典数据 DELETE /api/v1/admin/dicts/data/${param0} */
export async function deleteDictData(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.deleteDictDataParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.dictDataDeleteResp>(`/api/v1/admin/dicts/data/${param0}`, {
    method: "DELETE",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 获取全部字典数据映射 获取所有启用的字典数据，按字典类型分组，返回key:{label:'',value:''}的形式 GET /api/v1/admin/dicts/data/map */
export async function getDictDataMap(options?: { [key: string]: any }) {
  return request<API.dictDataMapResp>("/api/v1/admin/dicts/data/map", {
    method: "GET",
    ...(options || {}),
  });
}
