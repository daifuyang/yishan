// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 获取全量字典映射（移动端） 返回 { [type]: [{label, value}] } 的字典映射，移动端可一次性加载 GET /api/v1/app/dicts/ */
export async function appGetAllDictMap(options?: { [key: string]: any }) {
  return request<{
    success?: boolean;
    code?: number;
    message?: string;
    data?: Record<string, any>;
    timestamp?: string;
  }>("/api/v1/app/dicts/", {
    method: "GET",
    ...(options || {}),
  });
}

/** 按类型查询字典数据（移动端） 根据字典类型（type）返回启用状态的字典数据列表 GET /api/v1/app/dicts/${param0} */
export async function appGetDictByType(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appGetDictByTypeParams,
  options?: { [key: string]: any }
) {
  const { type: param0, ...queryParams } = params;
  return request<{
    success?: boolean;
    code?: number;
    message?: string;
    data?: {
      id?: number;
      typeId?: number;
      type?: string;
      label?: string;
      value?: string;
      tag?: string;
      sortOrder?: number;
      isDefault?: boolean;
    }[];
    timestamp?: string;
  }>(`/api/v1/app/dicts/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}
