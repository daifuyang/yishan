export const DictMessageKeys = {
  LIST_SUCCESS: "LIST_SUCCESS",
  DETAIL_SUCCESS: "DETAIL_SUCCESS",
  CREATE_SUCCESS: "CREATE_SUCCESS",
  UPDATE_SUCCESS: "UPDATE_SUCCESS",
  DELETE_SUCCESS: "DELETE_SUCCESS",
  MAP_SUCCESS: "MAP_SUCCESS",
} as const;

export type DictMessageKey = typeof DictMessageKeys[keyof typeof DictMessageKeys];

const DICT_MESSAGES = {
  "zh-CN": {
    LIST_SUCCESS: "获取字典列表成功",
    DETAIL_SUCCESS: "获取字典详情成功",
    CREATE_SUCCESS: "创建字典成功",
    UPDATE_SUCCESS: "更新字典成功",
    DELETE_SUCCESS: "删除字典成功",
    MAP_SUCCESS: "获取字典映射成功",
  },
  "en-US": {
    LIST_SUCCESS: "Fetched dictionary list successfully",
    DETAIL_SUCCESS: "Fetched dictionary detail successfully",
    CREATE_SUCCESS: "Dictionary created successfully",
    UPDATE_SUCCESS: "Dictionary updated successfully",
    DELETE_SUCCESS: "Dictionary deleted successfully",
    MAP_SUCCESS: "Fetched dictionary map successfully",
  },
} as const;

function resolveLocale(acceptLanguage?: string): keyof typeof DICT_MESSAGES {
  if (!acceptLanguage) return "zh-CN";
  const lang = acceptLanguage.split(",")[0].trim().toLowerCase();
  if (lang.startsWith("zh")) return "zh-CN";
  if (lang.startsWith("en")) return "en-US";
  return "zh-CN";
}

export function getDictMessage(key: DictMessageKey, acceptLanguage?: string): string {
  const locale = resolveLocale(acceptLanguage);
  const bundle = DICT_MESSAGES[locale];
  return bundle[key] || DICT_MESSAGES["zh-CN"][key];
}