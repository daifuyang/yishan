/**
 * Token管理工具
 * 用于管理JWT token的存储、获取、验证和刷新
 */

// Token存储的键名
export const TOKEN_KEYS = {
  ACCESS_TOKEN: "accessToken",
  REFRESH_TOKEN: "refreshToken",
  ACCESS_TOKEN_EXPIRY: "accessTokenExpiry",
  REFRESH_TOKEN_EXPIRY: "refreshTokenExpiry",
  TOKEN_TYPE: "tokenType",
} as const;

/**
 * 保存token到本地存储
 */
export const saveTokens = (data: {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn?: number;
  refreshTokenExpiresIn?: number;
  tokenType?: string;
}) => {
  const {
    accessToken,
    refreshToken,
    accessTokenExpiresIn = 900, // 默认15分钟
    refreshTokenExpiresIn = 604800, // 默认7天
    tokenType = "Bearer",
  } = data;

  const now = Math.floor(Date.now() / 1000);

  localStorage.setItem(TOKEN_KEYS.ACCESS_TOKEN, accessToken);
  localStorage.setItem(TOKEN_KEYS.REFRESH_TOKEN, refreshToken);
  localStorage.setItem(
    TOKEN_KEYS.ACCESS_TOKEN_EXPIRY,
    String(now + accessTokenExpiresIn)
  );
  localStorage.setItem(
    TOKEN_KEYS.REFRESH_TOKEN_EXPIRY,
    String(now + refreshTokenExpiresIn)
  );
  localStorage.setItem(TOKEN_KEYS.TOKEN_TYPE, tokenType);
};

/**
 * 获取access token
 */
export const getAccessToken = (): string | null => {
  return localStorage.getItem(TOKEN_KEYS.ACCESS_TOKEN);
};

/**
 * 获取refresh token
 */
export const getRefreshToken = (): string | null => {
  return localStorage.getItem(TOKEN_KEYS.REFRESH_TOKEN);
};

/**
 * 获取token类型
 */
export const getTokenType = (): string => {
  return localStorage.getItem(TOKEN_KEYS.TOKEN_TYPE) || "Bearer";
};

/**
 * 检查access token是否过期
 */
export const isAccessTokenExpired = (): boolean => {
  const expiry = localStorage.getItem(TOKEN_KEYS.ACCESS_TOKEN_EXPIRY);
  if (!expiry) return true;

  const now = Math.floor(Date.now() / 1000);
  return now >= parseInt(expiry, 10);
};

/**
 * 检查refresh token是否过期
 */
export const isRefreshTokenExpired = (): boolean => {
  const expiry = localStorage.getItem(TOKEN_KEYS.REFRESH_TOKEN_EXPIRY);
  if (!expiry) return true;

  const now = Math.floor(Date.now() / 1000);
  return now >= parseInt(expiry, 10);
};

/**
 * 清除所有token
 */
export const clearTokens = (): void => {
  Object.values(TOKEN_KEYS).forEach((key) => {
    localStorage.removeItem(key);
  });
};

/**
 * 获取Authorization头
 */
export const getAuthorizationHeader = (): string | null => {
  const token = getAccessToken();
  const tokenType = getTokenType();

  if (!token) return null;
  return `${tokenType} ${token}`;
};

/**
 * 构建Authorization头对象
 */
export const getAuthHeaders = (): Record<string, string> => {
  const authHeader = getAuthorizationHeader();
  return authHeader ? { Authorization: authHeader } : {};
};

/**
 * 检查用户是否已登录
 */
export const isLoggedIn = (): boolean => {
  const accessToken = getAccessToken();
  const refreshToken = getRefreshToken();

  return !!(accessToken && refreshToken && !isRefreshTokenExpired());
};
