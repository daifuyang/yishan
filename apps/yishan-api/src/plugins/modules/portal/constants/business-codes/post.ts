/**
 * 岗位模块业务码
 * 包含岗位管理相关的业务错误码
 */

export const PostErrorCode = {
  POST_NOT_FOUND: 32301,
  POST_ALREADY_EXISTS: 32302,
  POST_DELETE_FORBIDDEN: 32303,
} as const;

export const PostErrorMessages = {
  [PostErrorCode.POST_NOT_FOUND]: '岗位不存在',
  [PostErrorCode.POST_ALREADY_EXISTS]: '岗位已存在',
  [PostErrorCode.POST_DELETE_FORBIDDEN]: '岗位删除被禁止',
} as const;

export type PostErrorCodeType = typeof PostErrorCode[keyof typeof PostErrorCode];
export type PostErrorMessageType = typeof PostErrorMessages[keyof typeof PostErrorMessages];
