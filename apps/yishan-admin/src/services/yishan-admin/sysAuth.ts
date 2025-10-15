// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 用户登录 使用用户名/邮箱和密码进行用户登录 POST /api/v1/auth/login */
export async function postAuthLogin(
  body: API.sysUserLoginRequest,
  options?: { [key: string]: any }
) {
  return request<{
    code?: number;
    message?: string;
    isSuccess?: boolean;
    data?: API.sysUserTokenResponse;
  }>("/api/v1/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 用户登出 用户退出登录状态 POST /api/v1/auth/logout */
export async function userLogout(options?: { [key: string]: any }) {
  return request<{
    code?: number;
    message?: string;
    isSuccess?: boolean;
    data?: null;
  }>("/api/v1/auth/logout", {
    method: "POST",
    ...(options || {}),
  });
}

/** 获取当前用户信息 获取当前登录用户的详细信息 GET /api/v1/auth/me */
export async function getCurrentUser(options?: { [key: string]: any }) {
  return request<{
    code?: number;
    message?: string;
    isSuccess?: boolean;
    data?: API.sysUser;
  }>("/api/v1/auth/me", {
    method: "GET",
    ...(options || {}),
  });
}

/** 刷新访问令牌 使用refreshToken获取新的accessToken和refreshToken POST /api/v1/auth/refresh */
export async function postAuthRefresh(
  body: API.sysUserRefreshTokenRequest,
  options?: { [key: string]: any }
) {
  return request<{
    code?: number;
    message?: string;
    isSuccess?: boolean;
    data?: API.sysUserTokenResponse;
  }>("/api/v1/auth/refresh", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}
