/**
 * 附件实体到 API 响应 DTO 的映射器
 */

import { dateUtils } from "../../utils/date.js";
import type { SysAttachmentFolderResp, SysAttachmentResp } from "../schemas/attachment.js";
import type { FolderListRow, FolderDetailRow, AttachmentListRow, AttachmentDetailRow } from "../repositories/attachment.repository.js";

// Kind 转换辅助函数
export const folderKindFromDb = (kind: number): SysAttachmentFolderResp["kind"] => {
  switch (kind) {
    case 0: return "all";
    case 1: return "image";
    case 2: return "audio";
    case 3: return "video";
    default: return "other";
  }
};

/** Reverse of `folderKindFromDb`: API kind string → DB number. */
export const folderKindToDb = (kind: SysAttachmentFolderResp["kind"] | "all"): number => {
  switch (kind) {
    case "all":   return 0;
    case "image": return 1;
    case "audio": return 2;
    case "video": return 3;
    default:      return 4;
  }
};

const attachmentKindFromDb = (kind: number): SysAttachmentResp["kind"] => {
  switch (kind) {
    case 1: return "image";
    case 2: return "audio";
    case 3: return "video";
    default: return "other";
  }
};

export class AttachmentMapper {
  static toFolderListResp(folder: FolderListRow): SysAttachmentFolderResp {
    return {
      id: folder.id,
      name: folder.name,
      parentId: folder.parentId ?? 0,
      kind: folderKindFromDb(folder.kind),
      status: folder.status.toString(),
      sort_order: folder.sortOrder ?? 0,
      remark: folder.remark ?? undefined,
      creatorId: folder.creatorId ?? undefined,
      creatorName: folder.creatorName ?? undefined,
      createdAt: dateUtils.formatISO(folder.createdAt)!,
      updaterId: folder.updaterId ?? undefined,
      updaterName: folder.updaterName ?? undefined,
      updatedAt: dateUtils.formatISO(folder.updatedAt)!,
      children: undefined,
    };
  }

  static toFolderDetailResp(folder: FolderDetailRow): SysAttachmentFolderResp {
    return this.toFolderListResp(folder);
  }

  static toAttachmentListResp(attachment: AttachmentListRow): SysAttachmentResp {
    return {
      id: attachment.id,
      folderId: attachment.folderId ?? undefined,
      folderName: attachment.folderName ?? undefined,
      kind: attachmentKindFromDb(attachment.kind),
      name: (attachment.name ?? undefined) as string,
      originalName: attachment.originalName,
      filename: attachment.filename,
      ext: attachment.ext ?? undefined,
      mimeType: attachment.mimeType,
      size: attachment.size,
      storage: attachment.storage,
      path: attachment.path ?? undefined,
      url: attachment.url ?? undefined,
      objectKey: attachment.objectKey ?? undefined,
      hash: attachment.hash ?? undefined,
      width: attachment.width ?? undefined,
      height: attachment.height ?? undefined,
      duration: attachment.duration ?? undefined,
      metadata: (attachment.metadata ?? undefined) as Record<string, unknown> | undefined,
      status: attachment.status.toString(),
      creatorId: attachment.creatorId ?? undefined,
      creatorName: attachment.creatorName ?? undefined,
      createdAt: dateUtils.formatISO(attachment.createdAt)!,
      updaterId: attachment.updaterId ?? undefined,
      updaterName: attachment.updaterName ?? undefined,
      updatedAt: dateUtils.formatISO(attachment.updatedAt)!,
    };
  }

  static toAttachmentDetailResp(attachment: AttachmentDetailRow): SysAttachmentResp {
    return this.toAttachmentListResp(attachment as unknown as AttachmentListRow);
  }
}
