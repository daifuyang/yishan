// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 获取部门列表 获取部门列表，支持分页和筛选 GET /api/v1/admin/departments/ */
export async function getDepartmentList(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getDepartmentListParams,
  options?: { [key: string]: any }
) {
  return request<{
    code?: number;
    message?: string;
    data?: API.sysDepartmentListResponse;
  }>("/api/v1/admin/departments/", {
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

/** 创建部门 创建新的部门 POST /api/v1/admin/departments/ */
export async function createDepartment(
  body: API.sysDepartmentCreateRequest,
  options?: { [key: string]: any }
) {
  return request<{ code?: number; message?: string; data?: API.sysDepartment }>(
    "/api/v1/admin/departments/",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      data: body,
      ...(options || {}),
    }
  );
}

/** 获取部门详情 根据ID获取部门详细信息 GET /api/v1/admin/departments/${param0} */
export async function getAdminDepartmentsId(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getAdminDepartmentsIdParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{ code?: number; message?: string; data?: API.sysDepartment }>(
    `/api/v1/admin/departments/${param0}`,
    {
      method: "GET",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 更新部门信息 根据ID更新部门信息 PUT /api/v1/admin/departments/${param0} */
export async function putAdminDepartmentsId(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.putAdminDepartmentsIdParams,
  body: API.sysDepartmentUpdateRequest,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{ code?: number; message?: string; data?: API.sysDepartment }>(
    `/api/v1/admin/departments/${param0}`,
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

/** 删除部门 软删除部门 DELETE /api/v1/admin/departments/${param0} */
export async function deleteAdminDepartmentsId(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.deleteAdminDepartmentsIdParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{
    code?: number;
    message?: string;
    data?: { success?: boolean };
  }>(`/api/v1/admin/departments/${param0}`, {
    method: "DELETE",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 更新部门状态 启用或禁用部门 PUT /api/v1/admin/departments/${param0}/status */
export async function putAdminDepartmentsIdStatus(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.putAdminDepartmentsIdStatusParams,
  body: {
    status: 0 | 1;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<{ code?: number; message?: string; data?: API.sysDepartment }>(
    `/api/v1/admin/departments/${param0}/status`,
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

/** 获取部门树结构 获取完整的部门树结构 GET /api/v1/admin/departments/tree */
export async function getDepartmentTree(options?: { [key: string]: any }) {
  return request<{
    code?: number;
    message?: string;
    data?: API.sysDepartmentTreeResponse;
  }>("/api/v1/admin/departments/tree", {
    method: "GET",
    ...(options || {}),
  });
}
