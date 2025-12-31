/**
 * 系统管理业务码
 * 包含系统维护、定时任务等相关业务码
 */

// ============= 系统管理错误码 (25xxx) =============
export const SystemManageErrorCode = {
  /** 无效的定时任务令牌 */
  INVALID_CRON_TOKEN: 25001,
  /** 定时任务执行失败 */
  CRON_JOB_FAILED: 25002,
  /** 权限不足 */
  INSUFFICIENT_PERMISSIONS: 25003,
  /** 登录日志不存在 */
  LOGIN_LOG_NOT_FOUND: 25004,
} as const;

// ============= 错误消息映射 =============
export const SystemManageErrorMessages = {
  [SystemManageErrorCode.INVALID_CRON_TOKEN]: '无效的定时任务令牌',
  [SystemManageErrorCode.CRON_JOB_FAILED]: '定时任务执行失败',
  [SystemManageErrorCode.INSUFFICIENT_PERMISSIONS]: '权限不足',
  [SystemManageErrorCode.LOGIN_LOG_NOT_FOUND]: '登录日志不存在',
} as const;

// ============= HTTP状态码映射 =============
export const SystemManageHttpStatusMap = {
  [SystemManageErrorCode.INVALID_CRON_TOKEN]: 401,
  [SystemManageErrorCode.CRON_JOB_FAILED]: 500,
  [SystemManageErrorCode.INSUFFICIENT_PERMISSIONS]: 403,
  [SystemManageErrorCode.LOGIN_LOG_NOT_FOUND]: 404,
} as const;

// ============= 类型定义 =============
export type SystemManageErrorCodeType = typeof SystemManageErrorCode[keyof typeof SystemManageErrorCode];
export type SystemManageErrorMessageType = typeof SystemManageErrorMessages[keyof typeof SystemManageErrorMessages];
