// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 获取已授权菜单树 根据当前用户角色并集返回授权菜单树，移动端用于渲染应用 Tab GET /api/v1/app/menus/authorized */
export async function appGetAuthorizedMenuTree(options?: {
  [key: string]: any;
}) {
  return request<API.menuTreeResp>("/api/v1/app/menus/authorized", {
    method: "GET",
    ...(options || {}),
  });
}

/** 获取已授权菜单（扁平） 根据当前用户角色并集返回授权菜单扁平列表，包含完整字段（icon, path, perm 等） GET /api/v1/app/menus/flatten */
export async function appGetAuthorizedMenuFlat(options?: {
  [key: string]: any;
}) {
  return request<{
    success?: boolean;
    code?: number;
    message?: string;
    data?: API.menuTreeNode[];
    timestamp?: string;
  }>("/api/v1/app/menus/flatten", {
    method: "GET",
    ...(options || {}),
  });
}
