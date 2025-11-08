/**
 * 角色模块业务码
 * 包含角色管理相关的业务错误码
 */

// ============= 角色业务错误码 (32xxx) =============
export const RoleErrorCode = {
  /** 角色不存在 */
  ROLE_NOT_FOUND: 32101,
  /** 角色已存在 */
  ROLE_ALREADY_EXISTS: 32102,
  /** 角色状态异常 */
  ROLE_STATUS_ERROR: 32103,
  /** 系统默认角色不允许删除 */
  ROLE_DELETE_FORBIDDEN: 32104,
} as const;

// ============= 错误消息映射 =============
export const RoleErrorMessages = {
  [RoleErrorCode.ROLE_NOT_FOUND]: '角色不存在',
  [RoleErrorCode.ROLE_ALREADY_EXISTS]: '角色已存在',
  [RoleErrorCode.ROLE_STATUS_ERROR]: '角色状态异常',
  [RoleErrorCode.ROLE_DELETE_FORBIDDEN]: '系统默认角色不允许删除',
} as const;

// ============= 类型定义 =============
export type RoleErrorCodeType = typeof RoleErrorCode[keyof typeof RoleErrorCode];
export type RoleErrorMessageType = typeof RoleErrorMessages[keyof typeof RoleErrorMessages];