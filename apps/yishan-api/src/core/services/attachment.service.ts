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
import { createHash, randomUUID } from "crypto";
import { lookup } from "dns/promises";
import { promises as fs } from "fs";
import { extname, join } from "path";
import { isIP } from "net";
import { STORAGE_CONFIG } from "../../config/index.js";

const REMOTE_IMAGE_MAX_SIZE = 10 * 1024 * 1024;
const REMOTE_IMAGE_TIMEOUT = 15_000;
const REMOTE_IMAGE_MAX_REDIRECTS = 3;

const isPrivateIp = (address: string) => {
  if (isIP(address) === 4) {
    const [first, second] = address.split(".").map(Number);
    return first === 10 || first === 127 || first === 0 || first >= 224 ||
      (first === 169 && second === 254) || (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168);
  }
  const normalized = address.toLowerCase();
  return normalized === "::1" || normalized === "::" || normalized.startsWith("fc") ||
    normalized.startsWith("fd") || normalized.startsWith("fe80:");
};

const assertPublicImageUrl = async (rawUrl: string) => {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new BusinessError(ValidationErrorCode.INVALID_PARAMETER, "图片链接格式不正确");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new BusinessError(ValidationErrorCode.INVALID_PARAMETER, "图片链接仅支持 HTTP 或 HTTPS");
  }
  if (url.username || url.password) {
    throw new BusinessError(ValidationErrorCode.INVALID_PARAMETER, "图片链接不能包含账号信息");
  }
  const addresses = await lookup(url.hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateIp(address))) {
    throw new BusinessError(ValidationErrorCode.INVALID_PARAMETER, "图片链接不能指向内网地址");
  }
  return url;
};

const readResponseBody = async (response: Response) => {
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > REMOTE_IMAGE_MAX_SIZE) {
    throw new BusinessError(ValidationErrorCode.INVALID_PARAMETER, "图片不能超过 10MB");
  }
  if (!response.body) throw new BusinessError(ValidationErrorCode.INVALID_PARAMETER, "图片内容为空");

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > REMOTE_IMAGE_MAX_SIZE) {
      await reader.cancel();
      throw new BusinessError(ValidationErrorCode.INVALID_PARAMETER, "图片不能超过 10MB");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks, size);
};

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

  static async importRemoteImages(
    urls: string[],
    folderId: number | null | undefined,
    currentUserId: number
  ) {
    if (folderId && !(await AttachmentRepository.getFolderById(folderId))) {
      throw new BusinessError(AttachmentErrorCode.FOLDER_NOT_FOUND, "分组不存在");
    }
    return await Promise.all(urls.map((url) => this.importRemoteImage(url, folderId, currentUserId)));
  }

  private static async importRemoteImage(
    rawUrl: string,
    folderId: number | null | undefined,
    currentUserId: number
  ) {
    let url = await assertPublicImageUrl(rawUrl);
    let response: Response | undefined;
    for (let redirectCount = 0; redirectCount <= REMOTE_IMAGE_MAX_REDIRECTS; redirectCount += 1) {
      response = await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(REMOTE_IMAGE_TIMEOUT),
        headers: { Accept: "image/*" },
      });
      if (![301, 302, 303, 307, 308].includes(response.status)) break;
      const location = response.headers.get("location");
      if (!location) throw new BusinessError(ValidationErrorCode.INVALID_PARAMETER, "图片链接重定向无效");
      url = await assertPublicImageUrl(new URL(location, url).toString());
    }
    if (!response || [301, 302, 303, 307, 308].includes(response.status)) {
      throw new BusinessError(ValidationErrorCode.INVALID_PARAMETER, "图片链接重定向次数过多");
    }
    if (!response.ok) throw new BusinessError(ValidationErrorCode.INVALID_PARAMETER, "图片链接无法访问");

    const mimeType = response.headers.get("content-type")?.split(";", 1)[0].toLowerCase() || "";
    if (!mimeType.startsWith("image/")) {
      throw new BusinessError(ValidationErrorCode.INVALID_PARAMETER, "链接不是图片资源");
    }
    const content = await readResponseBody(response);
    const hash = createHash("md5").update(content).digest("hex");
    const existing = await this.getAttachmentByHash(hash, "local");
    if (existing) return existing;

    const sourceName = decodeURIComponent(url.pathname.split("/").pop() || "image");
    const ext = extname(sourceName) || this.getImageExtension(mimeType);
    const originalName = `${sourceName.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/\.[^.]*$/, "") || "image"}${ext}`;
    const filename = `${randomUUID().replace(/-/g, "")}${ext}`;
    const uploadRoot = join(process.cwd(), STORAGE_CONFIG.uploadDir);
    await fs.mkdir(uploadRoot, { recursive: true });
    const filepath = join(uploadRoot, filename);
    await fs.writeFile(filepath, content);

    const uploadDirNormalized = STORAGE_CONFIG.uploadDir.replace(/\\/g, "/").replace(/^\/+/, "");
    const urlBase = uploadDirNormalized.startsWith("public/")
      ? `/${uploadDirNormalized.slice("public/".length)}`
      : `/${uploadDirNormalized}`;
    const urlPath = `${urlBase}/${filename}`.replace(/\/+/g, "/");

    try {
      return await this.createLocalAttachment(
        {
          folderId,
          kind: "image",
          originalName,
          filename,
          ext,
          mimeType,
          size: content.length,
          path: urlPath,
          url: urlPath,
          hash,
          metadata: { sourceUrl: rawUrl },
        },
        currentUserId
      );
    } catch (error) {
      await fs.unlink(filepath).catch(() => undefined);
      throw error;
    }
  }

  private static getImageExtension(mimeType: string) {
    const extensions: Record<string, string> = {
      "image/jpeg": ".jpg",
      "image/png": ".png",
      "image/gif": ".gif",
      "image/webp": ".webp",
      "image/svg+xml": ".svg",
      "image/avif": ".avif",
    };
    return extensions[mimeType] || ".img";
  }
}
