export const AppMessageKeys = {
  LIST_SUCCESS: "LIST_SUCCESS",
  DETAIL_SUCCESS: "DETAIL_SUCCESS",
  CREATE_SUCCESS: "CREATE_SUCCESS",
  UPDATE_SUCCESS: "UPDATE_SUCCESS",
  DELETE_SUCCESS: "DELETE_SUCCESS",
} as const;

export type AppMessageKey = typeof AppMessageKeys[keyof typeof AppMessageKeys];

const APP_MESSAGES = {
  "zh-CN": {
    LIST_SUCCESS: "获取应用列表成功",
    DETAIL_SUCCESS: "获取应用详情成功",
    CREATE_SUCCESS: "创建应用成功",
    UPDATE_SUCCESS: "更新应用成功",
    DELETE_SUCCESS: "删除应用成功",
  },
  "en-US": {
    LIST_SUCCESS: "Fetched app list successfully",
    DETAIL_SUCCESS: "Fetched app detail successfully",
    CREATE_SUCCESS: "App created successfully",
    UPDATE_SUCCESS: "App updated successfully",
    DELETE_SUCCESS: "App deleted successfully",
  },
} as const;

function resolveLocale(acceptLanguage?: string): keyof typeof APP_MESSAGES {
  if (!acceptLanguage) return "zh-CN";
  const lang = acceptLanguage.split(",")[0].trim().toLowerCase();
  if (lang.startsWith("zh")) return "zh-CN";
  if (lang.startsWith("en")) return "en-US";
  return "zh-CN";
}

export function getAppMessage(key: AppMessageKey, acceptLanguage?: string): string {
  const locale = resolveLocale(acceptLanguage);
  const bundle = APP_MESSAGES[locale];
  return bundle[key] || APP_MESSAGES["zh-CN"][key];
}
