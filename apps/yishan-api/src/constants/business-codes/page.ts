/**
 * 门户页面业务码
 */

export const PageErrorCode = {
  PAGE_NOT_FOUND: 32501,
  PAGE_ALREADY_EXISTS: 32502,
} as const;

export const PageErrorMessages = {
  [PageErrorCode.PAGE_NOT_FOUND]: "页面不存在",
  [PageErrorCode.PAGE_ALREADY_EXISTS]: "页面已存在",
} as const;

export type PageErrorCodeType = typeof PageErrorCode[keyof typeof PageErrorCode];
export type PageErrorMessageType = typeof PageErrorMessages[keyof typeof PageErrorMessages];

