export const FormErrorCode = {
  FORM_NOT_FOUND: 33001,
  FORM_FIELD_NOT_FOUND: 33002,
  FORM_RECORD_NOT_FOUND: 33003,
  FORM_FIELD_ALREADY_EXISTS: 33004,
} as const;

export const FormErrorMessages = {
  [FormErrorCode.FORM_NOT_FOUND]: "表单不存在",
  [FormErrorCode.FORM_FIELD_NOT_FOUND]: "表单字段不存在",
  [FormErrorCode.FORM_RECORD_NOT_FOUND]: "表单数据不存在",
  [FormErrorCode.FORM_FIELD_ALREADY_EXISTS]: "表单字段已存在",
} as const;

export type FormErrorCodeType = typeof FormErrorCode[keyof typeof FormErrorCode];
export type FormErrorMessageType = typeof FormErrorMessages[keyof typeof FormErrorMessages];
