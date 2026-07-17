/**
 * Token 管理工具
 *
 * 迁移说明：access/refresh token 已改为由后端以 HttpOnly + SameSite + Secure 的
 * cookie（yishan_at / yishan_rt）下发与存储。前端不再把 token 写入 localStorage，
 * 浏览器会在同源（或已配置 credentials 的跨域）请求中自动携带这些 cookie。
 *
 * 注意：HttpOnly cookie 无法被 JS（document.cookie）读取，这是安全设计的一部分。
 * 因此 getAccessToken() / getRefreshToken() 在浏览器中通常返回 null——真正的鉴权
 * 由浏览器自动携带 cookie + 后端校验完成，前端无需也无法直接读取 token 值。
 */

// 认证 cookie 名称（与后端保持一致）
export const AUTH_COOKIE_NAMES = {
  ACCESS_TOKEN: "yishan_at",
  REFRESH_TOKEN: "yishan_rt",
} as const;

// 历史遗留的 localStorage 键名，仅用于清理旧数据（不再写入）
export const TOKEN_KEYS = {
  ACCESS_TOKEN: "accessToken",
  REFRESH_TOKEN: "refreshToken",
  ACCESS_TOKEN_EXPIRY: "accessTokenExpiry",
  REFRESH_TOKEN_EXPIRY: "refreshTokenExpiry",
  TOKEN_TYPE: "tokenType",
} as const;

/**
 * 读取 cookie（仅能读取非 HttpOnly cookie）
 */
export const getCookie = (name: string): string | null => {
  if (typeof document === "undefined" || !document.cookie) return null;
  const prefix = `${name}=`;
  const segments = document.cookie.split(";");
  for (const segment of segments) {
    const trimmed = segment.trim();
    if (trimmed.startsWith(prefix)) {
      return decodeURIComponent(trimmed.slice(prefix.length));
    }
  }
  return null;
};

/**
 * 保存 token —— 兼容保留的空实现。
 *
 * token 现在由后端通过 Set-Cookie 响应头写入 HttpOnly cookie，前端无需存储。
 * 保留该函数签名以兼容调用方（登录 / 刷新流程）。
 */
export const saveTokens = (_data: {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn?: number;
  refreshTokenExpiresIn?: number;
  tokenType?: string;
}) => {
  // no-op：认证 cookie 由后端下发。
};

/**
 * 获取 access token（从 cookie 读取；HttpOnly 场景下返回 null）
 */
export const getAccessToken = (): string | null => {
  return getCookie(AUTH_COOKIE_NAMES.ACCESS_TOKEN);
};

/**
 * 获取 refresh token（从 cookie 读取；HttpOnly 场景下返回 null）
 */
export const getRefreshToken = (): string | null => {
  return getCookie(AUTH_COOKIE_NAMES.REFRESH_TOKEN);
};

/**
 * 获取 token 类型
 */
export const getTokenType = (): string => {
  return "Bearer";
};

/**
 * 检查 access token 是否过期。
 * HttpOnly cookie 无法读取过期时间，鉴权状态以后端 401 为准，这里返回 false（不主动判定过期）。
 */
export const isAccessTokenExpired = (): boolean => {
  return false;
};

/**
 * 检查 refresh token 是否过期。
 * 同上，交由后端 /auth/refresh 的响应判定，这里返回 false。
 */
export const isRefreshTokenExpired = (): boolean => {
  return false;
};

/**
 * 清除本地遗留的 token 数据。
 * 认证 cookie 由后端在登出接口中清除，这里仅清理历史 localStorage 残留。
 */
export const clearTokens = (): void => {
  Object.values(TOKEN_KEYS).forEach((key) => {
    localStorage.removeItem(key);
  });
};

/**
 * 获取 Authorization 头。
 * 浏览器场景下 token 存于 HttpOnly cookie（不可读），返回 null，请求改由 cookie 自动携带。
 * 保留该逻辑以兼容非浏览器场景可能可读的 token。
 */
export const getAuthorizationHeader = (): string | null => {
  const token = getAccessToken();
  if (!token) return null;
  return `${getTokenType()} ${token}`;
};

/**
 * 构建 Authorization 头对象
 */
export const getAuthHeaders = (): Record<string, string> => {
  const authHeader = getAuthorizationHeader();
  return authHeader ? { Authorization: authHeader } : {};
};

/**
 * 检查用户是否已登录（尽力而为）。
 * 由于认证 cookie 为 HttpOnly 不可读，前端无法可靠判定登录态，最终以后端鉴权为准。
 */
export const isLoggedIn = (): boolean => {
  return !!getAccessToken();
};
