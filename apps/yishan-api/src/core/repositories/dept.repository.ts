/**
 * 部门数据访问 Repository
 */

import {
  aliasedTable,
  and,
  asc,
  desc,
  eq,
  getTableColumns,
  isNull,
  like,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { drizzleDb, type AppQueryDb } from "@/db";
import { sysDept, sysUser } from "@/db/schema";
import { dateUtils } from "../../utils/date.js";

// ============================================================================
// Internal Input Types
// ============================================================================

type DeptPersistedFields = Pick<
  typeof sysDept.$inferInsert,
  "name" | "parentId" | "status" | "sortOrder" | "description" | "leaderId"
>;

/** Service 已完成认证、校验和 API DTO 到持久化输入的转换。 */
export interface CreateDeptInput extends DeptPersistedFields {
  creatorId: number;
  updaterId: number;
}

/** `undefined` 表示不更新。 */
export interface UpdateDeptInput extends Partial<DeptPersistedFields> {
  updaterId: number;
}

// ============================================================================
// Query Result Types
// ============================================================================

type DeptRow = typeof sysDept.$inferSelect;
type PublicDeptRow = Omit<DeptRow, "deletedAt" | "version">;

interface DeptFlatRow extends PublicDeptRow {
  parentName: string | null;
  leaderName: string | null;
  creatorName: string | null;
  updaterName: string | null;
}

// ============================================================================
// Internal Helpers
// ============================================================================

function sqlCount() {
  return sql<number>`count(*)`;
}

const { deletedAt: _deletedAt, version: _version, ...deptPublicColumns } = getTableColumns(sysDept);

const DEPT_ORDER_COLUMNS = {
  sortOrder: sysDept.sortOrder,
  createdAt: sysDept.createdAt,
  updatedAt: sysDept.updatedAt,
} as const;
type DeptOrderBy = keyof typeof DEPT_ORDER_COLUMNS;
const DEFAULT_DEPT_ORDER_BY: DeptOrderBy = "sortOrder";

function resolveDeptOrderColumn(sortBy: string | undefined) {
  if (sortBy && sortBy in DEPT_ORDER_COLUMNS) {
    return DEPT_ORDER_COLUMNS[sortBy as DeptOrderBy];
  }
  return DEPT_ORDER_COLUMNS[DEFAULT_DEPT_ORDER_BY];
}

function buildDeptWhere(opts: { keyword?: string; status?: number; parentId?: number }): SQL | undefined {
  const conds: SQL[] = [isNull(sysDept.deletedAt)];
  if (opts.keyword) {
    const like_ = `%${opts.keyword}%`;
    conds.push(or(like(sysDept.name, like_), like(sysDept.description, like_))!);
  }
  if (opts.status !== undefined) conds.push(eq(sysDept.status, opts.status));
  if (opts.parentId !== undefined) conds.push(eq(sysDept.parentId, opts.parentId));
  return and(...conds);
}

async function fetchDeptDetail(id: number, db: AppQueryDb = drizzleDb): Promise<DeptFlatRow | null> {
  const parentDept = aliasedTable(sysDept, "parent_dept");
  const leaderUser = aliasedTable(sysUser, "leader_user");
  const creatorUser = aliasedTable(sysUser, "creator_user");
  const updaterUser = aliasedTable(sysUser, "updater_user");

  const [dept] = await db
    .select({
      ...deptPublicColumns,
      parentName: parentDept.name,
      leaderName: leaderUser.username,
      creatorName: creatorUser.username,
      updaterName: updaterUser.username,
    })
    .from(sysDept)
    .leftJoin(parentDept, eq(parentDept.id, sysDept.parentId))
    .leftJoin(leaderUser, eq(leaderUser.id, sysDept.leaderId))
    .leftJoin(creatorUser, eq(creatorUser.id, sysDept.creatorId))
    .leftJoin(updaterUser, eq(updaterUser.id, sysDept.updaterId))
    .where(and(eq(sysDept.id, id), isNull(sysDept.deletedAt)))
    .limit(1);

  return dept as DeptFlatRow | null;
}

// ============================================================================
// Repository
// ============================================================================

export class DeptRepository {
  /** 获取部门列表 */
  static async list(query: { page?: number; pageSize?: number; keyword?: string; status?: number; parentId?: number; sortBy?: string; sortOrder?: string } = {}): Promise<DeptFlatRow[]> {
    const { page = 1, pageSize = 10, keyword, status, parentId, sortBy, sortOrder = "asc" } = query;
    const where = buildDeptWhere({ keyword, status, parentId });
    const dir = sortOrder === "asc" ? asc : desc;
    const orderCol = resolveDeptOrderColumn(sortBy);

    const parentDept = aliasedTable(sysDept, "parent_dept");
    const leaderUser = aliasedTable(sysUser, "leader_user");
    const creatorUser = aliasedTable(sysUser, "creator_user");
    const updaterUser = aliasedTable(sysUser, "updater_user");

    const baseQuery = drizzleDb
      .select({
        ...deptPublicColumns,
        parentName: parentDept.name,
        leaderName: leaderUser.username,
        creatorName: creatorUser.username,
        updaterName: updaterUser.username,
      })
      .from(sysDept)
      .leftJoin(parentDept, eq(parentDept.id, sysDept.parentId))
      .leftJoin(leaderUser, eq(leaderUser.id, sysDept.leaderId))
      .leftJoin(creatorUser, eq(creatorUser.id, sysDept.creatorId))
      .leftJoin(updaterUser, eq(updaterUser.id, sysDept.updaterId))
      .where(where)
      .orderBy(dir(orderCol));

    const depts = pageSize > 0
      ? await baseQuery.limit(pageSize).offset((page - 1) * pageSize)
      : await baseQuery;
    return depts as DeptFlatRow[];
  }

  /** 获取部门总数 */
  static async count(query: { keyword?: string; status?: number; parentId?: number } = {}): Promise<number> {
    const where = buildDeptWhere(query);
    const [row] = await drizzleDb.select({ c: sqlCount() }).from(sysDept).where(where);
    return Number(row?.c ?? 0);
  }

  /** 根据ID获取部门 */
  static async findById(id: number, db: AppQueryDb = drizzleDb): Promise<DeptFlatRow | null> {
    return fetchDeptDetail(id, db);
  }

  /** 根据名称获取部门（用于唯一性校验） */
  static async findByName(name: string): Promise<DeptRow | null> {
    const [row] = await drizzleDb
      .select()
      .from(sysDept)
      .where(and(isNull(sysDept.deletedAt), eq(sysDept.name, name)))
      .limit(1);
    return row ?? null;
  }

  /** 创建部门 */
  static async create(input: CreateDeptInput, db: AppQueryDb = drizzleDb): Promise<DeptFlatRow> {
    const { creatorId, updaterId, ...fields } = input;
    const now = dateUtils.now();

    const [inserted] = await db
      .insert(sysDept)
      .values({
        ...fields,
        creatorId,
        updaterId,
        createdAt: now,
        updatedAt: now,
      })
      .$returningId();

    const created = await fetchDeptDetail(inserted.id, db);
    if (!created) throw new Error("Failed to read back created dept");
    return created;
  }

  /** 更新部门 */
  static async update(id: number, input: UpdateDeptInput, db: AppQueryDb = drizzleDb): Promise<DeptFlatRow> {
    const { updaterId, ...fields } = input;

    await db
      .update(sysDept)
      .set({ ...fields, updaterId, updatedAt: dateUtils.now() })
      .where(and(eq(sysDept.id, id), isNull(sysDept.deletedAt)));

    const updated = await fetchDeptDetail(id, db);
    if (!updated) throw new Error("Failed to read back updated dept");
    return updated;
  }

  /** 软删除部门 */
  static async softDelete(id: number, db: AppQueryDb = drizzleDb): Promise<{ id: number } | null> {
    const [existing] = await db
      .select({ id: sysDept.id })
      .from(sysDept)
      .where(and(eq(sysDept.id, id), isNull(sysDept.deletedAt)))
      .limit(1);
    if (!existing) return null;

    const now = dateUtils.now();
    await db
      .update(sysDept)
      .set({ deletedAt: now, status: 0, updatedAt: now })
      .where(eq(sysDept.id, id));

    return { id };
  }

  /** 获取部门树 */
  static async getDeptTree(rootId?: number | null): Promise<DeptFlatRow[]> {
    const parentDept = aliasedTable(sysDept, "parent_dept");
    const leaderUser = aliasedTable(sysUser, "leader_user");
    const creatorUser = aliasedTable(sysUser, "creator_user");
    const updaterUser = aliasedTable(sysUser, "updater_user");

    const depts = await drizzleDb
      .select({
        ...deptPublicColumns,
        parentName: parentDept.name,
        leaderName: leaderUser.username,
        creatorName: creatorUser.username,
        updaterName: updaterUser.username,
      })
      .from(sysDept)
      .leftJoin(parentDept, eq(parentDept.id, sysDept.parentId))
      .leftJoin(leaderUser, eq(leaderUser.id, sysDept.leaderId))
      .leftJoin(creatorUser, eq(creatorUser.id, sysDept.creatorId))
      .leftJoin(updaterUser, eq(updaterUser.id, sysDept.updaterId))
      .where(isNull(sysDept.deletedAt))
      .orderBy(asc(sysDept.sortOrder));

    return depts as DeptFlatRow[];
  }


}
