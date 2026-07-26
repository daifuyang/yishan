// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 获取部门成员（移动端） 根据部门ID返回该部门下的所有启用用户 GET /api/v1/app/contacts/depts/${param0}/users */
export async function appGetDeptUsers(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appGetDeptUsersParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    success?: boolean;
    code?: number;
    message?: string;
    data?: {
      id?: number;
      realName?: string;
      username?: string;
      phone?: string;
      email?: string;
      avatar?: string;
      gender?: string;
      genderName?: string;
    }[];
    timestamp?: string;
  }>(`/api/v1/app/contacts/depts/${param0}/users`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 获取部门树（移动端） 返回全部部门树形结构，供移动端通讯录展示 GET /api/v1/app/contacts/depts/tree */
export async function appGetDeptTree(options?: { [key: string]: any }) {
  return request<{
    success?: boolean;
    code?: number;
    message?: string;
    data?: Record<string, any>[];
    timestamp?: string;
  }>("/api/v1/app/contacts/depts/tree", {
    method: "GET",
    ...(options || {}),
  });
}
