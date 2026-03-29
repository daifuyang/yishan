// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** Hello 模块健康检查 提供模块可用性检测端点 GET /api/modules/hello/api/v1/admin/ */
export async function getHelloAdminHealth(options?: { [key: string]: any }) {
  return request<{
    code: number;
    message: string;
    success: boolean;
    data: { module: string; status: string; time: string };
    timestamp: string;
  }>("/api/modules/hello/api/v1/admin/", {
    method: "GET",
    ...(options || {}),
  });
}

/** Hello 模块鉴权示例 演示带鉴权的模块端点规范 GET /api/modules/hello/api/v1/admin/me/ */
export async function getHelloCurrentUser(options?: { [key: string]: any }) {
  return request<{
    code: number;
    message: string;
    success: boolean;
    data: {
      userId: number;
      username: string;
      module: string;
      permission: string;
    };
    timestamp: string;
  }>("/api/modules/hello/api/v1/admin/me/", {
    method: "GET",
    ...(options || {}),
  });
}

/** Hello 模块回显示例 演示带请求体校验和鉴权的模块端点 POST /api/modules/hello/api/v1/echo */
export async function postHelloEcho(
  body: {
    message: string;
  },
  options?: { [key: string]: any }
) {
  return request<{
    code: number;
    message: string;
    success: boolean;
    data: { echo: string; by: string; module: string };
    timestamp: string;
  }>("/api/modules/hello/api/v1/echo", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** Hello 模块健康检查 提供模块可用性检测端点 GET /api/modules/hello/api/v1/ping */
export async function getHelloPublicPing(options?: { [key: string]: any }) {
  return request<{
    code: number;
    message: string;
    success: boolean;
    data: { module: string; status: string; time: string };
    timestamp: string;
  }>("/api/modules/hello/api/v1/ping", {
    method: "GET",
    ...(options || {}),
  });
}
