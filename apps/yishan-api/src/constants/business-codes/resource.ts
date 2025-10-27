/**
 * 资源模块业务码
 * 包含资源操作相关的错误码
 */

// ============= 资源错误码 (31xxx) =============
export const ResourceErrorCode = {
  /** 资源不存在 */
  RESOURCE_NOT_FOUND: 31001,
  /** 资源已存在 */
  RESOURCE_ALREADY_EXISTS: 31002,
  /** 资源访问被拒绝 */
  RESOURCE_ACCESS_DENIED: 31003,
  /** 资源已被删除 */
  RESOURCE_DELETED: 31004,
  /** 资源正在使用中 */
  RESOURCE_IN_USE: 31005,
  /** 资源配额不足 */
  RESOURCE_QUOTA_EXCEEDED: 31006,
  /** 文件格式不支持 */
  FILE_FORMAT_NOT_SUPPORTED: 31007,
  /** 文件大小超限 */
  FILE_SIZE_EXCEEDED: 31008,
  /** 资源状态异常 */
  RESOURCE_STATUS_ERROR: 31009,
} as const;

// ============= 错误消息映射 =============
export const ResourceErrorMessages = {
  [ResourceErrorCode.RESOURCE_NOT_FOUND]: '资源不存在',
  [ResourceErrorCode.RESOURCE_ALREADY_EXISTS]: '资源已存在',
  [ResourceErrorCode.RESOURCE_ACCESS_DENIED]: '资源访问被拒绝',
  [ResourceErrorCode.RESOURCE_DELETED]: '资源已被删除',
  [ResourceErrorCode.RESOURCE_IN_USE]: '资源正在使用中',
  [ResourceErrorCode.RESOURCE_QUOTA_EXCEEDED]: '资源配额不足',
  [ResourceErrorCode.FILE_FORMAT_NOT_SUPPORTED]: '文件格式不支持',
  [ResourceErrorCode.FILE_SIZE_EXCEEDED]: '文件大小超限',
  [ResourceErrorCode.RESOURCE_STATUS_ERROR]: '资源状态异常',
} as const;

// ============= HTTP状态码映射 =============
export const ResourceHttpStatusMap = {
  [ResourceErrorCode.RESOURCE_NOT_FOUND]: 404,
  [ResourceErrorCode.RESOURCE_ALREADY_EXISTS]: 409,
  [ResourceErrorCode.RESOURCE_ACCESS_DENIED]: 403,
  [ResourceErrorCode.RESOURCE_DELETED]: 410,
  [ResourceErrorCode.RESOURCE_IN_USE]: 409,
  [ResourceErrorCode.RESOURCE_QUOTA_EXCEEDED]: 413,
  [ResourceErrorCode.FILE_FORMAT_NOT_SUPPORTED]: 415,
  [ResourceErrorCode.FILE_SIZE_EXCEEDED]: 413,
  [ResourceErrorCode.RESOURCE_STATUS_ERROR]: 400,
} as const;

// ============= 类型定义 =============
export type ResourceErrorCodeType = typeof ResourceErrorCode[keyof typeof ResourceErrorCode];
export type ResourceErrorMessageType = typeof ResourceErrorMessages[keyof typeof ResourceErrorMessages];