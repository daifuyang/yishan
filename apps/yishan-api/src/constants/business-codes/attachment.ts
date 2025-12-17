export const AttachmentErrorCode = {
  FOLDER_NOT_FOUND: 32601,
  FOLDER_ALREADY_EXISTS: 32602,
  FOLDER_DELETE_FORBIDDEN: 32603,
  ATTACHMENT_NOT_FOUND: 32611,
} as const;

export const AttachmentErrorMessages = {
  [AttachmentErrorCode.FOLDER_NOT_FOUND]: "分组不存在",
  [AttachmentErrorCode.FOLDER_ALREADY_EXISTS]: "分组已存在",
  [AttachmentErrorCode.FOLDER_DELETE_FORBIDDEN]: "分组下存在子分组或素材，禁止删除",
  [AttachmentErrorCode.ATTACHMENT_NOT_FOUND]: "素材不存在",
} as const;

export type AttachmentErrorCodeType =
  typeof AttachmentErrorCode[keyof typeof AttachmentErrorCode];
export type AttachmentErrorMessageType =
  typeof AttachmentErrorMessages[keyof typeof AttachmentErrorMessages];

