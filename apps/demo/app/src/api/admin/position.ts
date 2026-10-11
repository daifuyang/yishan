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

export interface SaveAdminPosition {
  name: string;
  status?: "0" | "1";
  sort_order?: number;
  description?: string;
}

export function listAdminPositions(
  query: { page?: number; pageSize?: number; keyword?: string; status?: "0" | "1" } = {},
) {
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
