import { request, requestPaginated } from "../client";

export interface SaveAdminMenu {
  name: string;
  type?: 0 | 1 | 2;
  parentId?: number;
  path?: string;
  icon?: string;
  component?: string;
  status?: "0" | "1";
  sort_order?: number;
  hideInMenu?: boolean;
  isDefaultAction?: boolean;
  isExternalLink?: boolean;
  permissionCodes?: string[];
  keepAlive?: boolean;
}
export interface AdminMenu extends SaveAdminMenu {
  id: number;
  type: 0 | 1 | 2;
  status: "0" | "1";
  sort_order: number;
  permissionCodes: string[];
  createdAt: string;
  updatedAt: string;
  children?: AdminMenu[] | null;
}
export interface AdminPermission {
  code: string;
  label: string;
  group: string;
  description?: string;
}
export function listAdminMenus(
  query: {
    page?: number;
    pageSize?: number;
    keyword?: string;
    status?: "0" | "1";
    type?: 0 | 1 | 2;
  } = {},
) {
  return requestPaginated<AdminMenu[]>({ method: "GET", path: "/api/v1/admin/menus", query });
}
export function getAdminMenuTree() {
  return request<AdminMenu[]>({ method: "GET", path: "/api/v1/admin/menus/tree" });
}
export function getAdminMenu(id: number) {
  return request<AdminMenu>({ method: "GET", path: `/api/v1/admin/menus/${id}` });
}
export function createAdminMenu(data: SaveAdminMenu) {
  return request<AdminMenu>({ method: "POST", path: "/api/v1/admin/menus", data });
}
export function updateAdminMenu(id: number, data: Partial<SaveAdminMenu>) {
  return request<AdminMenu>({ method: "PUT", path: `/api/v1/admin/menus/${id}`, data });
}
export function deleteAdminMenu(id: number) {
  return request<{ id: number }>({ method: "DELETE", path: `/api/v1/admin/menus/${id}` });
}
export function getAdminPermissionCatalog() {
  return request<AdminPermission[]>({ method: "GET", path: "/api/v1/admin/permissions/catalog" });
}
