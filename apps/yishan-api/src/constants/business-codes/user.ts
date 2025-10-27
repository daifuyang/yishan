/**
 * 用户模块业务码
 * 包含用户相关的所有业务错误码
 */

// ============= 用户模块错误码 (30xxx) =============
export const UserErrorCode = {
  /** 用户不存在 */
  USER_NOT_FOUND: 30001,
  /** 用户已存在 */
  USER_ALREADY_EXISTS: 30002,
  /** 用户已被禁用 */
  USER_DISABLED: 30003,
  /** 密码错误 */
  PASSWORD_ERROR: 30004,
  /** 用户名格式错误 */
  USERNAME_FORMAT_ERROR: 30005,
  /** 邮箱格式错误 */
  EMAIL_FORMAT_ERROR: 30006,
  /** 手机号格式错误 */
  PHONE_FORMAT_ERROR: 30007,
  /** 密码强度不够 */
  PASSWORD_WEAK: 30008,
  /** 用户状态异常 */
  USER_STATUS_ERROR: 30009,
  /** 用户信息不完整 */
  USER_INFO_INCOMPLETE: 30010,
} as const;

// ============= 错误消息映射 =============
export const UserErrorMessages = {
  [UserErrorCode.USER_NOT_FOUND]: '用户不存在',
  [UserErrorCode.USER_ALREADY_EXISTS]: '用户已存在',
  [UserErrorCode.USER_DISABLED]: '用户已被禁用',
  [UserErrorCode.PASSWORD_ERROR]: '密码错误',
  [UserErrorCode.USERNAME_FORMAT_ERROR]: '用户名格式错误',
  [UserErrorCode.EMAIL_FORMAT_ERROR]: '邮箱格式错误',
  [UserErrorCode.PHONE_FORMAT_ERROR]: '手机号格式错误',
  [UserErrorCode.PASSWORD_WEAK]: '密码强度不足',
  [UserErrorCode.USER_STATUS_ERROR]: '用户状态异常',
  [UserErrorCode.USER_INFO_INCOMPLETE]: '用户信息不完整',
} as const;

// ============= 类型定义 =============
export type UserErrorCodeType = typeof UserErrorCode[keyof typeof UserErrorCode];
export type UserErrorMessageType = typeof UserErrorMessages[keyof typeof UserErrorMessages];