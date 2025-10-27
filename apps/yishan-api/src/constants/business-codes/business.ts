/**
 * 业务逻辑业务码
 * 包含通用业务逻辑相关的错误码
 */

// ============= 业务错误码 (32xxx) =============
export const BusinessErrorCode = {
  /** 业务处理失败 */
  BUSINESS_ERROR: 32001,
  /** 操作不允许 */
  OPERATION_NOT_ALLOWED: 32002,
  /** 状态无效 */
  STATUS_INVALID: 32003,
  /** 数据冲突 */
  DATA_CONFLICT: 32004,
  /** 业务规则违反 */
  BUSINESS_RULE_VIOLATION: 32005,
  /** 流程状态错误 */
  WORKFLOW_STATUS_ERROR: 32006,
  /** 依赖条件不满足 */
  DEPENDENCY_NOT_MET: 32007,
  /** 配置错误 */
  CONFIGURATION_ERROR: 32008,
  /** 外部服务调用失败 */
  EXTERNAL_SERVICE_ERROR: 32009,
  /** 数据完整性错误 */
  DATA_INTEGRITY_ERROR: 32010,
} as const;

// ============= 错误消息映射 =============
export const BusinessErrorMessages = {
  [BusinessErrorCode.BUSINESS_ERROR]: '业务处理失败',
  [BusinessErrorCode.OPERATION_NOT_ALLOWED]: '操作不允许',
  [BusinessErrorCode.STATUS_INVALID]: '状态无效',
  [BusinessErrorCode.DATA_CONFLICT]: '数据冲突',
  [BusinessErrorCode.BUSINESS_RULE_VIOLATION]: '业务规则违反',
  [BusinessErrorCode.WORKFLOW_STATUS_ERROR]: '流程状态错误',
  [BusinessErrorCode.DEPENDENCY_NOT_MET]: '依赖条件不满足',
  [BusinessErrorCode.CONFIGURATION_ERROR]: '配置错误',
  [BusinessErrorCode.EXTERNAL_SERVICE_ERROR]: '外部服务调用失败',
  [BusinessErrorCode.DATA_INTEGRITY_ERROR]: '数据完整性错误',
} as const;

// ============= 类型定义 =============
export type BusinessErrorCodeType = typeof BusinessErrorCode[keyof typeof BusinessErrorCode];
export type BusinessErrorMessageType = typeof BusinessErrorMessages[keyof typeof BusinessErrorMessages];