/**
 * 岗位模块业务码
 * 包含岗位管理相关的业务错误码
 */

// ============= 岗位业务错误码 (32xxx) =============
export const PositionErrorCode = {
  /** 岗位不存在 */
  POSITION_NOT_FOUND: 32301,
  /** 岗位已存在（名称或编码冲突） */
  POSITION_ALREADY_EXISTS: 32302,
  /** 岗位删除被禁止（如与关键业务绑定） */
  POSITION_DELETE_FORBIDDEN: 32303,
} as const;

// ============= 错误消息映射 =============
export const PositionErrorMessages = {
  [PositionErrorCode.POSITION_NOT_FOUND]: '岗位不存在',
  [PositionErrorCode.POSITION_ALREADY_EXISTS]: '岗位已存在',
  [PositionErrorCode.POSITION_DELETE_FORBIDDEN]: '岗位删除被禁止',
} as const;

// ============= 类型定义 =============
export type PositionErrorCodeType = typeof PositionErrorCode[keyof typeof PositionErrorCode];
export type PositionErrorMessageType = typeof PositionErrorMessages[keyof typeof PositionErrorMessages];
