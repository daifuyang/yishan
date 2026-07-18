// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 派单列表 GET /api/modules/crm/v1/admin/dispatches/ */
export async function crmListDispatches(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmListDispatchesParams,
  options?: { [key: string]: any }
) {
  return request<any>("/api/modules/crm/v1/admin/dispatches/", {
    method: "GET",
    params: {
      // page has a default value: 1
      page: "1",
      // pageSize has a default value: 10
      pageSize: "10",

      ...params,
    },
    ...(options || {}),
  });
}

/** 派单详情 GET /api/modules/crm/v1/admin/dispatches/${param0} */
export async function crmGetDispatch(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmGetDispatchParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/modules/crm/v1/admin/dispatches/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 更新派单 PUT /api/modules/crm/v1/admin/dispatches/${param0} */
export async function crmUpdateDispatch(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmUpdateDispatchParams,
  body: API.crmDispatchReq,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/modules/crm/v1/admin/dispatches/${param0}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 添加跟进日志 POST /api/modules/crm/v1/admin/dispatches/${param0}/logs */
export async function crmAddDispatchLog(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmAddDispatchLogParams,
  body: API.crmContentReq,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/modules/crm/v1/admin/dispatches/${param0}/logs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 派单回复 POST /api/modules/crm/v1/admin/dispatches/${param0}/replies */
export async function crmAddDispatchReply(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmAddDispatchReplyParams,
  body: API.crmDispatchReplyReq,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(
    `/api/modules/crm/v1/admin/dispatches/${param0}/replies`,
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

/** 导出派单 GET /api/modules/crm/v1/admin/dispatches/export */
export async function crmExportDispatches(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmExportDispatchesParams,
  options?: { [key: string]: any }
) {
  return request<any>("/api/modules/crm/v1/admin/dispatches/export", {
    method: "GET",
    params: {
      // page has a default value: 1
      page: "1",
      // pageSize has a default value: 10
      pageSize: "10",

      ...params,
    },
    ...(options || {}),
  });
}

/** 派单状态 GET /api/modules/crm/v1/admin/dispatches/statuses */
export async function crmListDispatchStatuses(options?: {
  [key: string]: any;
}) {
  return request<any>("/api/modules/crm/v1/admin/dispatches/statuses", {
    method: "GET",
    ...(options || {}),
  });
}
