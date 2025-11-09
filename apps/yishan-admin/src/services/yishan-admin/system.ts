// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 清理过期token 定时任务接口，用于清理过期的用户token，需要特殊的定时任务令牌进行鉴权 POST /api/v1/system/cleanup-tokens */
export async function cleanupTokens(
  body: API.cleanupTokensReq,
  options?: { [key: string]: any }
) {
  return request<API.cleanupTokensResp>("/api/v1/system/cleanup-tokens", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 获取token统计信息 获取系统中token的统计信息，包括总数、活跃数、过期数等 GET /api/v1/system/token-stats */
export async function getTokenStats(options?: { [key: string]: any }) {
  return request<API.tokenStatsResp>("/api/v1/system/token-stats", {
    method: "GET",
    ...(options || {}),
  });
}
