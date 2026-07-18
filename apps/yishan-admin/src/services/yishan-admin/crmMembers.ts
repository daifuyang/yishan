// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 会员列表 GET /api/modules/crm/v1/admin/members/ */
export async function crmListMembers(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmListMembersParams,
  options?: { [key: string]: any }
) {
  return request<any>("/api/modules/crm/v1/admin/members/", {
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

/** 创建会员 POST /api/modules/crm/v1/admin/members/ */
export async function crmCreateMember(
  body: API.crmMemberReq,
  options?: { [key: string]: any }
) {
  return request<any>("/api/modules/crm/v1/admin/members/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 会员详情 GET /api/modules/crm/v1/admin/members/${param0} */
export async function crmGetMember(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmGetMemberParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/modules/crm/v1/admin/members/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 更新会员 PUT /api/modules/crm/v1/admin/members/${param0} */
export async function crmUpdateMember(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmUpdateMemberParams,
  body: API.crmMemberUpdateReq,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/modules/crm/v1/admin/members/${param0}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 添加会员备注 POST /api/modules/crm/v1/admin/members/${param0}/remarks */
export async function crmAddMemberRemark(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmAddMemberRemarkParams,
  body: API.crmContentReq,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/modules/crm/v1/admin/members/${param0}/remarks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}
