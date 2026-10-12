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

/** 获取首页常用应用 pinned 为用户固定的入口（用户顺序），ranked 为其余已授权入口按使用习惯排序；均为工作台入口 ID GET /api/v1/app/menus/home */
export async function appGetHomeApps(options?: { [key: string]: any }) {
  return request<SystemAPI.appHomeAppsResp>("/api/v1/app/menus/home", {
    method: "GET",
    ...(options || {}),
  });
}

/** 保存首页固定应用 按数组顺序整体覆盖当前用户固定的入口；不可用的入口被丢弃，最多 8 个 PUT /api/v1/app/menus/pins */
export async function appSaveHomePins(
  body: SystemAPI.saveAppHomePinsReq,
  options?: { [key: string]: any }
) {
  return request<SystemAPI.appHomeAppsResp>("/api/v1/app/menus/pins", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 记录应用打开 累加当前用户对某个工作台入口的打开次数；入口不可用时不记录 POST /api/v1/app/menus/usage */
export async function appReportAppUsage(
  body: SystemAPI.reportAppUsageReq,
  options?: { [key: string]: any }
) {
  return request<SystemAPI.reportAppUsageResp>("/api/v1/app/menus/usage", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}
