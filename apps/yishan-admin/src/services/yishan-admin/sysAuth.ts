// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 获取当前用户信息 获取当前登录用户的详细信息 GET /api/v1/getCurrentUser */
export async function getCurrentUser(options?: { [key: string]: any }) {
  return request<{
    code?: number;
    message?: string;
    data?: API.sysUser;
    success?: boolean;
    timestamp?: string;
  }>("/api/v1/getCurrentUser", {
    method: "GET",
    ...(options || {}),
  });
}

/** 用户登录 用户登录接口 POST /api/v1/login */
export async function userLogin(
  body: {
    /** 用户名 */
    username?: string;
    /** 邮箱 */
    email?: string;
    /** 密码 */
    password: string;
  },
  options?: { [key: string]: any }
) {
  return request<{
    code?: number;
    message?: string;
    data?: API.sysUserTokenResponse;
    success?: boolean;
    timestamp?: string;
  }>("/api/v1/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 用户登出 用户登出接口 POST /api/v1/logout */
export async function userLogout(options?: { [key: string]: any }) {
  return request<{
    code?: number;
    message?: string;
    data?: null;
    success?: boolean;
    timestamp?: string;
  }>("/api/v1/logout", {
    method: "POST",
    ...(options || {}),
  });
}

/** 刷新访问令牌 使用刷新令牌获取新的访问令牌 POST /api/v1/refresh */
export async function refreshToken(
  body: API.sysUserRefreshTokenRequest,
  options?: { [key: string]: any }
) {
  return request<{
    code?: number;
    message?: string;
    data?: API.sysUserTokenResponse;
    success?: boolean;
    timestamp?: string;
  }>("/api/v1/refresh", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}
