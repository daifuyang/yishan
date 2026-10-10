/**
 * 通用资源业务码
 * 跨模块通用的资源级错误（找不到、已存在等），与具体业务模块（dept / dict / role 等）解耦。
 */

// ============= 资源错误码 (31xxx) =============
export const ResourceErrorCode = {
  /** 资源不存在 */
  NOT_FOUND: 31001,
  /** 资源已存在 */
  ALREADY_EXISTS: 31002,
  /** 资源删除被禁止 */
  DELETE_FORBIDDEN: 31003,
} as const;

// ============= 错误消息映射 =============
export const ResourceErrorMessages = {
  [ResourceErrorCode.NOT_FOUND]: '资源不存在',
  [ResourceErrorCode.ALREADY_EXISTS]: '资源已存在',
  [ResourceErrorCode.DELETE_FORBIDDEN]: '资源删除被禁止',
} as const;

// ============= HTTP 状态码映射 =============
export const ResourceHttpStatusMap = {
  [ResourceErrorCode.NOT_FOUND]: 404,
  [ResourceErrorCode.ALREADY_EXISTS]: 409,
  [ResourceErrorCode.DELETE_FORBIDDEN]: 403,
} as const;

export type ResourceErrorCodeType = typeof ResourceErrorCode[keyof typeof ResourceErrorCode];
export type ResourceErrorMessageType = typeof ResourceErrorMessages[keyof typeof ResourceErrorMessages];
