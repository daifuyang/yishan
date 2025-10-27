/**
 * 通用业务码
 * 包含成功码和系统级错误码
 */

// ============= 成功码 =============
export const SUCCESS_CODE = 10000;

// ============= 系统错误码 (20xxx) =============
export const SystemErrorCode = {
  /** 系统内部错误 */
  SYSTEM_ERROR: 20001,
  /** 数据库错误 */
  DATABASE_ERROR: 20002,
  /** 缓存错误 */
  CACHE_ERROR: 20003,
  /** 网络连接错误 */
  NETWORK_ERROR: 20004,
  /** 服务不可用 */
  SERVICE_UNAVAILABLE: 20005,
  /** 请求超时 */
  REQUEST_TIMEOUT: 20006,
} as const;

// ============= 错误消息映射 =============
export const SystemErrorMessages = {
  [SUCCESS_CODE]: '操作成功',
  [SystemErrorCode.SYSTEM_ERROR]: '系统内部错误',
  [SystemErrorCode.DATABASE_ERROR]: '数据库错误',
  [SystemErrorCode.CACHE_ERROR]: '缓存错误',
  [SystemErrorCode.NETWORK_ERROR]: '网络连接失败',
  [SystemErrorCode.SERVICE_UNAVAILABLE]: '服务暂不可用',
  [SystemErrorCode.REQUEST_TIMEOUT]: '请求超时',
} as const;

// ============= HTTP状态码映射 =============
export const SystemHttpStatusMap = {
  [SUCCESS_CODE]: 200,
  [SystemErrorCode.SYSTEM_ERROR]: 500,
  [SystemErrorCode.DATABASE_ERROR]: 500,
  [SystemErrorCode.CACHE_ERROR]: 500,
  [SystemErrorCode.NETWORK_ERROR]: 503,
  [SystemErrorCode.SERVICE_UNAVAILABLE]: 503,
  [SystemErrorCode.REQUEST_TIMEOUT]: 408,
} as const;

// ============= 类型定义 =============
export type SystemErrorCodeType = typeof SystemErrorCode[keyof typeof SystemErrorCode];
export type SystemErrorMessageType = typeof SystemErrorMessages[keyof typeof SystemErrorMessages];