/**
 * 附件数据访问 Repository
 */

import {
  aliasedTable,
  and,
  asc,
  desc,
  eq,
  getTableColumns,
  inArray,
  isNull,
  like,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { drizzleDb, type AppQueryDb } from "@/db";
import { sysAttachment, sysAttachmentFolder, sysUser } from "@/db/schema";
import { dateUtils } from "../../utils/date.js";

// ============================================================================
// Internal Input Types
// ============================================================================

type FolderPersistedFields = Pick<
  typeof sysAttachmentFolder.$inferInsert,
  "name" | "parentId" | "kind" | "status" | "sortOrder" | "remark"
>;

export interface CreateFolderInput extends FolderPersistedFields {
  creatorId: number;
  updaterId: number;
}

export interface UpdateFolderInput extends Partial<FolderPersistedFields> {
  updaterId: number;
}

type AttachmentPersistedFields = Pick<
  typeof sysAttachment.$inferInsert,
  "folderId" | "kind" | "name" | "originalName" | "filename" | "ext" | "mimeType" | "size" | "storage" | "path" | "url" | "objectKey" | "hash" | "width" | "height" | "duration" | "metadata" | "status"
>;

export interface CreateAttachmentInput extends AttachmentPersistedFields {
  creatorId: number;
  updaterId: number;
}

export interface UpdateAttachmentInput extends Partial<Pick<AttachmentPersistedFields, "name" | "folderId" | "status" | "metadata">> {
  updaterId: number;
}

// ============================================================================
// Query Result Types
// ============================================================================

export type FolderRow = typeof sysAttachmentFolder.$inferSelect;
export type PublicFolderRow = Omit<FolderRow, "deletedAt" | "version">;

export interface FolderListRow extends PublicFolderRow {
  creatorName: string | null;
  updaterName: string | null;
}

export interface FolderDetailRow extends FolderListRow {}

export type AttachmentRow = typeof sysAttachment.$inferSelect;
export type PublicAttachmentRow = Omit<AttachmentRow, "deletedAt" | "version">;

export interface AttachmentListRow extends PublicAttachmentRow {
  folderName: string | null;
  creatorName: string | null;
  updaterName: string | null;
}

export interface AttachmentDetailRow extends AttachmentListRow {}

/** Tree node shape used by `getFolderTree` / `buildFolderTree`. */
export type FolderTreeNode = FolderListRow & { children: FolderTreeNode[] | null };

// ============================================================================
// Internal Helpers
// ============================================================================

function sqlCount() {
  return sql<number>`count(*)`;
}

const { deletedAt: _fDeletedAt, version: _fVersion, ...folderPublicColumns } = getTableColumns(sysAttachmentFolder);
const { deletedAt: _aDeletedAt, version: _aVersion, ...attachmentPublicColumns } = getTableColumns(sysAttachment);

const ATTACHMENT_FOLDER_ORDER_COLUMNS = {
  sortOrder: sysAttachmentFolder.sortOrder,
  createdAt: sysAttachmentFolder.createdAt,
  updatedAt: sysAttachmentFolder.updatedAt,
} as const;
type AttachmentFolderOrderBy = keyof typeof ATTACHMENT_FOLDER_ORDER_COLUMNS;
const DEFAULT_ATTACHMENT_FOLDER_ORDER_BY: AttachmentFolderOrderBy = "sortOrder";

function resolveAttachmentFolderOrderColumn(sortBy: string | undefined) {
  if (sortBy && sortBy in ATTACHMENT_FOLDER_ORDER_COLUMNS) {
    return ATTACHMENT_FOLDER_ORDER_COLUMNS[sortBy as AttachmentFolderOrderBy];
  }
  return ATTACHMENT_FOLDER_ORDER_COLUMNS[DEFAULT_ATTACHMENT_FOLDER_ORDER_BY];
}

const ATTACHMENT_ORDER_COLUMNS = {
  createdAt: sysAttachment.createdAt,
  size: sysAttachment.size,
  updatedAt: sysAttachment.updatedAt,
} as const;
type AttachmentOrderBy = keyof typeof ATTACHMENT_ORDER_COLUMNS;
const DEFAULT_ATTACHMENT_ORDER_BY: AttachmentOrderBy = "createdAt";

function resolveAttachmentOrderColumn(sortBy: string | undefined) {
  if (sortBy && sortBy in ATTACHMENT_ORDER_COLUMNS) {
    return ATTACHMENT_ORDER_COLUMNS[sortBy as AttachmentOrderBy];
  }
  return ATTACHMENT_ORDER_COLUMNS[DEFAULT_ATTACHMENT_ORDER_BY];
}

const normalizeRootParentId = (parentId?: number | null): number | null => {
  if (parentId == null) return null;
  if (parentId <= 0) return null;
  return parentId;
};

function buildFolderWhere(opts: {
  keyword?: string;
  kind?: number;
  status?: number;
  parentId?: number | null;
}): SQL | undefined {
  const conds: SQL[] = [isNull(sysAttachmentFolder.deletedAt)];
  if (opts.keyword) conds.push(like(sysAttachmentFolder.name, `%${opts.keyword}%`));
  if (opts.kind !== undefined) conds.push(eq(sysAttachmentFolder.kind, opts.kind));
  if (opts.status !== undefined) conds.push(eq(sysAttachmentFolder.status, opts.status));
  if (opts.parentId !== undefined) {
    conds.push(opts.parentId === null ? isNull(sysAttachmentFolder.parentId) : eq(sysAttachmentFolder.parentId, opts.parentId));
  }
  return and(...conds);
}

function buildAttachmentWhere(opts: {
  keyword?: string;
  kind?: number;
  folderId?: number | null;
  mimeType?: string;
  storage?: string;
  status?: number;
}): SQL | undefined {
  const conds: SQL[] = [isNull(sysAttachment.deletedAt)];
  if (opts.keyword) {
    const like_ = `%${opts.keyword}%`;
    conds.push(or(like(sysAttachment.name, like_), like(sysAttachment.originalName, like_))!);
  }
  if (opts.kind !== undefined) conds.push(eq(sysAttachment.kind, opts.kind));
  if (opts.folderId !== undefined) {
    conds.push(opts.folderId === null ? isNull(sysAttachment.folderId) : eq(sysAttachment.folderId, opts.folderId));
  }
  if (opts.mimeType) conds.push(like(sysAttachment.mimeType, `%${opts.mimeType}%`));
  if (opts.storage) conds.push(eq(sysAttachment.storage, opts.storage));
  if (opts.status !== undefined) conds.push(eq(sysAttachment.status, opts.status));
  return and(...conds);
}

async function fetchFolderDetail(id: number, db: AppQueryDb = drizzleDb): Promise<FolderDetailRow | null> {
  const creatorUser = aliasedTable(sysUser, "creator_user");
  const updaterUser = aliasedTable(sysUser, "updater_user");

  const [row] = await db
    .select({
      ...folderPublicColumns,
      creatorName: creatorUser.username,
      updaterName: updaterUser.username,
    })
    .from(sysAttachmentFolder)
    .leftJoin(creatorUser, eq(creatorUser.id, sysAttachmentFolder.creatorId))
    .leftJoin(updaterUser, eq(updaterUser.id, sysAttachmentFolder.updaterId))
    .where(and(eq(sysAttachmentFolder.id, id), isNull(sysAttachmentFolder.deletedAt)))
    .limit(1);

  return row ? (row as FolderDetailRow) : null;
}

async function fetchAttachmentDetail(id: number, db: AppQueryDb = drizzleDb): Promise<AttachmentDetailRow | null> {
  const folderAlias = aliasedTable(sysAttachmentFolder, "folder_rel");
  const creatorUser = aliasedTable(sysUser, "creator_user");
  const updaterUser = aliasedTable(sysUser, "updater_user");

  const [row] = await db
    .select({
      ...attachmentPublicColumns,
      folderName: folderAlias.name,
      creatorName: creatorUser.username,
      updaterName: updaterUser.username,
    })
    .from(sysAttachment)
    .leftJoin(folderAlias, eq(folderAlias.id, sysAttachment.folderId))
    .leftJoin(creatorUser, eq(creatorUser.id, sysAttachment.creatorId))
    .leftJoin(updaterUser, eq(updaterUser.id, sysAttachment.updaterId))
    .where(and(eq(sysAttachment.id, id), isNull(sysAttachment.deletedAt)))
    .limit(1);

  return row ? (row as AttachmentDetailRow) : null;
}

// ============================================================================
// Repository
// ============================================================================

export class AttachmentRepository {
  // -------------------------------------------------------------------------
  // Folder - New Standard Methods
  // -------------------------------------------------------------------------

  static async listFolders(query: { page?: number; pageSize?: number; keyword?: string; kind?: number; status?: number; parentId?: number | null; sortBy?: string; sortOrder?: string } = {}): Promise<FolderListRow[]> {
    const { page = 1, pageSize = 10, keyword, kind, status, parentId, sortBy, sortOrder = "asc" } = query;
    const where = buildFolderWhere({ keyword, kind, status, parentId: parentId !== undefined ? normalizeRootParentId(parentId) : undefined });
    const dir = sortOrder === "asc" ? asc : desc;
    const orderCol = resolveAttachmentFolderOrderColumn(sortBy);

    const creatorUser = aliasedTable(sysUser, "creator_user");
    const updaterUser = aliasedTable(sysUser, "updater_user");

    const baseQuery = drizzleDb
      .select({
        ...folderPublicColumns,
        creatorName: creatorUser.username,
        updaterName: updaterUser.username,
      })
      .from(sysAttachmentFolder)
      .leftJoin(creatorUser, eq(creatorUser.id, sysAttachmentFolder.creatorId))
      .leftJoin(updaterUser, eq(updaterUser.id, sysAttachmentFolder.updaterId))
      .where(where)
      .orderBy(dir(orderCol));

    const folders = pageSize > 0
      ? await baseQuery.limit(pageSize).offset((page - 1) * pageSize)
      : await baseQuery;
    return folders as FolderListRow[];
  }

  static async countFolders(query: { keyword?: string; kind?: number; status?: number; parentId?: number | null } = {}): Promise<number> {
    const where = buildFolderWhere({
      keyword: query.keyword,
      kind: query.kind,
      status: query.status,
      parentId: query.parentId !== undefined ? normalizeRootParentId(query.parentId) : undefined,
    });
    const [row] = await drizzleDb.select({ c: sqlCount() }).from(sysAttachmentFolder).where(where);
    return Number(row?.c ?? 0);
  }

  static async findFolderById(id: number, db: AppQueryDb = drizzleDb): Promise<FolderDetailRow | null> {
    return fetchFolderDetail(id, db);
  }

  static async findFolderByParentAndName(parentId: number | null, name: string, db: AppQueryDb = drizzleDb): Promise<FolderRow | null> {
    const parentCond = parentId === null ? isNull(sysAttachmentFolder.parentId) : eq(sysAttachmentFolder.parentId, parentId);
    const [row] = await db
      .select()
      .from(sysAttachmentFolder)
      .where(and(isNull(sysAttachmentFolder.deletedAt), parentCond, eq(sysAttachmentFolder.name, name)))
      .limit(1);
    return row ?? null;
  }

  static async createFolder(input: CreateFolderInput, db: AppQueryDb = drizzleDb): Promise<FolderDetailRow> {
    const { creatorId, updaterId, ...fields } = input;
    const now = dateUtils.now();

    const [inserted] = await db
      .insert(sysAttachmentFolder)
      .values({
        ...fields,
        creatorId,
        updaterId,
        createdAt: now,
        updatedAt: now,
      })
      .$returningId();

    const folder = await fetchFolderDetail(inserted.id, db);
    if (!folder) throw new Error("Failed to read back created folder");
    return folder;
  }

  static async updateFolder(id: number, input: UpdateFolderInput, db: AppQueryDb = drizzleDb): Promise<FolderDetailRow> {
    const { updaterId, ...fields } = input;

    await db
      .update(sysAttachmentFolder)
      .set({ ...fields, updatedAt: dateUtils.now() })
      .where(and(eq(sysAttachmentFolder.id, id), isNull(sysAttachmentFolder.deletedAt)));

    const folder = await fetchFolderDetail(id, db);
    if (!folder) throw new Error("Failed to read back updated folder");
    return folder;
  }

  static async countFolderChildren(id: number, db: AppQueryDb = drizzleDb): Promise<number> {
    const [row] = await db
      .select({ c: sqlCount() })
      .from(sysAttachmentFolder)
      .where(and(eq(sysAttachmentFolder.parentId, id), isNull(sysAttachmentFolder.deletedAt)));
    return Number(row?.c ?? 0);
  }

  static async countFolderAttachments(id: number, db: AppQueryDb = drizzleDb): Promise<number> {
    const [row] = await db
      .select({ c: sqlCount() })
      .from(sysAttachment)
      .where(and(eq(sysAttachment.folderId, id), isNull(sysAttachment.deletedAt)));
    return Number(row?.c ?? 0);
  }

  static async softDeleteFolder(id: number, db: AppQueryDb = drizzleDb): Promise<FolderRow | null> {
    const [existing] = await db
      .select({ id: sysAttachmentFolder.id })
      .from(sysAttachmentFolder)
      .where(and(eq(sysAttachmentFolder.id, id), isNull(sysAttachmentFolder.deletedAt)))
      .limit(1);
    if (!existing) return null;

    await db
      .update(sysAttachmentFolder)
      .set({ deletedAt: dateUtils.now(), status: 0, updatedAt: dateUtils.now() })
      .where(eq(sysAttachmentFolder.id, id));

    const [deleted] = await db
      .select()
      .from(sysAttachmentFolder)
      .where(eq(sysAttachmentFolder.id, id))
      .limit(1);
    return deleted ?? null;
  }

  static async listAllFoldersForTree(db: AppQueryDb = drizzleDb): Promise<FolderListRow[]> {
    const creatorUser = aliasedTable(sysUser, "creator_user");
    const updaterUser = aliasedTable(sysUser, "updater_user");

    const folders = await db
      .select({
        ...folderPublicColumns,
        creatorName: creatorUser.username,
        updaterName: updaterUser.username,
      })
      .from(sysAttachmentFolder)
      .leftJoin(creatorUser, eq(creatorUser.id, sysAttachmentFolder.creatorId))
      .leftJoin(updaterUser, eq(updaterUser.id, sysAttachmentFolder.updaterId))
      .where(isNull(sysAttachmentFolder.deletedAt))
      .orderBy(asc(sysAttachmentFolder.sortOrder));

    return folders as FolderListRow[];
  }

  // -------------------------------------------------------------------------
  // Attachment - New Standard Methods
  // -------------------------------------------------------------------------

  static async listAttachments(query: { page?: number; pageSize?: number; keyword?: string; kind?: number; folderId?: number | null; mimeType?: string; storage?: string; status?: number; sortBy?: string; sortOrder?: string } = {}): Promise<AttachmentListRow[]> {
    const { page = 1, pageSize = 10, keyword, kind, folderId, mimeType, storage, status, sortBy, sortOrder = "desc" } = query;
    const where = buildAttachmentWhere({ keyword, kind, folderId: folderId === 0 ? null : folderId, mimeType, storage, status });
    const dir = sortOrder === "asc" ? asc : desc;
    const orderCol = resolveAttachmentOrderColumn(sortBy);

    const folderAlias = aliasedTable(sysAttachmentFolder, "folder_rel");
    const creatorUser = aliasedTable(sysUser, "creator_user");
    const updaterUser = aliasedTable(sysUser, "updater_user");

    const baseQuery = drizzleDb
      .select({
        ...attachmentPublicColumns,
        folderName: folderAlias.name,
        creatorName: creatorUser.username,
        updaterName: updaterUser.username,
      })
      .from(sysAttachment)
      .leftJoin(folderAlias, eq(folderAlias.id, sysAttachment.folderId))
      .leftJoin(creatorUser, eq(creatorUser.id, sysAttachment.creatorId))
      .leftJoin(updaterUser, eq(updaterUser.id, sysAttachment.updaterId))
      .where(where)
      .orderBy(dir(orderCol));

    const attachments = pageSize > 0
      ? await baseQuery.limit(pageSize).offset((page - 1) * pageSize)
      : await baseQuery;
    return attachments as AttachmentListRow[];
  }

  static async countAttachments(query: { keyword?: string; kind?: number; folderId?: number | null; mimeType?: string; storage?: string; status?: number } = {}): Promise<number> {
    const where = buildAttachmentWhere({
      keyword: query.keyword,
      kind: query.kind,
      folderId: query.folderId === 0 ? null : query.folderId,
      mimeType: query.mimeType,
      storage: query.storage,
      status: query.status,
    });
    const [row] = await drizzleDb.select({ c: sqlCount() }).from(sysAttachment).where(where);
    return Number(row?.c ?? 0);
  }

  static async findAttachmentById(id: number, db: AppQueryDb = drizzleDb): Promise<AttachmentDetailRow | null> {
    return fetchAttachmentDetail(id, db);
  }

  static async findAttachmentByHash(hash: string, storage = "local", db: AppQueryDb = drizzleDb): Promise<AttachmentRow | null> {
    const [row] = await db
      .select()
      .from(sysAttachment)
      .where(and(eq(sysAttachment.hash, hash), eq(sysAttachment.storage, storage), isNull(sysAttachment.deletedAt)))
      .limit(1);
    return row ?? null;
  }

  static async createAttachment(input: CreateAttachmentInput, db: AppQueryDb = drizzleDb): Promise<AttachmentDetailRow> {
    const { creatorId, updaterId, ...fields } = input;
    const now = dateUtils.now();

    const [inserted] = await db
      .insert(sysAttachment)
      .values({
        ...fields,
        creatorId,
        updaterId,
        createdAt: now,
        updatedAt: now,
      })
      .$returningId();

    const attachment = await fetchAttachmentDetail(inserted.id, db);
    if (!attachment) throw new Error("Failed to read back created attachment");
    return attachment;
  }

  static async updateAttachment(id: number, input: UpdateAttachmentInput, db: AppQueryDb = drizzleDb): Promise<AttachmentDetailRow> {
    const { updaterId, ...fields } = input;

    await db
      .update(sysAttachment)
      .set({ ...fields, updatedAt: dateUtils.now() })
      .where(and(eq(sysAttachment.id, id), isNull(sysAttachment.deletedAt)));

    const attachment = await fetchAttachmentDetail(id, db);
    if (!attachment) throw new Error("Failed to read back updated attachment");
    return attachment;
  }

  static async softDeleteAttachment(id: number, db: AppQueryDb = drizzleDb): Promise<AttachmentRow | null> {
    const [existing] = await db
      .select({ id: sysAttachment.id })
      .from(sysAttachment)
      .where(and(eq(sysAttachment.id, id), isNull(sysAttachment.deletedAt)))
      .limit(1);
    if (!existing) return null;

    await db
      .update(sysAttachment)
      .set({ deletedAt: dateUtils.now(), status: 0, updatedAt: dateUtils.now() })
      .where(eq(sysAttachment.id, id));

    const [deleted] = await db
      .select()
      .from(sysAttachment)
      .where(eq(sysAttachment.id, id))
      .limit(1);
    return deleted ?? null;
  }

  static async softDeleteAttachments(ids: number[], db: AppQueryDb = drizzleDb): Promise<{ ids: number[] }> {
    const uniqueIds = Array.from(new Set(ids)).filter((id) => Number.isInteger(id) && id > 0);
    if (uniqueIds.length === 0) return { ids: [] };

    const existingRows = await db
      .select({ id: sysAttachment.id })
      .from(sysAttachment)
      .where(and(inArray(sysAttachment.id, uniqueIds), isNull(sysAttachment.deletedAt)));
    const existingIds = existingRows.map((r) => r.id);
    if (existingIds.length === 0) return { ids: [] };

    await db
      .update(sysAttachment)
      .set({ deletedAt: dateUtils.now(), status: 0, updatedAt: dateUtils.now() })
      .where(and(inArray(sysAttachment.id, existingIds), isNull(sysAttachment.deletedAt)));

    return { ids: existingIds };
  }

  // -------------------------------------------------------------------------
  // Compatibility Aliases
  // -------------------------------------------------------------------------

  static async getFolderByParentAndName(parentId: number | null, name: string): Promise<FolderRow | null> {
    return this.findFolderByParentAndName(parentId, name);
  }

  static async getFolderList(query: { keyword?: string; kind?: string; status?: string | number; parentId?: number | null; page?: number; pageSize?: number; sortBy?: string; sortOrder?: string } = {}) {
    return this.listFolders({
      ...query,
      kind: query.kind !== undefined ? (query.kind === "all" ? 0 : query.kind === "image" ? 1 : query.kind === "audio" ? 2 : query.kind === "video" ? 3 : 4) : undefined,
      status: query.status !== undefined ? (typeof query.status === "string" ? parseInt(query.status, 10) : query.status) : undefined,
    });
  }

  static async getFolderTotal(query: { keyword?: string; kind?: string; status?: string | number; parentId?: number | null } = {}): Promise<number> {
    return this.countFolders({
      ...query,
      kind: query.kind !== undefined ? (query.kind === "all" ? 0 : query.kind === "image" ? 1 : query.kind === "audio" ? 2 : query.kind === "video" ? 3 : 4) : undefined,
      status: query.status !== undefined ? (typeof query.status === "string" ? parseInt(query.status, 10) : query.status) : undefined,
    });
  }

  static async getFolderById(id: number): Promise<FolderDetailRow | null> {
    return this.findFolderById(id);
  }

  static async getFolderTree(rootId?: number | null): Promise<FolderTreeNode[]> {
    const folders = await this.listAllFoldersForTree();
    return buildFolderTree(folders, rootId);
  }

  static async createFolderLegacy(input: CreateFolderInput, db: AppQueryDb = drizzleDb): Promise<FolderDetailRow> {
    return this.createFolder(input, db);
  }

  static async updateFolderLegacy(id: number, input: UpdateFolderInput, db: AppQueryDb = drizzleDb): Promise<FolderDetailRow> {
    return this.updateFolder(id, input, db);
  }

  static async deleteFolder(id: number, db: AppQueryDb = drizzleDb): Promise<{ id: number } | null> {
    const res = await this.softDeleteFolder(id, db);
    return res ? { id: res.id } : null;
  }

  static async getAttachmentList(query: { keyword?: string; kind?: string; folderId?: number | null; mimeType?: string; storage?: string; status?: string | number; page?: number; pageSize?: number; sortBy?: string; sortOrder?: string } = {}) {
    return this.listAttachments({
      ...query,
      kind: query.kind !== undefined ? (query.kind === "image" ? 1 : query.kind === "audio" ? 2 : query.kind === "video" ? 3 : 4) : undefined,
      status: query.status !== undefined ? (typeof query.status === "string" ? parseInt(query.status, 10) : query.status) : undefined,
    });
  }

  static async getAttachmentTotal(query: { keyword?: string; kind?: string; folderId?: number | null; mimeType?: string; storage?: string; status?: string | number } = {}): Promise<number> {
    return this.countAttachments({
      ...query,
      kind: query.kind !== undefined ? (query.kind === "image" ? 1 : query.kind === "audio" ? 2 : query.kind === "video" ? 3 : 4) : undefined,
      status: query.status !== undefined ? (typeof query.status === "string" ? parseInt(query.status, 10) : query.status) : undefined,
    });
  }

  static async getAttachmentById(id: number): Promise<AttachmentDetailRow | null> {
    return this.findAttachmentById(id);
  }

  static async getAttachmentByHash(hash: string, storage = "local"): Promise<AttachmentRow | null> {
    return this.findAttachmentByHash(hash, storage);
  }

  static async createAttachmentLegacy(input: CreateAttachmentInput, db: AppQueryDb = drizzleDb): Promise<AttachmentDetailRow> {
    return this.createAttachment(input, db);
  }

  static async updateAttachmentLegacy(id: number, input: UpdateAttachmentInput, db: AppQueryDb = drizzleDb): Promise<AttachmentDetailRow> {
    return this.updateAttachment(id, input, db);
  }

  static async deleteAttachment(id: number, db: AppQueryDb = drizzleDb): Promise<{ id: number } | null> {
    const res = await this.softDeleteAttachment(id, db);
    return res ? { id: res.id } : null;
  }

  static async deleteAttachments(ids: number[], db: AppQueryDb = drizzleDb): Promise<{ ids: number[] }> {
    return this.softDeleteAttachments(ids, db);
  }
}

/** 构建文件夹树的辅助函数 */
function buildFolderTree(folders: FolderListRow[], rootId?: number | null): FolderTreeNode[] {
  const nodeMap = new Map<number, FolderTreeNode>();
  const roots: FolderTreeNode[] = [];

  // 先创建所有节点
  for (const folder of folders) {
    const node: FolderTreeNode = { ...folder, children: null };
    nodeMap.set(folder.id, node);
  }

  // 然后构建父子关系
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

  return roots;
}
