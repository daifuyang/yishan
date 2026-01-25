export const AppMenuErrorCode = {
  APP_MENU_NOT_FOUND: 32901,
  APP_MENU_ALREADY_EXISTS: 32902,
  APP_MENU_DELETE_FORBIDDEN: 32903,
  APP_MENU_INVALID_PARENT: 32904,
} as const;

export const AppMenuErrorMessages = {
  [AppMenuErrorCode.APP_MENU_NOT_FOUND]: "应用菜单不存在",
  [AppMenuErrorCode.APP_MENU_ALREADY_EXISTS]: "应用菜单已存在",
  [AppMenuErrorCode.APP_MENU_DELETE_FORBIDDEN]: "应用菜单删除被禁止",
  [AppMenuErrorCode.APP_MENU_INVALID_PARENT]: "应用菜单父级不合法",
} as const;

export type AppMenuErrorCodeType = typeof AppMenuErrorCode[keyof typeof AppMenuErrorCode];
export type AppMenuErrorMessageType = typeof AppMenuErrorMessages[keyof typeof AppMenuErrorMessages];
