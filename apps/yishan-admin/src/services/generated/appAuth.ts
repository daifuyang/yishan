// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 移动端登录 移动端通过用户名/邮箱和密码登录 POST /api/v1/app/auth/login */
export async function appLogin(
  body: API.loginReq,
  options?: { [key: string]: any }
) {
  return request<API.loginResp>("/api/v1/app/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 移动端登出 撤销当前用户的访问令牌 POST /api/v1/app/auth/logout */
export async function appLogout(options?: { [key: string]: any }) {
  return request<{
    success?: boolean;
    code?: number;
    message?: string;
    timestamp?: string;
  }>("/api/v1/app/auth/logout", {
    method: "POST",
    ...(options || {}),
  });
}

/** 获取当前用户信息 获取当前登录用户的详细信息及已授权菜单路径 GET /api/v1/app/auth/me */
export async function appGetCurrentUser(options?: { [key: string]: any }) {
  return request<API.currentUserResp>("/api/v1/app/auth/me", {
    method: "GET",
    ...(options || {}),
  });
}

/** 移动端刷新令牌 使用 refreshToken 换取新的访问令牌 POST /api/v1/app/auth/refresh */
export async function appRefreshToken(
  body: API.refreshTokenReq,
  options?: { [key: string]: any }
) {
  return request<API.refreshTokenResp>("/api/v1/app/auth/refresh", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}
