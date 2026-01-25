export const AppResourceErrorCode = {
  APP_RESOURCE_NOT_FOUND: 32801,
  APP_RESOURCE_ALREADY_EXISTS: 32802,
  APP_RESOURCE_DELETE_FORBIDDEN: 32803,
} as const;

export const AppResourceErrorMessages = {
  [AppResourceErrorCode.APP_RESOURCE_NOT_FOUND]: "应用资源不存在",
  [AppResourceErrorCode.APP_RESOURCE_ALREADY_EXISTS]: "应用资源已存在",
  [AppResourceErrorCode.APP_RESOURCE_DELETE_FORBIDDEN]: "应用资源删除被禁止",
} as const;

export type AppResourceErrorCodeType =
  typeof AppResourceErrorCode[keyof typeof AppResourceErrorCode];
export type AppResourceErrorMessageType =
  typeof AppResourceErrorMessages[keyof typeof AppResourceErrorMessages];
