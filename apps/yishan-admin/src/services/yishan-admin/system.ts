// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 清理状态查询 查询Token清理服务的状态信息 GET /api/v1/system/cleanup/status */
export async function getCleanupStatus(options?: { [key: string]: any }) {
  return request<{
    code?: number;
    message?: string;
    data?: {
      serviceType?: string;
      environment?: string;
      lastCleanupTime?: string;
      totalTokens?: number;
      expiredTokens?: number;
      revokedTokens?: number;
    };
  }>("/api/v1/system/cleanup/status", {
    method: "GET",
    ...(options || {}),
  });
}

/** Token清理 清理过期的用户认证Token，通过外部中间件触发执行 POST /api/v1/system/cleanup/tokens */
export async function cleanupTokens(options?: { [key: string]: any }) {
  return request<{
    code?: number;
    message?: string;
    data?: {
      deletedCount?: number;
      executionTime?: string;
      timestamp?: string;
    };
  }>("/api/v1/system/cleanup/tokens", {
    method: "POST",
    ...(options || {}),
  });
}
