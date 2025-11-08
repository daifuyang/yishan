/**
 * 部门模块业务码
 * 包含部门管理相关的业务错误码
 */

// ============= 部门业务错误码 (32xxx) =============
export const DeptErrorCode = {
  /** 部门不存在 */
  DEPT_NOT_FOUND: 32201,
  /** 部门已存在（名称或编码冲突） */
  DEPT_ALREADY_EXISTS: 32202,
  /** 部门删除被禁止（如存在子部门） */
  DEPT_DELETE_FORBIDDEN: 32203,
} as const;

// ============= 错误消息映射 =============
export const DeptErrorMessages = {
  [DeptErrorCode.DEPT_NOT_FOUND]: '部门不存在',
  [DeptErrorCode.DEPT_ALREADY_EXISTS]: '部门已存在',
  [DeptErrorCode.DEPT_DELETE_FORBIDDEN]: '存在子部门，禁止删除',
} as const;

// ============= 类型定义 =============
export type DeptErrorCodeType = typeof DeptErrorCode[keyof typeof DeptErrorCode];
export type DeptErrorMessageType = typeof DeptErrorMessages[keyof typeof DeptErrorMessages];