import { prismaManager } from "../utils/prisma.js";
import type { Prisma } from "../generated/prisma/client.js";
import {
  AttachmentFolderListQuery,
  AttachmentListQuery,
  CreateAttachmentFolderReq,
  SysAttachmentFolderResp,
  SysAttachmentResp,
  UpdateAttachmentFolderReq,
  UpdateAttachmentReq,
} from "../schemas/attachment.js";
import { dateUtils } from "../utils/date.js";

type FolderWithRelations = Prisma.SysAttachmentFolderGetPayload<{
  include: {
    creator: { select: { username: true } };
    updater: { select: { username: true } };
  };
}> & { creatorName?: string; updaterName?: string };

type AttachmentWithRelations = Prisma.SysAttachmentGetPayload<{
  include: {
    folder: { select: { id: true; name: true } };
    creator: { select: { username: true } };
    updater: { select: { username: true } };
  };
}> & { creatorName?: string; updaterName?: string; folderName?: string };

const folderKindFromDb = (kind: number): SysAttachmentFolderResp["kind"] => {
  switch (kind) {
    case 0:
      return "all";
    case 1:
      return "image";
    case 2:
      return "audio";
    case 3:
      return "video";
    default:
      return "other";
  }
};

const folderKindToDb = (kind?: SysAttachmentFolderResp["kind"]): number => {
  switch (kind) {
    case "all":
    case undefined:
      return 0;
    case "image":
      return 1;
    case "audio":
      return 2;
    case "video":
      return 3;
    default:
      return 4;
  }
};

const attachmentKindFromDb = (kind: number): SysAttachmentResp["kind"] => {
  switch (kind) {
    case 1:
      return "image";
    case 2:
      return "audio";
    case 3:
      return "video";
    default:
      return "other";
  }
};

const attachmentKindToDb = (kind?: SysAttachmentResp["kind"]): number => {
  switch (kind) {
    case "image":
      return 1;
    case "audio":
      return 2;
    case "video":
      return 3;
    default:
      return 4;
  }
};

const normalizeRootParentId = (parentId?: number | null): number | null => {
  if (parentId == null) return null;
  if (parentId <= 0) return null;
  return parentId;
};

const normalizeFolderId = (folderId?: number | null): number | null => {
  if (folderId == null) return null;
  if (folderId <= 0) return null;
  return folderId;
};

export class SysAttachmentModel {
  private static prisma = prismaManager.getClient();

  private static mapFolderToResp(
    folder: FolderWithRelations
  ): SysAttachmentFolderResp {
    return {
      id: folder.id,
      name: folder.name,
      parentId: folder.parentId ?? 0,
      kind: folderKindFromDb(folder.kind),
      status: folder.status.toString(),
      sort_order: folder.sort_order ?? 0,
      remark: folder.remark ?? undefined,
      creatorId: folder.creatorId ?? undefined,
      creatorName: folder.creator?.username ?? folder.creatorName,
      createdAt: dateUtils.formatISO(folder.createdAt)!,
      updaterId: folder.updaterId ?? undefined,
      updaterName: folder.updater?.username ?? folder.updaterName,
      updatedAt: dateUtils.formatISO(folder.updatedAt)!,
      children: undefined,
    };
  }

  private static mapAttachmentToResp(
    a: AttachmentWithRelations
  ): SysAttachmentResp {
    return {
      id: a.id,
      folderId: a.folderId ?? undefined,
      folderName: a.folder?.name ?? a.folderName ?? undefined,
      kind: attachmentKindFromDb(a.kind),
      name: a.name ?? undefined,
      originalName: a.originalName,
      filename: a.filename,
      ext: a.ext ?? undefined,
      mimeType: a.mimeType,
      size: a.size,
      storage: a.storage,
      path: a.path ?? undefined,
      url: a.url ?? undefined,
      objectKey: a.objectKey ?? undefined,
      hash: a.hash ?? undefined,
      width: a.width ?? undefined,
      height: a.height ?? undefined,
      duration: a.duration ?? undefined,
      metadata: (a.metadata as any) ?? undefined,
      status: a.status.toString(),
      creatorId: a.creatorId ?? undefined,
      creatorName: a.creator?.username ?? a.creatorName,
      createdAt: dateUtils.formatISO(a.createdAt)!,
      updaterId: a.updaterId ?? undefined,
      updaterName: a.updater?.username ?? a.updaterName,
      updatedAt: dateUtils.formatISO(a.updatedAt)!,
    };
  }

  static async getFolderByParentAndName(
    parentId: number | null,
    name: string
  ) {
    return await this.prisma.sysAttachmentFolder.findFirst({
      where: { deletedAt: null, parentId, name },
    });
  }

  static async getFolderList(
    query: AttachmentFolderListQuery
  ): Promise<SysAttachmentFolderResp[]> {
    const {
      page = 1,
      pageSize = 10,
      keyword,
      kind,
      status,
      parentId,
      sortBy = "sort_order",
      sortOrder = "asc",
    } = query;

    const where: any = { deletedAt: null };

    if (keyword) {
      where.name = { contains: keyword };
    }

    if (kind !== undefined) {
      where.kind = folderKindToDb(kind as any);
    }

    if (status !== undefined) {
      where.status = parseInt(status as string, 10);
    }

    if (parentId !== undefined) {
      where.parentId = normalizeRootParentId(parentId);
    }

    const orderBy: any = {};
    orderBy[sortBy] = sortOrder;

    const list = await this.prisma.sysAttachmentFolder.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        creator: { select: { username: true } },
        updater: { select: { username: true } },
      },
    });

    return list.map((f) => this.mapFolderToResp(f));
  }

  static async getFolderTotal(query: AttachmentFolderListQuery): Promise<number> {
    const { keyword, kind, status, parentId } = query;
    const where: any = { deletedAt: null };
    if (keyword) where.name = { contains: keyword };
    if (kind !== undefined) where.kind = folderKindToDb(kind as any);
    if (status !== undefined) where.status = parseInt(status as string, 10);
    if (parentId !== undefined) where.parentId = normalizeRootParentId(parentId);
    return await this.prisma.sysAttachmentFolder.count({ where });
  }

  static async getFolderById(id: number): Promise<SysAttachmentFolderResp | null> {
    const folder = await this.prisma.sysAttachmentFolder.findFirst({
      where: { id, deletedAt: null },
      include: {
        creator: { select: { username: true } },
        updater: { select: { username: true } },
      },
    });
    if (!folder) return null;
    return this.mapFolderToResp(folder);
  }

  static async getFolderTree(
    rootId?: number | null
  ): Promise<(SysAttachmentFolderResp & { children?: any[] })[]> {
    const folders = await this.prisma.sysAttachmentFolder.findMany({
      where: { deletedAt: null },
      orderBy: [{ sort_order: "asc" }, { createdAt: "asc" }],
      include: {
        creator: { select: { username: true } },
        updater: { select: { username: true } },
      },
    });

    const nodeMap = new Map<number, SysAttachmentFolderResp & { children?: any[] }>();
    const roots: (SysAttachmentFolderResp & { children?: any[] })[] = [];

    for (const f of folders) {
      const node = { ...this.mapFolderToResp(f), children: undefined as any[] | undefined };
      nodeMap.set(f.id, node);
    }

    for (const f of folders) {
      const node = nodeMap.get(f.id)!;
      const pid = f.parentId ?? null;
      const isRootMatch = rootId === undefined ? pid === null : pid === (rootId ?? null);
      if (isRootMatch) {
        roots.push(node);
      } else if (pid !== null) {
        const parentNode = nodeMap.get(pid);
        if (parentNode) {
          if (!parentNode.children) parentNode.children = [];
          parentNode.children.push(node);
        }
      }
    }

    return roots;
  }

  static async createFolder(
    req: CreateAttachmentFolderReq,
    currentUserId: number
  ): Promise<SysAttachmentFolderResp> {
    const created = await this.prisma.sysAttachmentFolder.create({
      data: {
        name: req.name,
        parentId: normalizeRootParentId(req.parentId),
        kind: folderKindToDb(req.kind as any),
        status: req.status ? parseInt(req.status, 10) : 1,
        sort_order: req.sort_order ?? 0,
        remark: req.remark ?? null,
        creatorId: currentUserId,
        updaterId: currentUserId,
      },
      include: {
        creator: { select: { username: true } },
        updater: { select: { username: true } },
      },
    });
    return this.mapFolderToResp(created);
  }

  static async updateFolder(
    id: number,
    req: UpdateAttachmentFolderReq,
    currentUserId: number
  ): Promise<SysAttachmentFolderResp> {
    const data: any = { updaterId: currentUserId };
    if (req.name !== undefined) data.name = req.name;
    if (req.parentId !== undefined) data.parentId = normalizeRootParentId(req.parentId);
    if (req.kind !== undefined) data.kind = folderKindToDb(req.kind as any);
    if (req.status !== undefined) data.status = parseInt(req.status, 10);
    if (req.sort_order !== undefined) data.sort_order = req.sort_order;
    if (req.remark !== undefined) data.remark = req.remark ?? null;

    const updated = await this.prisma.sysAttachmentFolder.update({
      where: { id, deletedAt: null },
      data,
      include: {
        creator: { select: { username: true } },
        updater: { select: { username: true } },
      },
    });
    return this.mapFolderToResp(updated);
  }

  static async countFolderChildren(id: number): Promise<number> {
    return await this.prisma.sysAttachmentFolder.count({
      where: { parentId: id, deletedAt: null },
    });
  }

  static async countFolderAttachments(id: number): Promise<number> {
    return await this.prisma.sysAttachment.count({
      where: { folderId: id, deletedAt: null },
    });
  }

  static async deleteFolder(
    id: number,
    currentUserId: number
  ): Promise<{ id: number } | null> {
    const existing = await this.prisma.sysAttachmentFolder.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) return null;

    await this.prisma.sysAttachmentFolder.update({
      where: { id },
      data: { deletedAt: new Date(), status: 0, updaterId: currentUserId },
    });

    return { id };
  }

  static async getAttachmentList(
    query: AttachmentListQuery
  ): Promise<SysAttachmentResp[]> {
    const {
      page = 1,
      pageSize = 10,
      keyword,
      kind,
      folderId,
      mimeType,
      storage,
      status,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = query;

    const where: any = { deletedAt: null };

    if (keyword) {
      where.OR = [
        { name: { contains: keyword } },
        { originalName: { contains: keyword } },
      ];
    }

    if (kind !== undefined) {
      where.kind = attachmentKindToDb(kind as any);
    }

    if (folderId !== undefined) {
      if (folderId === 0) where.folderId = null;
      else where.folderId = folderId;
    }

    if (mimeType) where.mimeType = { contains: mimeType };
    if (storage) where.storage = storage;
    if (status !== undefined) where.status = parseInt(status as string, 10);

    const orderBy: any = {};
    orderBy[sortBy] = sortOrder;

    const list = await this.prisma.sysAttachment.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        folder: { select: { id: true, name: true } },
        creator: { select: { username: true } },
        updater: { select: { username: true } },
      },
    });

    return list.map((a) => this.mapAttachmentToResp(a));
  }

  static async getAttachmentTotal(query: AttachmentListQuery): Promise<number> {
    const { keyword, kind, folderId, mimeType, storage, status } = query;
    const where: any = { deletedAt: null };
    if (keyword) {
      where.OR = [
        { name: { contains: keyword } },
        { originalName: { contains: keyword } },
      ];
    }
    if (kind !== undefined) where.kind = attachmentKindToDb(kind as any);
    if (folderId !== undefined) {
      if (folderId === 0) where.folderId = null;
      else where.folderId = folderId;
    }
    if (mimeType) where.mimeType = { contains: mimeType };
    if (storage) where.storage = storage;
    if (status !== undefined) where.status = parseInt(status as string, 10);
    return await this.prisma.sysAttachment.count({ where });
  }

  static async getAttachmentById(id: number): Promise<SysAttachmentResp | null> {
    const a = await this.prisma.sysAttachment.findFirst({
      where: { id, deletedAt: null },
      include: {
        folder: { select: { id: true, name: true } },
        creator: { select: { username: true } },
        updater: { select: { username: true } },
      },
    });
    if (!a) return null;
    return this.mapAttachmentToResp(a);
  }

  static async getAttachmentByHash(
    hash: string,
    storage = "local"
  ): Promise<SysAttachmentResp | null> {
    const a = await this.prisma.sysAttachment.findFirst({
      where: { hash, storage, deletedAt: null },
      include: {
        folder: { select: { id: true, name: true } },
        creator: { select: { username: true } },
        updater: { select: { username: true } },
      },
    });
    if (!a) return null;
    return this.mapAttachmentToResp(a);
  }

  static async createAttachment(
    input: {
      folderId?: number | null;
      kind?: SysAttachmentResp["kind"];
      name?: string | null;
      originalName: string;
      filename: string;
      ext?: string | null;
      mimeType: string;
      size: number;
      storage?: string;
      path?: string | null;
      url?: string | null;
      objectKey?: string | null;
      hash?: string | null;
      width?: number | null;
      height?: number | null;
      duration?: number | null;
      metadata?: any | null;
      status?: string | number;
    },
    currentUserId: number
  ): Promise<SysAttachmentResp> {
    const created = await this.prisma.sysAttachment.create({
      data: {
        folderId: normalizeFolderId(input.folderId),
        kind: attachmentKindToDb(input.kind as any),
        name: input.name ?? null,
        originalName: input.originalName,
        filename: input.filename,
        ext: input.ext ?? null,
        mimeType: input.mimeType,
        size: input.size,
        storage: input.storage ?? "local",
        path: input.path ?? null,
        url: input.url ?? null,
        objectKey: input.objectKey ?? null,
        hash: input.hash ?? null,
        width: input.width ?? null,
        height: input.height ?? null,
        duration: input.duration ?? null,
        metadata: (input.metadata as any) ?? null,
        status: input.status !== undefined ? parseInt(input.status as any, 10) : 1,
        creatorId: currentUserId,
        updaterId: currentUserId,
      },
      include: {
        folder: { select: { id: true, name: true } },
        creator: { select: { username: true } },
        updater: { select: { username: true } },
      },
    });
    return this.mapAttachmentToResp(created);
  }

  static async updateAttachment(
    id: number,
    req: UpdateAttachmentReq,
    currentUserId: number
  ): Promise<SysAttachmentResp> {
    const data: any = { updaterId: currentUserId };
    if (req.name !== undefined) data.name = req.name ?? null;
    if (req.folderId !== undefined) data.folderId = normalizeFolderId(req.folderId as any);
    if (req.status !== undefined) data.status = parseInt(req.status, 10);
    if (req.metadata !== undefined) data.metadata = (req.metadata as any) ?? null;

    const updated = await this.prisma.sysAttachment.update({
      where: { id, deletedAt: null },
      data,
      include: {
        folder: { select: { id: true, name: true } },
        creator: { select: { username: true } },
        updater: { select: { username: true } },
      },
    });
    return this.mapAttachmentToResp(updated);
  }

  static async deleteAttachment(
    id: number,
    currentUserId: number
  ): Promise<{ id: number } | null> {
    const existing = await this.prisma.sysAttachment.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) return null;

    await this.prisma.sysAttachment.update({
      where: { id },
      data: { deletedAt: new Date(), status: 0, updaterId: currentUserId },
    });

    return { id };
  }

  static async deleteAttachments(
    ids: number[],
    currentUserId: number
  ): Promise<{ ids: number[] }> {
    const uniqueIds = Array.from(new Set(ids)).filter((id) => Number.isInteger(id) && id > 0);
    if (uniqueIds.length === 0) return { ids: [] };

    const existing = await this.prisma.sysAttachment.findMany({
      where: { id: { in: uniqueIds }, deletedAt: null },
      select: { id: true },
    });
    const existingIds = existing.map((x) => x.id);
    if (existingIds.length === 0) return { ids: [] };

    await this.prisma.sysAttachment.updateMany({
      where: { id: { in: existingIds }, deletedAt: null },
      data: { deletedAt: new Date(), status: 0, updaterId: currentUserId },
    });

    return { ids: existingIds };
  }
}
