/**
 * 岗位模块业务码
 * 包含岗位管理相关的业务错误码
 */

// ============= 岗位业务错误码 (32xxx) =============
export const PostErrorCode = {
  /** 岗位不存在 */
  POST_NOT_FOUND: 32301,
  /** 岗位已存在（名称或编码冲突） */
  POST_ALREADY_EXISTS: 32302,
  /** 岗位删除被禁止（如与关键业务绑定） */
  POST_DELETE_FORBIDDEN: 32303,
} as const;

// ============= 错误消息映射 =============
export const PostErrorMessages = {
  [PostErrorCode.POST_NOT_FOUND]: '岗位不存在',
  [PostErrorCode.POST_ALREADY_EXISTS]: '岗位已存在',
  [PostErrorCode.POST_DELETE_FORBIDDEN]: '岗位删除被禁止',
} as const;

// ============= 类型定义 =============
export type PostErrorCodeType = typeof PostErrorCode[keyof typeof PostErrorCode];
export type PostErrorMessageType = typeof PostErrorMessages[keyof typeof PostErrorMessages];