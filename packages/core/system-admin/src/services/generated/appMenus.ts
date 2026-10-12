// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 获取已授权菜单树 返回当前用户可见的工作台分组与应用入口（独立于 Web 菜单），已按角色授权、模块启用状态过滤 GET /api/v1/app/menus/authorized */
export async function appGetAuthorizedMenuTree(options?: {
  [key: string]: any;
}) {
  return request<SystemAPI.appMenuTreeResp>("/api/v1/app/menus/authorized", {
    method: "GET",
    ...(options || {}),
  });
}

/** 获取已授权菜单（扁平） 当前用户可见的工作台节点扁平列表（分组在前，入口随后，保持树的先序顺序） GET /api/v1/app/menus/flatten */
export async function appGetAuthorizedMenuFlat(options?: {
  [key: string]: any;
}) {
  return request<{
    success?: boolean;
    code?: number;
    message?: string;
    data?: SystemAPI.appMenuNode[];
    timestamp?: string;
  }>("/api/v1/app/menus/flatten", {
    method: "GET",
    ...(options || {}),
  });
}
