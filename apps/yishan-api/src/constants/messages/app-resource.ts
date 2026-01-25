export const AppResourceMessageKeys = {
  LIST_SUCCESS: "LIST_SUCCESS",
  DETAIL_SUCCESS: "DETAIL_SUCCESS",
  CREATE_SUCCESS: "CREATE_SUCCESS",
  UPDATE_SUCCESS: "UPDATE_SUCCESS",
  DELETE_SUCCESS: "DELETE_SUCCESS",
  TREE_SUCCESS: "TREE_SUCCESS",
} as const;

export type AppResourceMessageKey =
  typeof AppResourceMessageKeys[keyof typeof AppResourceMessageKeys];

const APP_RESOURCE_MESSAGES = {
  "zh-CN": {
    LIST_SUCCESS: "获取应用资源列表成功",
    DETAIL_SUCCESS: "获取应用资源详情成功",
    CREATE_SUCCESS: "创建应用资源成功",
    UPDATE_SUCCESS: "更新应用资源成功",
    DELETE_SUCCESS: "删除应用资源成功",
    TREE_SUCCESS: "获取应用资源树成功",
  },
  "en-US": {
    LIST_SUCCESS: "Fetched app resource list successfully",
    DETAIL_SUCCESS: "Fetched app resource detail successfully",
    CREATE_SUCCESS: "App resource created successfully",
    UPDATE_SUCCESS: "App resource updated successfully",
    DELETE_SUCCESS: "App resource deleted successfully",
    TREE_SUCCESS: "Fetched app resource tree successfully",
  },
} as const;

function resolveLocale(acceptLanguage?: string): keyof typeof APP_RESOURCE_MESSAGES {
  if (!acceptLanguage) return "zh-CN";
  const lang = acceptLanguage.split(",")[0].trim().toLowerCase();
  if (lang.startsWith("zh")) return "zh-CN";
  if (lang.startsWith("en")) return "en-US";
  return "zh-CN";
}

export function getAppResourceMessage(key: AppResourceMessageKey, acceptLanguage?: string): string {
  const locale = resolveLocale(acceptLanguage);
  const bundle = APP_RESOURCE_MESSAGES[locale];
  return bundle[key] || APP_RESOURCE_MESSAGES["zh-CN"][key];
}
