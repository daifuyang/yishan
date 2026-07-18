// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 医院列表 GET /api/modules/crm/v1/admin/hospitals/ */
export async function crmListHospitals(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmListHospitalsParams,
  options?: { [key: string]: any }
) {
  return request<any>("/api/modules/crm/v1/admin/hospitals/", {
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

/** 创建医院 POST /api/modules/crm/v1/admin/hospitals/ */
export async function crmCreateHospital(
  body: API.crmHospitalReq,
  options?: { [key: string]: any }
) {
  return request<any>("/api/modules/crm/v1/admin/hospitals/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 医院详情 GET /api/modules/crm/v1/admin/hospitals/${param0} */
export async function crmGetHospital(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmGetHospitalParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/modules/crm/v1/admin/hospitals/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 更新医院 PUT /api/modules/crm/v1/admin/hospitals/${param0} */
export async function crmUpdateHospital(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmUpdateHospitalParams,
  body: API.crmHospitalUpdateReq,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/modules/crm/v1/admin/hospitals/${param0}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 删除医院 DELETE /api/modules/crm/v1/admin/hospitals/${param0} */
export async function crmDeleteHospital(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmDeleteHospitalParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/modules/crm/v1/admin/hospitals/${param0}`, {
    method: "DELETE",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 获取医院账号列表 GET /api/modules/crm/v1/admin/hospitals/${param0}/accounts */
export async function crmListHospitalAccounts(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmListHospitalAccountsParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(
    `/api/modules/crm/v1/admin/hospitals/${param0}/accounts`,
    {
      method: "GET",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 新建账号并分配 POST /api/modules/crm/v1/admin/hospitals/${param0}/accounts */
export async function crmCreateHospitalAccount(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmCreateHospitalAccountParams,
  body: API.crmHospitalAccountCreateReq,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(
    `/api/modules/crm/v1/admin/hospitals/${param0}/accounts`,
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

/** 更新医院内身份 PUT /api/modules/crm/v1/admin/hospitals/${param0}/accounts/${param1} */
export async function crmUpdateHospitalAccount(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmUpdateHospitalAccountParams,
  body: API.crmHospitalAccountUpdateReq,
  options?: { [key: string]: any }
) {
  const { id: param0, userId: param1, ...queryParams } = params;
  return request<any>(
    `/api/modules/crm/v1/admin/hospitals/${param0}/accounts/${param1}`,
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

/** 解除分配 DELETE /api/modules/crm/v1/admin/hospitals/${param0}/accounts/${param1} */
export async function crmDeleteHospitalAccount(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmDeleteHospitalAccountParams,
  options?: { [key: string]: any }
) {
  const { id: param0, userId: param1, ...queryParams } = params;
  return request<any>(
    `/api/modules/crm/v1/admin/hospitals/${param0}/accounts/${param1}`,
    {
      method: "DELETE",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 分配已有账号 POST /api/modules/crm/v1/admin/hospitals/${param0}/accounts/assign */
export async function crmAssignHospitalAccount(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmAssignHospitalAccountParams,
  body: API.crmHospitalAccountAssignReq,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(
    `/api/modules/crm/v1/admin/hospitals/${param0}/accounts/assign`,
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

/** 医院搜索 GET /api/modules/crm/v1/admin/hospitals/search/options */
export async function crmSearchHospitals(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmSearchHospitalsParams,
  options?: { [key: string]: any }
) {
  return request<any>("/api/modules/crm/v1/admin/hospitals/search/options", {
    method: "GET",
    params: {
      ...params,
    },
    ...(options || {}),
  });
}
