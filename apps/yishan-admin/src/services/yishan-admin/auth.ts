// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 用户登录 用户通过用户名/邮箱和密码进行登录认证 POST /api/v1/auth/login */
export async function login(
  body: API.loginReq,
  options?: { [key: string]: any }
) {
  return request<API.loginResp>("/api/v1/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 用户登出 用户登出，清除认证状态 POST /api/v1/auth/logout */
export async function logout(options?: { [key: string]: any }) {
  return request<{
    success?: boolean;
    code?: number;
    message?: string;
    timestamp?: string;
  }>("/api/v1/auth/logout", {
    method: "POST",
    ...(options || {}),
  });
}

/** 获取当前用户信息 获取当前登录用户的详细信息 GET /api/v1/auth/me */
export async function getCurrentUser(options?: { [key: string]: any }) {
  return request<API.userProfileResp>("/api/v1/auth/me", {
    method: "GET",
    ...(options || {}),
  });
}

/** 刷新访问令牌 使用刷新令牌获取新的访问令牌和刷新令牌 POST /api/v1/auth/refresh */
export async function refreshToken(
  body: API.refreshTokenReq,
  options?: { [key: string]: any }
) {
  return request<API.refreshTokenResp>("/api/v1/auth/refresh", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}
