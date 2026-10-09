/**
 * 认证授权业务码
 * 包含所有认证和权限相关的错误码
 */

// ============= 权限错误码 (22xxx) =============
export const AuthErrorCode = {
  /** 未授权访问 */
  UNAUTHORIZED: 22001,
  /** 权限不足 */
  FORBIDDEN: 22002,
  /** 无效的访问令牌 */
  TOKEN_INVALID: 22003,
  /** 访问令牌已过期 */
  TOKEN_EXPIRED: 22004,
  /** 刷新令牌无效 */
  REFRESH_TOKEN_INVALID: 22005,
  /** 刷新令牌已过期 */
  REFRESH_TOKEN_EXPIRED: 22006,
  /** 登录失败 */
  LOGIN_FAILED: 22007,
  /** 账号被锁定 */
  ACCOUNT_LOCKED: 22008,
  /** 需要重新登录 */
  NEED_RELOGIN: 22009,
  /** API Token不存在 */
  API_TOKEN_NOT_FOUND: 22010,
  /** API Token已过期 */
  API_TOKEN_EXPIRED: 22011,
  /** API Token已撤销 */
  API_TOKEN_REVOKED: 22012,
} as const;

// ============= 错误消息映射 =============
export const AuthErrorMessages = {
  [AuthErrorCode.UNAUTHORIZED]: '未授权访问',
  [AuthErrorCode.FORBIDDEN]: '权限不足',
  [AuthErrorCode.TOKEN_INVALID]: '无效的访问令牌',
  [AuthErrorCode.TOKEN_EXPIRED]: '访问令牌已过期',
  [AuthErrorCode.REFRESH_TOKEN_INVALID]: '刷新令牌无效',
  [AuthErrorCode.REFRESH_TOKEN_EXPIRED]: '刷新令牌已过期',
  [AuthErrorCode.LOGIN_FAILED]: '登录失败',
  [AuthErrorCode.ACCOUNT_LOCKED]: '账号被锁定',
  [AuthErrorCode.NEED_RELOGIN]: '需要重新登录',
  [AuthErrorCode.API_TOKEN_NOT_FOUND]: 'API Token不存在',
  [AuthErrorCode.API_TOKEN_EXPIRED]: 'API Token已过期',
  [AuthErrorCode.API_TOKEN_REVOKED]: 'API Token已撤销',
} as const;

// ============= HTTP状态码映射 =============
export const AuthHttpStatusMap = {
  [AuthErrorCode.UNAUTHORIZED]: 401,
  [AuthErrorCode.FORBIDDEN]: 403,
  [AuthErrorCode.TOKEN_INVALID]: 401,
  [AuthErrorCode.TOKEN_EXPIRED]: 401,
  [AuthErrorCode.REFRESH_TOKEN_INVALID]: 401,
  [AuthErrorCode.REFRESH_TOKEN_EXPIRED]: 401,
  [AuthErrorCode.LOGIN_FAILED]: 401,
  [AuthErrorCode.ACCOUNT_LOCKED]: 403,
  [AuthErrorCode.NEED_RELOGIN]: 401,
  [AuthErrorCode.API_TOKEN_NOT_FOUND]: 401,
  [AuthErrorCode.API_TOKEN_EXPIRED]: 401,
  [AuthErrorCode.API_TOKEN_REVOKED]: 401,
} as const;

// ============= 类型定义 =============
export type AuthErrorCodeType = typeof AuthErrorCode[keyof typeof AuthErrorCode];
export type AuthErrorMessageType = typeof AuthErrorMessages[keyof typeof AuthErrorMessages];