// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 移动端根 返回移动端基座的基本信息 GET /api/v1/app/ */
export async function appRoot(options?: { [key: string]: any }) {
  return request<{
    success?: boolean;
    code?: number;
    message?: string;
    data?: { name?: string; version?: string; time?: string };
    timestamp?: string;
  }>("/api/v1/app/", {
    method: "GET",
    ...(options || {}),
  });
}
