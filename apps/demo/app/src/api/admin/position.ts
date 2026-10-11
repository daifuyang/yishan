import { request, requestPaginated } from "../client";

export interface AdminPosition {
  id: number;
  name: string;
  status: "0" | "1";
  sort_order: number;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminPositionListQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  status?: "0" | "1";
  /** sortOrder 为岗位自定义排序号，createdAt/updatedAt 为时间字段 */
  sortBy?: "sortOrder" | "createdAt" | "updatedAt";
  sortOrder?: "asc" | "desc";
  [key: string]: unknown;
}

export interface SaveAdminPosition {
  name: string;
  status?: "0" | "1";
  sort_order?: number;
  description?: string;
}

export function listAdminPositions(query: AdminPositionListQuery = {}) {
  return requestPaginated<AdminPosition[]>({
    method: "GET",
    path: "/api/v1/admin/positions",
    query,
  });
}
export function getAdminPosition(id: number) {
  return request<AdminPosition>({ method: "GET", path: `/api/v1/admin/positions/${id}` });
}
export function createAdminPosition(data: SaveAdminPosition) {
  return request<AdminPosition>({ method: "POST", path: "/api/v1/admin/positions", data });
}
export function updateAdminPosition(id: number, data: Partial<SaveAdminPosition>) {
  return request<AdminPosition>({ method: "PUT", path: `/api/v1/admin/positions/${id}`, data });
}
export function deleteAdminPosition(id: number) {
  return request<{ id: number }>({ method: "DELETE", path: `/api/v1/admin/positions/${id}` });
}
