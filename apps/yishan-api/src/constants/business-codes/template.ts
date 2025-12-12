/**
 * 门户模板业务码
 */

export const TemplateErrorCode = {
  TEMPLATE_NOT_FOUND: 32601,
  TEMPLATE_ALREADY_EXISTS: 32602,
  TEMPLATE_TYPE_MISMATCH: 32603,
  TEMPLATE_DELETE_FORBIDDEN: 32604,
  TEMPLATE_UPDATE_FORBIDDEN: 32605,
} as const;

export const TemplateErrorMessages = {
  [TemplateErrorCode.TEMPLATE_NOT_FOUND]: "模板不存在",
  [TemplateErrorCode.TEMPLATE_ALREADY_EXISTS]: "模板已存在",
  [TemplateErrorCode.TEMPLATE_TYPE_MISMATCH]: "模板类型不匹配",
  [TemplateErrorCode.TEMPLATE_DELETE_FORBIDDEN]: "系统默认模板不允许删除",
  [TemplateErrorCode.TEMPLATE_UPDATE_FORBIDDEN]: "系统默认模板不允许修改",
} as const;

export type TemplateErrorCodeType = typeof TemplateErrorCode[keyof typeof TemplateErrorCode];
export type TemplateErrorMessageType = typeof TemplateErrorMessages[keyof typeof TemplateErrorMessages];
