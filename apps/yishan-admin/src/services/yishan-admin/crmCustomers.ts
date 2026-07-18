// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 客户列表 GET /api/modules/crm/v1/admin/customers/ */
export async function crmListCustomers(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmListCustomersParams,
  options?: { [key: string]: any }
) {
  return request<any>("/api/modules/crm/v1/admin/customers/", {
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

/** 创建客户 POST /api/modules/crm/v1/admin/customers/ */
export async function crmCreateCustomer(
  body: API.crmCustomerReq,
  options?: { [key: string]: any }
) {
  return request<any>("/api/modules/crm/v1/admin/customers/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 客户详情 GET /api/modules/crm/v1/admin/customers/${param0} */
export async function crmGetCustomer(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmGetCustomerParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/modules/crm/v1/admin/customers/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 更新客户 PUT /api/modules/crm/v1/admin/customers/${param0} */
export async function crmUpdateCustomer(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmUpdateCustomerParams,
  body: API.crmCustomerUpdateReq,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/modules/crm/v1/admin/customers/${param0}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 客户派单 POST /api/modules/crm/v1/admin/customers/${param0}/dispatch */
export async function crmDispatchCustomer(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmDispatchCustomerParams,
  body: API.crmDispatchCreateReq,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(
    `/api/modules/crm/v1/admin/customers/${param0}/dispatch`,
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

/** 客户状态 GET /api/modules/crm/v1/admin/customers/statuses */
export async function crmListCustomerStatuses(options?: {
  [key: string]: any;
}) {
  return request<any>("/api/modules/crm/v1/admin/customers/statuses", {
    method: "GET",
    ...(options || {}),
  });
}
