/**
 * 参数验证业务码
 * 包含所有参数验证相关的错误码
 */

// ============= 参数错误码 (21xxx) =============
export const ValidationErrorCode = {
  /** 参数错误 */
  INVALID_PARAMETER: 21001,
  /** 缺少必要参数 */
  MISSING_PARAMETER: 21002,
  /** 参数类型错误 */
  PARAMETER_TYPE_ERROR: 21003,
  /** 参数格式错误 */
  PARAMETER_FORMAT_ERROR: 21004,
  /** 参数值超出范围 */
  PARAMETER_OUT_OF_RANGE: 21005,
  /** 参数长度不符合要求 */
  PARAMETER_LENGTH_ERROR: 21006,
  /** 数据验证失败 */
  VALIDATION_ERROR: 21007,
  /** 请求过于频繁 */
  TOO_MANY_REQUESTS: 21008,
} as const;

// ============= 错误消息映射 =============
export const ValidationErrorMessages = {
  [ValidationErrorCode.INVALID_PARAMETER]: '参数错误',
  [ValidationErrorCode.MISSING_PARAMETER]: '缺少必要参数',
  [ValidationErrorCode.PARAMETER_TYPE_ERROR]: '参数类型错误',
  [ValidationErrorCode.PARAMETER_FORMAT_ERROR]: '参数格式错误',
  [ValidationErrorCode.PARAMETER_OUT_OF_RANGE]: '参数值超出范围',
  [ValidationErrorCode.PARAMETER_LENGTH_ERROR]: '参数长度不符合要求',
  [ValidationErrorCode.VALIDATION_ERROR]: '数据验证失败',
  [ValidationErrorCode.TOO_MANY_REQUESTS]: '请求过于频繁',
} as const;

// ============= HTTP状态码映射 =============
export const ValidationHttpStatusMap = {
  [ValidationErrorCode.INVALID_PARAMETER]: 400,
  [ValidationErrorCode.MISSING_PARAMETER]: 400,
  [ValidationErrorCode.PARAMETER_TYPE_ERROR]: 400,
  [ValidationErrorCode.PARAMETER_FORMAT_ERROR]: 400,
  [ValidationErrorCode.PARAMETER_OUT_OF_RANGE]: 400,
  [ValidationErrorCode.PARAMETER_LENGTH_ERROR]: 400,
  [ValidationErrorCode.VALIDATION_ERROR]: 422,
  [ValidationErrorCode.TOO_MANY_REQUESTS]: 429,
} as const;

// ============= 类型定义 =============
export type ValidationErrorCodeType = typeof ValidationErrorCode[keyof typeof ValidationErrorCode];
export type ValidationErrorMessageType = typeof ValidationErrorMessages[keyof typeof ValidationErrorMessages];