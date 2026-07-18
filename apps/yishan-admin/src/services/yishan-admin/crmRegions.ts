// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 地区列表 GET /api/modules/crm/v1/admin/regions/ */
export async function crmListRegions(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmListRegionsParams,
  options?: { [key: string]: any }
) {
  return request<any>("/api/modules/crm/v1/admin/regions/", {
    method: "GET",
    params: {
      ...params,
    },
    ...(options || {}),
  });
}
