/**
 * 系统管理 - 角色管理 API
 * 后端路径：/api/v1/admin/roles
 */
import { request, requestPaginated } from "../client";
import type { AdminRole, AdminRoleListQuery } from "./types";

export interface AdminRoleDetail extends AdminRole {
  appMenuIds?: number[];
  permissionCodes?: string[];
}

export interface SaveAdminRole {
  name: string;
  description?: string;
  status?: "0" | "1";
  dataScope?: AdminRole["dataScope"];
  menuIds?: number[];
  appMenuIds?: number[];
  permissionCodes?: string[];
}

/** 角色列表（带分页） */
export function listAdminRoles(query: AdminRoleListQuery = {}) {
  return requestPaginated<AdminRole[]>({
    method: "GET",
    path: "/api/v1/admin/roles",
    query,
  });
}

/** 角色详情 */
export function getAdminRole(id: number) {
  return request<AdminRoleDetail>({
    method: "GET",
    path: `/api/v1/admin/roles/${id}`,
  });
}

/** 创建角色 */
export function createAdminRole(data: SaveAdminRole) {
  return request<AdminRoleDetail>({
    method: "POST",
    path: "/api/v1/admin/roles",
    data,
  });
}

/** 更新角色 */
export function updateAdminRole(id: number, data: Partial<SaveAdminRole>) {
  return request<AdminRoleDetail>({
    method: "PUT",
    path: `/api/v1/admin/roles/${id}`,
    data,
  });
}

/** 删除角色 */
export function deleteAdminRole(id: number) {
  return request<{ id: number }>({
    method: "DELETE",
    path: `/api/v1/admin/roles/${id}`,
  });
}
