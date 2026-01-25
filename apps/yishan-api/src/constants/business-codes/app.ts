export const AppErrorCode = {
  APP_NOT_FOUND: 32701,
  APP_ALREADY_EXISTS: 32702,
  APP_DELETE_FORBIDDEN: 32703,
} as const;

export const AppErrorMessages = {
  [AppErrorCode.APP_NOT_FOUND]: "应用不存在",
  [AppErrorCode.APP_ALREADY_EXISTS]: "应用已存在",
  [AppErrorCode.APP_DELETE_FORBIDDEN]: "应用删除被禁止",
} as const;

export type AppErrorCodeType = typeof AppErrorCode[keyof typeof AppErrorCode];
export type AppErrorMessageType = typeof AppErrorMessages[keyof typeof AppErrorMessages];
