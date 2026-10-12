// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 获取仪表盘统计 获取管理员仪表盘统计数据（用户总数、部门总数、今日登录次数、在线用户数） GET /api/v1/app/dashboard/stats */
export async function appDashboardStats2(options?: { [key: string]: any }) {
  return request<{
    code: number;
    message: string;
    success: boolean;
    data: {
      userTotal: number;
      deptTotal: number;
      todayLogin: number;
      online: number;
    };
    timestamp: string;
  }>("/api/v1/app/dashboard/stats", {
    method: "GET",
    ...(options || {}),
  });
}

/** 获取仪表盘统计 获取管理员仪表盘统计数据（用户总数、部门总数、今日登录次数、在线用户数） GET /api/v1/app/stats */
export async function appDashboardStats(options?: { [key: string]: any }) {
  return request<{
    code: number;
    message: string;
    success: boolean;
    data: {
      userTotal: number;
      deptTotal: number;
      todayLogin: number;
      online: number;
    };
    timestamp: string;
  }>("/api/v1/app/stats", {
    method: "GET",
    ...(options || {}),
  });
}
