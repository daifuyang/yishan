export const FormMessageKeys = {
  LIST_SUCCESS: "LIST_SUCCESS",
  DETAIL_SUCCESS: "DETAIL_SUCCESS",
  CREATE_SUCCESS: "CREATE_SUCCESS",
  UPDATE_SUCCESS: "UPDATE_SUCCESS",
  DELETE_SUCCESS: "DELETE_SUCCESS",
  FIELD_LIST_SUCCESS: "FIELD_LIST_SUCCESS",
  FIELD_DETAIL_SUCCESS: "FIELD_DETAIL_SUCCESS",
  FIELD_CREATE_SUCCESS: "FIELD_CREATE_SUCCESS",
  FIELD_UPDATE_SUCCESS: "FIELD_UPDATE_SUCCESS",
  FIELD_DELETE_SUCCESS: "FIELD_DELETE_SUCCESS",
  RECORD_LIST_SUCCESS: "RECORD_LIST_SUCCESS",
  RECORD_DETAIL_SUCCESS: "RECORD_DETAIL_SUCCESS",
  RECORD_CREATE_SUCCESS: "RECORD_CREATE_SUCCESS",
  RECORD_UPDATE_SUCCESS: "RECORD_UPDATE_SUCCESS",
  RECORD_DELETE_SUCCESS: "RECORD_DELETE_SUCCESS",
} as const;

export type FormMessageKey = typeof FormMessageKeys[keyof typeof FormMessageKeys];

const FORM_MESSAGES = {
  "zh-CN": {
    LIST_SUCCESS: "获取表单列表成功",
    DETAIL_SUCCESS: "获取表单详情成功",
    CREATE_SUCCESS: "创建表单成功",
    UPDATE_SUCCESS: "更新表单成功",
    DELETE_SUCCESS: "删除表单成功",
    FIELD_LIST_SUCCESS: "获取表单字段列表成功",
    FIELD_DETAIL_SUCCESS: "获取表单字段详情成功",
    FIELD_CREATE_SUCCESS: "创建表单字段成功",
    FIELD_UPDATE_SUCCESS: "更新表单字段成功",
    FIELD_DELETE_SUCCESS: "删除表单字段成功",
    RECORD_LIST_SUCCESS: "获取表单数据列表成功",
    RECORD_DETAIL_SUCCESS: "获取表单数据详情成功",
    RECORD_CREATE_SUCCESS: "创建表单数据成功",
    RECORD_UPDATE_SUCCESS: "更新表单数据成功",
    RECORD_DELETE_SUCCESS: "删除表单数据成功",
  },
  "en-US": {
    LIST_SUCCESS: "Fetched form list successfully",
    DETAIL_SUCCESS: "Fetched form detail successfully",
    CREATE_SUCCESS: "Form created successfully",
    UPDATE_SUCCESS: "Form updated successfully",
    DELETE_SUCCESS: "Form deleted successfully",
    FIELD_LIST_SUCCESS: "Fetched form field list successfully",
    FIELD_DETAIL_SUCCESS: "Fetched form field detail successfully",
    FIELD_CREATE_SUCCESS: "Form field created successfully",
    FIELD_UPDATE_SUCCESS: "Form field updated successfully",
    FIELD_DELETE_SUCCESS: "Form field deleted successfully",
    RECORD_LIST_SUCCESS: "Fetched form record list successfully",
    RECORD_DETAIL_SUCCESS: "Fetched form record detail successfully",
    RECORD_CREATE_SUCCESS: "Form record created successfully",
    RECORD_UPDATE_SUCCESS: "Form record updated successfully",
    RECORD_DELETE_SUCCESS: "Form record deleted successfully",
  },
} as const;

function resolveLocale(acceptLanguage?: string): keyof typeof FORM_MESSAGES {
  if (!acceptLanguage) return "zh-CN";
  const lang = acceptLanguage.split(",")[0].trim().toLowerCase();
  if (lang.startsWith("zh")) return "zh-CN";
  if (lang.startsWith("en")) return "en-US";
  return "zh-CN";
}

export function getFormMessage(key: FormMessageKey, acceptLanguage?: string): string {
  const locale = resolveLocale(acceptLanguage);
  const bundle = FORM_MESSAGES[locale];
  return bundle[key] || FORM_MESSAGES["zh-CN"][key];
}
