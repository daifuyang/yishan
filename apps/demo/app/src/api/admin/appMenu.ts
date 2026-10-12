import { request } from "../client";

export interface SaveAdminAppMenu {
  name: string;
  type?: 0 | 1;
  parentId?: number;
  icon?: string;
  page?: string;
  moduleId?: string;
  sortOrder?: number;
  status?: "0" | "1";
}
export interface AdminAppMenu extends SaveAdminAppMenu {
  id: number;
  type: 0 | 1;
  status: "0" | "1";
  moduleId: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  children?: AdminAppMenu[] | null;
}
export function getAdminAppMenuTree() {
  return request<AdminAppMenu[]>({ method: "GET", path: "/api/v1/admin/app-menus/tree" });
}
export function getAdminAppMenu(id: number) {
  return request<AdminAppMenu>({ method: "GET", path: `/api/v1/admin/app-menus/${id}` });
}
export function createAdminAppMenu(data: SaveAdminAppMenu) {
  return request<AdminAppMenu>({ method: "POST", path: "/api/v1/admin/app-menus", data });
}
export function updateAdminAppMenu(id: number, data: Partial<SaveAdminAppMenu>) {
  return request<AdminAppMenu>({ method: "PUT", path: `/api/v1/admin/app-menus/${id}`, data });
}
export function deleteAdminAppMenu(id: number) {
  return request<{ id: number }>({ method: "DELETE", path: `/api/v1/admin/app-menus/${id}` });
}
export function reorderAdminAppMenus(data: { parentId?: number; orderedIds: number[] }) {
  return request<{ count: number }>({
    method: "POST",
    path: "/api/v1/admin/app-menus/reorder",
    data,
  });
}
