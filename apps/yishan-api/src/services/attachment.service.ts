import { SysAttachmentModel } from "../models/sys-attachment.model.js";
import { BusinessError } from "../exceptions/business-error.js";
import { AttachmentErrorCode } from "../constants/business-codes/attachment.js";
import { ValidationErrorCode } from "../constants/business-codes/validation.js";
import {
  AttachmentFolderListQuery,
  AttachmentListQuery,
  CreateAttachmentFolderReq,
  SysAttachmentFolderResp,
  SysAttachmentResp,
  UpdateAttachmentFolderReq,
  UpdateAttachmentReq,
} from "../schemas/attachment.js";

export class AttachmentService {
  private static guessKindByMimeType(mimeType: string): SysAttachmentResp["kind"] {
    if (mimeType.startsWith("image/")) return "image";
    if (mimeType.startsWith("audio/")) return "audio";
    if (mimeType.startsWith("video/")) return "video";
    return "other";
  }

  static async getFolderList(query: AttachmentFolderListQuery) {
    const list = await SysAttachmentModel.getFolderList(query);
    const total = await SysAttachmentModel.getFolderTotal(query);
    return { list, total, page: query.page || 1, pageSize: query.pageSize || 10 };
  }

  static async getFolderTree(rootId?: number | null) {
    return await SysAttachmentModel.getFolderTree(rootId);
  }

  static async getFolderById(id: number): Promise<SysAttachmentFolderResp | null> {
    return await SysAttachmentModel.getFolderById(id);
  }

  static async createFolder(
    req: CreateAttachmentFolderReq,
    currentUserId: number
  ): Promise<SysAttachmentFolderResp> {
    const parentId = req.parentId && req.parentId > 0 ? req.parentId : null;
    if (parentId !== null) {
      const parent = await SysAttachmentModel.getFolderById(parentId);
      if (!parent) {
        throw new BusinessError(AttachmentErrorCode.FOLDER_NOT_FOUND, "分组不存在");
      }
    }
    const conflict = await SysAttachmentModel.getFolderByParentAndName(parentId, req.name);
    if (conflict) {
      throw new BusinessError(AttachmentErrorCode.FOLDER_ALREADY_EXISTS, "分组已存在");
    }
    return await SysAttachmentModel.createFolder(req, currentUserId);
  }

  static async updateFolder(
    id: number,
    req: UpdateAttachmentFolderReq,
    currentUserId: number
  ): Promise<SysAttachmentFolderResp> {
    const existing = await SysAttachmentModel.getFolderById(id);
    if (!existing) {
      throw new BusinessError(AttachmentErrorCode.FOLDER_NOT_FOUND, "分组不存在");
    }

    const nextName = req.name ?? existing.name;
    const nextParentIdRaw = req.parentId ?? existing.parentId ?? 0;
    if (req.parentId !== undefined && req.parentId === id) {
      throw new BusinessError(ValidationErrorCode.INVALID_PARAMETER, "父分组不能是自己");
    }
    const nextParentId = nextParentIdRaw > 0 ? nextParentIdRaw : null;
    if (nextParentId !== null) {
      const parent = await SysAttachmentModel.getFolderById(nextParentId);
      if (!parent) {
        throw new BusinessError(AttachmentErrorCode.FOLDER_NOT_FOUND, "分组不存在");
      }
    }
    const conflict = await SysAttachmentModel.getFolderByParentAndName(nextParentId, nextName);
    if (conflict && conflict.id !== id) {
      throw new BusinessError(AttachmentErrorCode.FOLDER_ALREADY_EXISTS, "分组已存在");
    }

    return await SysAttachmentModel.updateFolder(id, req, currentUserId);
  }

  static async deleteFolder(
    id: number,
    currentUserId: number
  ): Promise<{ id: number }> {
    const existing = await SysAttachmentModel.getFolderById(id);
    if (!existing) {
      throw new BusinessError(AttachmentErrorCode.FOLDER_NOT_FOUND, "分组不存在");
    }

    const [childCount, attachmentCount] = await Promise.all([
      SysAttachmentModel.countFolderChildren(id),
      SysAttachmentModel.countFolderAttachments(id),
    ]);

    if (childCount > 0 || attachmentCount > 0) {
      throw new BusinessError(
        AttachmentErrorCode.FOLDER_DELETE_FORBIDDEN,
        "分组下存在子分组或素材，禁止删除"
      );
    }

    const res = await SysAttachmentModel.deleteFolder(id, currentUserId);
    if (!res) {
      throw new BusinessError(AttachmentErrorCode.FOLDER_NOT_FOUND, "分组不存在");
    }
    return res;
  }

  static async getAttachmentList(query: AttachmentListQuery) {
    const list = await SysAttachmentModel.getAttachmentList(query);
    const total = await SysAttachmentModel.getAttachmentTotal(query);
    return { list, total, page: query.page || 1, pageSize: query.pageSize || 10 };
  }

  static async getAttachmentById(id: number): Promise<SysAttachmentResp | null> {
    return await SysAttachmentModel.getAttachmentById(id);
  }

  static async getAttachmentByHash(
    hash: string,
    storage?: string
  ): Promise<SysAttachmentResp | null> {
    return await SysAttachmentModel.getAttachmentByHash(hash, storage);
  }

  static async updateAttachment(
    id: number,
    req: UpdateAttachmentReq,
    currentUserId: number
  ): Promise<SysAttachmentResp> {
    const existing = await SysAttachmentModel.getAttachmentById(id);
    if (!existing) {
      throw new BusinessError(AttachmentErrorCode.ATTACHMENT_NOT_FOUND, "素材不存在");
    }
    if (req.folderId !== undefined && req.folderId !== null && req.folderId > 0) {
      const folder = await SysAttachmentModel.getFolderById(req.folderId);
      if (!folder) {
        throw new BusinessError(AttachmentErrorCode.FOLDER_NOT_FOUND, "分组不存在");
      }
    }
    return await SysAttachmentModel.updateAttachment(id, req, currentUserId);
  }

  static async deleteAttachment(
    id: number,
    currentUserId: number
  ): Promise<{ id: number }> {
    const res = await SysAttachmentModel.deleteAttachment(id, currentUserId);
    if (!res) {
      throw new BusinessError(AttachmentErrorCode.ATTACHMENT_NOT_FOUND, "素材不存在");
    }
    return res;
  }

  static async deleteAttachments(
    ids: number[],
    currentUserId: number
  ): Promise<{ ids: number[] }> {
    const uniqueIds = Array.from(new Set(ids)).filter((id) => Number.isInteger(id) && id > 0);
    if (uniqueIds.length === 0) {
      throw new BusinessError(ValidationErrorCode.INVALID_PARAMETER, "素材ID列表不能为空");
    }
    return await SysAttachmentModel.deleteAttachments(uniqueIds, currentUserId);
  }

  static async createLocalAttachment(
    input: {
      folderId?: number | null;
      kind?: SysAttachmentResp["kind"];
      name?: string | null;
      originalName: string;
      filename: string;
      ext?: string | null;
      mimeType: string;
      size: number;
      path?: string | null;
      url?: string | null;
      hash?: string | null;
      metadata?: any | null;
    },
    currentUserId: number
  ): Promise<SysAttachmentResp> {
    if (input.folderId !== undefined && input.folderId !== null && input.folderId > 0) {
      const folder = await SysAttachmentModel.getFolderById(input.folderId);
      if (!folder) {
        throw new BusinessError(AttachmentErrorCode.FOLDER_NOT_FOUND, "分组不存在");
      }
    }

    const kind = input.kind ?? this.guessKindByMimeType(input.mimeType);

    return await SysAttachmentModel.createAttachment(
      {
        folderId: input.folderId ?? null,
        kind,
        name: input.name ?? null,
        originalName: input.originalName,
        filename: input.filename,
        ext: input.ext ?? null,
        mimeType: input.mimeType,
        size: input.size,
        storage: "local",
        path: input.path ?? null,
        url: input.url ?? null,
        hash: input.hash ?? null,
        metadata: (input.metadata as any) ?? null,
      },
      currentUserId
    );
  }
}
