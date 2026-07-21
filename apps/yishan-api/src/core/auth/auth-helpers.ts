/**
 * 认证 Cookie 辅助函数
 *
 * 将 access / refresh token 以 HttpOnly + SameSite=Lax（生产环境额外 Secure）
 * 的 cookie 形式下发到浏览器。cookie 是浏览器场景下的"权威源"，
 * 响应体中的 token 字段仍然保留以兼容非浏览器客户端（如 CLI）。
 */

import type { FastifyReply } from "fastify";

/** 认证 cookie 名称 */
export const AUTH_COOKIE_NAMES = {
  accessToken: "yishan_at",
  refreshToken: "yishan_rt",
} as const;

const isProduction = (): boolean => process.env.NODE_ENV === "production";

const baseCookieOptions = () => ({
  httpOnly: true,
  path: "/",
  sameSite: "lax" as const,
  secure: isProduction(),
});

/**
 * 下发 access / refresh token cookie。
 */
export function setAuthCookies(
  reply: FastifyReply,
  accessToken: string,
  refreshToken: string | undefined,
  accessExpiresInSec: number | undefined,
  refreshExpiresInSec: number | undefined,
): void {
  if (typeof reply.setCookie !== "function") return;

  reply.setCookie(AUTH_COOKIE_NAMES.accessToken, accessToken, {
    ...baseCookieOptions(),
    ...(accessExpiresInSec ? { maxAge: accessExpiresInSec } : {}),
  });

  if (refreshToken) {
    reply.setCookie(AUTH_COOKIE_NAMES.refreshToken, refreshToken, {
      ...baseCookieOptions(),
      ...(refreshExpiresInSec ? { maxAge: refreshExpiresInSec } : {}),
    });
  }
}

/**
 * 清除 access / refresh token cookie（登出时使用）。
 */
export function clearAuthCookies(reply: FastifyReply): void {
  if (typeof reply.clearCookie !== "function") return;

  reply.clearCookie(AUTH_COOKIE_NAMES.accessToken, baseCookieOptions());
  reply.clearCookie(AUTH_COOKIE_NAMES.refreshToken, baseCookieOptions());
}