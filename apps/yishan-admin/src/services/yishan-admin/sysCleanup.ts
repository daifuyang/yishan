// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 清理过期Token 删除数据库中已过期的访问令牌与刷新令牌记录 POST /api/v1/system/tokens/cleanup */
export async function cleanupTokens(options?: { [key: string]: any }) {
  return request<{
    code?: number;
    message?: string;
    data?: { deletedCount?: number };
  }>("/api/v1/system/tokens/cleanup", {
    method: "POST",
    ...(options || {}),
  });
}

/** Token清理健康检查 检查Token清理服务与数据库连接状态 GET /api/v1/system/tokens/health */
export async function tokenCleanupHealth(options?: { [key: string]: any }) {
  return request<{
    code?: number;
    message?: string;
    data?: {
      status?: "healthy" | "unhealthy";
      message?: string;
      timestamp?: string;
    };
  }>("/api/v1/system/tokens/health", {
    method: "GET",
    ...(options || {}),
  });
}

/** Token清理统计 查看令牌总量、已过期、已撤销数量及最近清理时间 GET /api/v1/system/tokens/stats */
export async function getTokenCleanupStats(options?: { [key: string]: any }) {
  return request<{
    code?: number;
    message?: string;
    data?: {
      totalTokens?: number;
      expiredTokens?: number;
      revokedTokens?: number;
      lastCleanupTime?: string;
    };
  }>("/api/v1/system/tokens/stats", {
    method: "GET",
    ...(options || {}),
  });
}
