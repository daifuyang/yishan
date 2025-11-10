// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 获取部门列表 分页获取部门列表，支持关键词、状态、上级部门过滤 GET /api/v1/admin/departments/ */
export async function getDeptList(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getDeptListParams,
  options?: { [key: string]: any }
) {
  return request<API.deptListResp>("/api/v1/admin/departments/", {
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

/** 创建部门 创建一个新的部门 POST /api/v1/admin/departments/ */
export async function createDept(
  body: API.createDeptReq,
  options?: { [key: string]: any }
) {
  return request<API.deptDetailResp>("/api/v1/admin/departments/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 获取部门详情 根据部门ID获取部门详情 GET /api/v1/admin/departments/${param0} */
export async function getDeptDetail(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getDeptDetailParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.deptDetailResp>(`/api/v1/admin/departments/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 更新部门 根据部门ID更新部门信息 PUT /api/v1/admin/departments/${param0} */
export async function updateDept(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.updateDeptParams,
  body: API.updateDeptReq,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.deptDetailResp>(`/api/v1/admin/departments/${param0}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 删除部门 根据部门ID进行软删除，存在子部门禁止删除 DELETE /api/v1/admin/departments/${param0} */
export async function deleteDept(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.deleteDeptParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.deptDeleteResp>(`/api/v1/admin/departments/${param0}`, {
    method: "DELETE",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 获取部门树 返回部门树形结构（按 sort_order 排序） GET /api/v1/admin/departments/tree */
export async function getDeptTree(options?: { [key: string]: any }) {
  return request<API.deptTreeResp>("/api/v1/admin/departments/tree", {
    method: "GET",
    ...(options || {}),
  });
}
