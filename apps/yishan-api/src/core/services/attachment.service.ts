import {
  AttachmentRepository,
  CreateFolderInput,
  UpdateFolderInput,
  CreateAttachmentInput,
  UpdateAttachmentInput,
  type FolderTreeNode,
} from "../repositories/attachment.repository.js";
import { AttachmentMapper, folderKindToDb } from "../mappers/attachment.mapper.js";
import { BusinessError } from "../../exceptions/business-error.js";
import { AttachmentErrorCode } from "../../constants/business-codes/attachment.js";
import { ValidationErrorCode } from "../../constants/business-codes/validation.js";
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
  private static kindStrToNum(kind?: SysAttachmentResp["kind"]): number {
    switch (kind) {
      case "image": return 1;
      case "audio": return 2;
      case "video": return 3;
      default: return 4;
    }
  }

  private static guessKindByMimeType(mimeType: string): SysAttachmentResp["kind"] {
    if (mimeType.startsWith("image/")) return "image";
    if (mimeType.startsWith("audio/")) return "audio";
    if (mimeType.startsWith("video/")) return "video";
    return "other";
  }

  static async getFolderList(query: AttachmentFolderListQuery) {
    const list = await AttachmentRepository.getFolderList(query);
    const total = await AttachmentRepository.getFolderTotal(query);
    return { list: list.map(AttachmentMapper.toFolderListResp), total, page: query.page || 1, pageSize: query.pageSize || 10 };
  }

  /** Recursively map a FolderTreeNode (raw row + nested children) into a Resp DTO. */
  private static folderTreeNodeToResp(node: FolderTreeNode): SysAttachmentFolderResp {
    const base = AttachmentMapper.toFolderDetailResp(node);
    return {
      ...base,
      children: node.children
        ? node.children.map(AttachmentService.folderTreeNodeToResp)
        : undefined,
    };
  }

  static async getFolderTree(rootId?: number | null): Promise<SysAttachmentFolderResp[]> {
    const folders = await AttachmentRepository.listAllFoldersForTree();
    const nodeMap = new Map<number, FolderTreeNode>();
    const roots: FolderTreeNode[] = [];

    for (const folder of folders) {
      const node: FolderTreeNode = { ...folder, children: null };
      nodeMap.set(folder.id, node);
    }

    for (const folder of folders) {
      const node = nodeMap.get(folder.id)!;
      const pid = folder.parentId ?? null;
      const isRootMatch = rootId === undefined ? pid === null : pid === (rootId ?? null);
      if (isRootMatch) {
        roots.push(node);
      } else if (pid !== null) {
        const parentNode = nodeMap.get(pid);
        if (parentNode) {
          if (parentNode.children === null) parentNode.children = [];
          parentNode.children.push(node);
        }
      }
    }

    return roots.map(AttachmentService.folderTreeNodeToResp);
  }

  static async getFolderById(id: number): Promise<SysAttachmentFolderResp | null> {
    const folder = await AttachmentRepository.getFolderById(id);
    return folder ? AttachmentMapper.toFolderDetailResp(folder) : null;
  }

  static async createFolder(
    req: CreateAttachmentFolderReq,
    currentUserId: number
  ): Promise<SysAttachmentFolderResp> {
    const parentId = req.parentId && req.parentId > 0 ? req.parentId : null;
    if (parentId !== null) {
      const parent = await AttachmentRepository.getFolderById(parentId);
      if (!parent) {
        throw new BusinessError(AttachmentErrorCode.FOLDER_NOT_FOUND, "分组不存在");
      }
    }
    const conflict = await AttachmentRepository.getFolderByParentAndName(parentId, req.name);
    if (conflict) {
      throw new BusinessError(AttachmentErrorCode.FOLDER_ALREADY_EXISTS, "分组已存在");
    }

    const input: CreateFolderInput = {
      name: req.name,
      parentId: parentId,
      kind: folderKindToDb(req.kind ?? "all"),
      status: req.status ? parseInt(req.status, 10) : 1,
      sortOrder: req.sort_order ?? 0,
      remark: req.remark ?? null,
      creatorId: currentUserId,
      updaterId: currentUserId,
    };

    const folder = await AttachmentRepository.createFolder(input);
    return AttachmentMapper.toFolderDetailResp(folder);
  }

  static async updateFolder(
    id: number,
    req: UpdateAttachmentFolderReq,
    currentUserId: number
  ): Promise<SysAttachmentFolderResp> {
    const existing = await AttachmentRepository.getFolderById(id);
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
      const parent = await AttachmentRepository.getFolderById(nextParentId);
      if (!parent) {
        throw new BusinessError(AttachmentErrorCode.FOLDER_NOT_FOUND, "分组不存在");
      }
    }
    const conflict = await AttachmentRepository.getFolderByParentAndName(nextParentId, nextName);
    if (conflict && conflict.id !== id) {
      throw new BusinessError(AttachmentErrorCode.FOLDER_ALREADY_EXISTS, "分组已存在");
    }

    const input: UpdateFolderInput = {
      updaterId: currentUserId,
    };
    if (req.name !== undefined) input.name = req.name;
    if (req.parentId !== undefined) input.parentId = nextParentId;
    if (req.kind !== undefined) input.kind = folderKindToDb(req.kind);
    if (req.status !== undefined) input.status = parseInt(req.status, 10);
    if (req.sort_order !== undefined) input.sortOrder = req.sort_order;
    if (req.remark !== undefined) input.remark = req.remark ?? null;

    const folder = await AttachmentRepository.updateFolder(id, input);
    return AttachmentMapper.toFolderDetailResp(folder);
  }

  static async deleteFolder(
    id: number,
    currentUserId: number
  ): Promise<{ id: number }> {
    const existing = await AttachmentRepository.getFolderById(id);
    if (!existing) {
      throw new BusinessError(AttachmentErrorCode.FOLDER_NOT_FOUND, "分组不存在");
    }

    const [childCount, attachmentCount] = await Promise.all([
      AttachmentRepository.countFolderChildren(id),
      AttachmentRepository.countFolderAttachments(id),
    ]);

    if (childCount > 0 || attachmentCount > 0) {
      throw new BusinessError(
        AttachmentErrorCode.FOLDER_DELETE_FORBIDDEN,
        "分组下存在子分组或素材，禁止删除"
      );
    }

    const res = await AttachmentRepository.deleteFolder(id);
    if (!res) {
      throw new BusinessError(AttachmentErrorCode.FOLDER_NOT_FOUND, "分组不存在");
    }
    return res;
  }

  static async getAttachmentList(query: AttachmentListQuery) {
    const list = await AttachmentRepository.getAttachmentList(query);
    const total = await AttachmentRepository.getAttachmentTotal(query);
    return { list: list.map(AttachmentMapper.toAttachmentListResp), total, page: query.page || 1, pageSize: query.pageSize || 10 };
  }

  static async getAttachmentById(id: number): Promise<SysAttachmentResp | null> {
    const attachment = await AttachmentRepository.getAttachmentById(id);
    return attachment ? AttachmentMapper.toAttachmentDetailResp(attachment) : null;
  }

  static async getAttachmentByHash(
    hash: string,
    storage?: string
  ): Promise<SysAttachmentResp | null> {
    const row = await AttachmentRepository.getAttachmentByHash(hash, storage);
    if (!row) return null;
    const attachment = await AttachmentRepository.getAttachmentById(row.id);
    return attachment ? AttachmentMapper.toAttachmentDetailResp(attachment) : null;
  }

  static async updateAttachment(
    id: number,
    req: UpdateAttachmentReq,
    currentUserId: number
  ): Promise<SysAttachmentResp> {
    const existing = await AttachmentRepository.getAttachmentById(id);
    if (!existing) {
      throw new BusinessError(AttachmentErrorCode.ATTACHMENT_NOT_FOUND, "素材不存在");
    }
    if (req.folderId !== undefined && req.folderId !== null && req.folderId > 0) {
      const folder = await AttachmentRepository.getFolderById(req.folderId);
      if (!folder) {
        throw new BusinessError(AttachmentErrorCode.FOLDER_NOT_FOUND, "分组不存在");
      }
    }

    const input: UpdateAttachmentInput = {
      updaterId: currentUserId,
    };
    if (req.name !== undefined) input.name = req.name ?? null;
    if (req.folderId !== undefined) input.folderId = req.folderId;
    if (req.status !== undefined) input.status = parseInt(req.status, 10);
    if (req.metadata !== undefined) input.metadata = req.metadata as Record<string, unknown> ?? null;

    const attachment = await AttachmentRepository.updateAttachment(id, input);
    return AttachmentMapper.toAttachmentDetailResp(attachment);
  }

  static async deleteAttachment(
    id: number,
    currentUserId: number
  ): Promise<{ id: number }> {
    const res = await AttachmentRepository.deleteAttachment(id);
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
    return await AttachmentRepository.deleteAttachments(uniqueIds);
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
      metadata?: Record<string, unknown> | null;
    },
    currentUserId: number
  ): Promise<SysAttachmentResp> {
    if (input.folderId !== undefined && input.folderId !== null && input.folderId > 0) {
      const folder = await AttachmentRepository.getFolderById(input.folderId);
      if (!folder) {
        throw new BusinessError(AttachmentErrorCode.FOLDER_NOT_FOUND, "分组不存在");
      }
    }

    const kindStr = input.kind ?? this.guessKindByMimeType(input.mimeType);

    const createInput: CreateAttachmentInput = {
      folderId: input.folderId ?? null,
      kind: this.kindStrToNum(kindStr),
      name: input.name ?? null,
      originalName: input.originalName,
      filename: input.filename,
      ext: input.ext ?? null,
      mimeType: input.mimeType,
      size: input.size,
      storage: "local",
      path: input.path ?? null,
      url: input.url ?? null,
      objectKey: null,
      hash: input.hash ?? null,
      width: null,
      height: null,
      duration: null,
      metadata: input.metadata ?? null,
      status: 1,
      creatorId: currentUserId,
      updaterId: currentUserId,
    };

    const attachment = await AttachmentRepository.createAttachment(createInput);
    return AttachmentMapper.toAttachmentDetailResp(attachment);
  }

  static async createCloudAttachment(
    input: {
      folderId?: number | null;
      kind?: SysAttachmentResp["kind"];
      name?: string | null;
      originalName: string;
      filename: string;
      ext?: string | null;
      mimeType: string;
      size: number;
      storage: string;
      path?: string | null;
      url?: string | null;
      objectKey?: string | null;
      hash?: string | null;
      metadata?: Record<string, unknown> | null;
    },
    currentUserId: number
  ): Promise<SysAttachmentResp> {
    if (input.folderId !== undefined && input.folderId !== null && input.folderId > 0) {
      const folder = await AttachmentRepository.getFolderById(input.folderId);
      if (!folder) {
        throw new BusinessError(AttachmentErrorCode.FOLDER_NOT_FOUND, "分组不存在");
      }
    }

    const kindStr = input.kind ?? this.guessKindByMimeType(input.mimeType);

    if (input.hash) {
      const existing = await AttachmentRepository.getAttachmentByHash(input.hash, input.storage);
      if (existing) {
        const resp = await AttachmentRepository.getAttachmentById(existing.id);
        if (resp) return AttachmentMapper.toAttachmentDetailResp(resp);
      }
    }

    const createInput: CreateAttachmentInput = {
      folderId: input.folderId ?? null,
      kind: this.kindStrToNum(kindStr),
      name: input.name ?? null,
      originalName: input.originalName,
      filename: input.filename,
      ext: input.ext ?? null,
      mimeType: input.mimeType,
      size: input.size,
      storage: input.storage,
      path: input.path ?? null,
      url: input.url ?? null,
      objectKey: input.objectKey ?? null,
      hash: input.hash ?? null,
      width: null,
      height: null,
      duration: null,
      metadata: input.metadata ?? null,
      status: 1,
      creatorId: currentUserId,
      updaterId: currentUserId,
    };

    const attachment = await AttachmentRepository.createAttachment(createInput);
    return AttachmentMapper.toAttachmentDetailResp(attachment);
  }
}
