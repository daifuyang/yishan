// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 地区列表 按父级行政区划代码获取下级地区列表 GET /api/v1/admin/system/regions/ */
export async function listSystemRegions(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.listSystemRegionsParams,
  options?: { [key: string]: any }
) {
  return request<{
    success: boolean;
    code: number;
    message: string;
    data: {
      code: number;
      name: string;
      level: number;
      parentCode: number;
      sortOrder: number;
    }[];
    timestamp: string;
  }>("/api/v1/admin/system/regions/", {
    method: "GET",
    params: {
      ...params,
    },
    ...(options || {}),
  });
}

/** 地区详情 按行政区划代码获取地区详情 GET /api/v1/admin/system/regions/${param0} */
export async function getSystemRegion(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getSystemRegionParams,
  options?: { [key: string]: any }
) {
  const { code: param0, ...queryParams } = params;
  return request<any>(`/api/v1/admin/system/regions/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 地区路径 按行政区划代码获取省市区路径 GET /api/v1/admin/system/regions/path */
export async function getSystemRegionPath(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getSystemRegionPathParams,
  options?: { [key: string]: any }
) {
  return request<any>("/api/v1/admin/system/regions/path", {
    method: "GET",
    params: {
      ...params,
    },
    ...(options || {}),
  });
}

/** 地区树 获取省市区三级地区树 GET /api/v1/admin/system/regions/tree */
export async function getSystemRegionTree(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getSystemRegionTreeParams,
  options?: { [key: string]: any }
) {
  return request<any>("/api/v1/admin/system/regions/tree", {
    method: "GET",
    params: {
      // level has a default value: 3
      level: "3",
      ...params,
    },
    ...(options || {}),
  });
}
