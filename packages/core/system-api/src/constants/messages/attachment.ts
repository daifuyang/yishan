export const AttachmentMessageKeys = {
  FOLDER_LIST_SUCCESS: "FOLDER_LIST_SUCCESS",
  FOLDER_TREE_SUCCESS: "FOLDER_TREE_SUCCESS",
  FOLDER_DETAIL_SUCCESS: "FOLDER_DETAIL_SUCCESS",
  FOLDER_CREATE_SUCCESS: "FOLDER_CREATE_SUCCESS",
  FOLDER_UPDATE_SUCCESS: "FOLDER_UPDATE_SUCCESS",
  FOLDER_DELETE_SUCCESS: "FOLDER_DELETE_SUCCESS",
  ATTACHMENT_LIST_SUCCESS: "ATTACHMENT_LIST_SUCCESS",
  ATTACHMENT_DETAIL_SUCCESS: "ATTACHMENT_DETAIL_SUCCESS",
  ATTACHMENT_UPDATE_SUCCESS: "ATTACHMENT_UPDATE_SUCCESS",
  ATTACHMENT_DELETE_SUCCESS: "ATTACHMENT_DELETE_SUCCESS",
} as const;

export type AttachmentMessageKey =
  typeof AttachmentMessageKeys[keyof typeof AttachmentMessageKeys];

const ATTACHMENT_MESSAGES = {
  "zh-CN": {
    FOLDER_LIST_SUCCESS: "获取分组列表成功",
    FOLDER_TREE_SUCCESS: "获取分组树成功",
    FOLDER_DETAIL_SUCCESS: "获取分组详情成功",
    FOLDER_CREATE_SUCCESS: "创建分组成功",
    FOLDER_UPDATE_SUCCESS: "更新分组成功",
    FOLDER_DELETE_SUCCESS: "删除分组成功",
    ATTACHMENT_LIST_SUCCESS: "获取素材列表成功",
    ATTACHMENT_DETAIL_SUCCESS: "获取素材详情成功",
    ATTACHMENT_UPDATE_SUCCESS: "更新素材成功",
    ATTACHMENT_DELETE_SUCCESS: "删除素材成功",
  },
  "en-US": {
    FOLDER_LIST_SUCCESS: "Fetched folder list successfully",
    FOLDER_TREE_SUCCESS: "Fetched folder tree successfully",
    FOLDER_DETAIL_SUCCESS: "Fetched folder detail successfully",
    FOLDER_CREATE_SUCCESS: "Folder created successfully",
    FOLDER_UPDATE_SUCCESS: "Folder updated successfully",
    FOLDER_DELETE_SUCCESS: "Folder deleted successfully",
    ATTACHMENT_LIST_SUCCESS: "Fetched attachments successfully",
    ATTACHMENT_DETAIL_SUCCESS: "Fetched attachment detail successfully",
    ATTACHMENT_UPDATE_SUCCESS: "Attachment updated successfully",
    ATTACHMENT_DELETE_SUCCESS: "Attachment deleted successfully",
  },
} as const;

function resolveLocale(
  acceptLanguage?: string
): keyof typeof ATTACHMENT_MESSAGES {
  if (!acceptLanguage) return "zh-CN";
  const lang = acceptLanguage.split(",")[0].trim().toLowerCase();
  if (lang.startsWith("zh")) return "zh-CN";
  if (lang.startsWith("en")) return "en-US";
  return "zh-CN";
}

export function getAttachmentMessage(
  key: AttachmentMessageKey,
  acceptLanguage?: string
): string {
  const locale = resolveLocale(acceptLanguage);
  const bundle = ATTACHMENT_MESSAGES[locale];
  return bundle[key] || ATTACHMENT_MESSAGES["zh-CN"][key];
}

