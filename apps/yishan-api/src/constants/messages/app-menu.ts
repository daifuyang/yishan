export const AppMenuMessageKeys = {
  LIST_SUCCESS: "LIST_SUCCESS",
  DETAIL_SUCCESS: "DETAIL_SUCCESS",
  CREATE_SUCCESS: "CREATE_SUCCESS",
  UPDATE_SUCCESS: "UPDATE_SUCCESS",
  DELETE_SUCCESS: "DELETE_SUCCESS",
  TREE_SUCCESS: "TREE_SUCCESS",
} as const;

export type AppMenuMessageKey = typeof AppMenuMessageKeys[keyof typeof AppMenuMessageKeys];

const APP_MENU_MESSAGES = {
  "zh-CN": {
    LIST_SUCCESS: "获取应用菜单列表成功",
    DETAIL_SUCCESS: "获取应用菜单详情成功",
    CREATE_SUCCESS: "创建应用菜单成功",
    UPDATE_SUCCESS: "更新应用菜单成功",
    DELETE_SUCCESS: "删除应用菜单成功",
    TREE_SUCCESS: "获取应用菜单树成功",
  },
  "en-US": {
    LIST_SUCCESS: "Fetched app menu list successfully",
    DETAIL_SUCCESS: "Fetched app menu detail successfully",
    CREATE_SUCCESS: "App menu created successfully",
    UPDATE_SUCCESS: "App menu updated successfully",
    DELETE_SUCCESS: "App menu deleted successfully",
    TREE_SUCCESS: "Fetched app menu tree successfully",
  },
} as const;

function resolveLocale(acceptLanguage?: string): keyof typeof APP_MENU_MESSAGES {
  if (!acceptLanguage) return "zh-CN";
  const lang = acceptLanguage.split(",")[0].trim().toLowerCase();
  if (lang.startsWith("zh")) return "zh-CN";
  if (lang.startsWith("en")) return "en-US";
  return "zh-CN";
}

export function getAppMenuMessage(key: AppMenuMessageKey, acceptLanguage?: string): string {
  const locale = resolveLocale(acceptLanguage);
  const bundle = APP_MENU_MESSAGES[locale];
  return bundle[key] || APP_MENU_MESSAGES["zh-CN"][key];
}
