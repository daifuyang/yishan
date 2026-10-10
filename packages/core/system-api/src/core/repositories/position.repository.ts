/**
 * 岗位数据访问 Repository
 *
 * 注意：DB 表名 `sys_post` 保留历史命名（迁移成本过高），
 * 域模型使用 Position 命名以消除与论坛 post 的歧义。
 */

import { aliasedTable, and, asc, desc, eq, isNull, like, or, sql, type SQL } from "drizzle-orm";
import { drizzleDb, type AppQueryDb } from "@/db";
import { sysPost, sysUser } from "@/db/schema";
import { dateUtils } from "../../utils/date.js";
import { clampOffset } from "./_pagination.js";

// ============================================================================
// Types
// ============================================================================

export interface PositionListQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  status?: string | number;
  sortBy?: string;
  sortOrder?: string;
}

export interface PositionRow {
  id: number;
  name: string;
  status: number;
  sortOrder: number;
  description: string | null;
  creatorId: number | null;
  creatorName: string | null;
  createdAt: Date;
  updaterId: number | null;
  updaterName: string | null;
  updatedAt: Date;
}

export interface CreatePositionInput {
  name: string;
  status?: number;
  sortOrder?: number;
  description?: string | null;
  creatorId: number;
  updaterId: number;
}

export interface UpdatePositionInput {
  name?: string;
  status?: number;
  sortOrder?: number;
  description?: string | null;
  updaterId?: number;
}

// ============================================================================
// Helpers
// ============================================================================

function buildPositionWhere(opts: { keyword?: string; status?: number }): SQL | undefined {
  const conds: SQL[] = [isNull(sysPost.deletedAt)];
  if (opts.keyword) {
    const like_ = `%${opts.keyword}%`;
    conds.push(or(like(sysPost.name, like_), like(sysPost.description, like_))!);
  }
  if (opts.status !== undefined) conds.push(eq(sysPost.status, opts.status));
  return and(...conds);
}

const POSITION_ORDER_COLUMNS = {
  sortOrder: sysPost.sortOrder,
  createdAt: sysPost.createdAt,
  updatedAt: sysPost.updatedAt,
} as const;

function resolvePositionOrderColumn(sortBy: string | undefined) {
  if (sortBy && sortBy in POSITION_ORDER_COLUMNS) {
    return POSITION_ORDER_COLUMNS[sortBy as keyof typeof POSITION_ORDER_COLUMNS];
  }
  return POSITION_ORDER_COLUMNS.sortOrder;
}

function sqlCount() {
  return sql<number>`count(*)`
}

async function fetchPositionRowById(id: number, db: AppQueryDb = drizzleDb): Promise<PositionRow | null> {
  const creatorUser = aliasedTable(sysUser, "creator_user");
  const updaterUser = aliasedTable(sysUser, "updater_user");
  const [row] = await db
    .select({
      id: sysPost.id,
      name: sysPost.name,
      status: sysPost.status,
      sortOrder: sysPost.sortOrder,
      description: sysPost.description,
      creatorId: sysPost.creatorId,
      createdAt: sysPost.createdAt,
      updaterId: sysPost.updaterId,
      updatedAt: sysPost.updatedAt,
      creatorName: creatorUser.username,
      updaterName: updaterUser.username,
    })
    .from(sysPost)
    .leftJoin(creatorUser, eq(creatorUser.id, sysPost.creatorId))
    .leftJoin(updaterUser, eq(updaterUser.id, sysPost.updaterId))
    .where(and(eq(sysPost.id, id), isNull(sysPost.deletedAt)))
    .limit(1);
  return row ?? null;
}

// ============================================================================
// Repository
// ============================================================================

export class SysPositionRepository {
  static async list(query: PositionListQuery): Promise<{ rows: PositionRow[]; total: number }> {
    const { page = 1, pageSize = 10, keyword, status, sortBy = "sortOrder", sortOrder = "asc" } = query;
    const where = buildPositionWhere({
      keyword,
      status: status !== undefined ? (typeof status === "string" ? parseInt(status, 10) : status) : undefined,
    });
    const dir = sortOrder === "asc" ? asc : desc;
    const orderCol = resolvePositionOrderColumn(sortBy);

    const creatorUser = aliasedTable(sysUser, "creator_user");
    const updaterUser = aliasedTable(sysUser, "updater_user");
    const baseQuery = drizzleDb
      .select({
        id: sysPost.id,
        name: sysPost.name,
        status: sysPost.status,
        sortOrder: sysPost.sortOrder,
        description: sysPost.description,
        creatorId: sysPost.creatorId,
        createdAt: sysPost.createdAt,
        updaterId: sysPost.updaterId,
        updatedAt: sysPost.updatedAt,
        creatorName: creatorUser.username,
        updaterName: updaterUser.username,
      })
      .from(sysPost)
      .leftJoin(creatorUser, eq(creatorUser.id, sysPost.creatorId))
      .leftJoin(updaterUser, eq(updaterUser.id, sysPost.updaterId))
      .where(where)
      .orderBy(dir(orderCol));

    const [rows, totalRow] = await Promise.all([
      pageSize > 0 ? baseQuery.limit(pageSize).offset(clampOffset(page, pageSize)) : baseQuery,
      drizzleDb.select({ c: sqlCount() }).from(sysPost).where(where),
    ]);
    return { rows, total: Number(totalRow[0]?.c ?? 0) };
  }

  static async findById(id: number, db: AppQueryDb = drizzleDb): Promise<PositionRow | null> {
    return fetchPositionRowById(id, db);
  }

  static async findByName(name: string, excludeId?: number): Promise<PositionRow | null> {
    const conds: SQL[] = [eq(sysPost.name, name), isNull(sysPost.deletedAt)];
    if (excludeId !== undefined) conds.push(sql`${sysPost.id} != ${excludeId}`);
    const [row] = await drizzleDb
      .select({ id: sysPost.id })
      .from(sysPost)
      .where(and(...conds))
      .limit(1);
    if (!row) return null;
    return fetchPositionRowById(row.id);
  }

  static async create(input: CreatePositionInput, db: AppQueryDb = drizzleDb): Promise<PositionRow | null> {
    const [inserted] = await db
      .insert(sysPost)
      .values({
        name: input.name,
        status: input.status ?? 1,
        sortOrder: input.sortOrder ?? 0,
        description: input.description ?? null,
        creatorId: input.creatorId,
        updaterId: input.updaterId,
        createdAt: dateUtils.now(),
        updatedAt: dateUtils.now(),
        version: 1,
      })
      .$returningId();
    if (!inserted?.id) return null;
    return fetchPositionRowById(inserted.id, db);
  }

  static async update(id: number, input: UpdatePositionInput, db: AppQueryDb = drizzleDb): Promise<PositionRow | null> {
    const data: Partial<typeof sysPost.$inferInsert> = { updatedAt: dateUtils.now() };
    if (input.name !== undefined) data.name = input.name;
    if (input.status !== undefined) data.status = input.status;
    if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;
    if (input.description !== undefined) data.description = input.description ?? null;
    if (input.updaterId !== undefined) data.updaterId = input.updaterId;

    await db.update(sysPost).set(data).where(eq(sysPost.id, id));
    return fetchPositionRowById(id, db);
  }

  static async softDelete(id: number, db: AppQueryDb = drizzleDb): Promise<boolean> {
    const [existing] = await db
      .select({ id: sysPost.id })
      .from(sysPost)
      .where(and(eq(sysPost.id, id), isNull(sysPost.deletedAt)))
      .limit(1);
    if (!existing) return false;
    await db
      .update(sysPost)
      .set({ deletedAt: dateUtils.now() })
      .where(eq(sysPost.id, id));
    return true;
  }
}
