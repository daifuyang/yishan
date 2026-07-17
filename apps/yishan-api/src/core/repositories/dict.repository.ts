/**
 * 字典数据访问 Repository
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
import { sysDictData, sysDictType, sysUser } from "@/db/schema";
import { dateUtils } from "../../utils/date.js";

// ============================================================================
// Internal Input Types
// ============================================================================

type DictTypePersistedFields = Pick<
  typeof sysDictType.$inferInsert,
  "name" | "type" | "status" | "sortOrder" | "remark"
>;

export interface CreateDictTypeInput extends DictTypePersistedFields {
  creatorId: number;
  updaterId: number;
}

export interface UpdateDictTypeInput extends Partial<DictTypePersistedFields> {
  updaterId: number;
}

type DictDataPersistedFields = Pick<
  typeof sysDictData.$inferInsert,
  "typeId" | "label" | "value" | "status" | "sortOrder" | "tag" | "remark" | "isDefault"
>;

export interface CreateDictDataInput extends DictDataPersistedFields {
  creatorId: number;
  updaterId: number;
}

export interface UpdateDictDataInput extends Partial<DictDataPersistedFields> {
  updaterId: number;
}

// ============================================================================
// Query Result Types
// ============================================================================

type DictTypeRow = typeof sysDictType.$inferSelect;
type PublicDictTypeRow = Omit<DictTypeRow, "deletedAt" | "version">;

interface DictTypeListRow extends PublicDictTypeRow {
  creatorName: string | null;
  updaterName: string | null;
}

interface DictTypeDetailRow extends DictTypeListRow {}

type DictDataRow = typeof sysDictData.$inferSelect;
type PublicDictDataRow = Omit<DictDataRow, "deletedAt" | "version">;

interface DictDataListRow extends PublicDictDataRow {
  typeType: string | null;
  creatorName: string | null;
  updaterName: string | null;
}

interface DictDataDetailRow extends DictDataListRow {}

// ============================================================================
// Internal Helpers
// ============================================================================

function sqlCount() {
  return sql<number>`count(*)`;
}

const { deletedAt: _dtDeletedAt, version: _dtVersion, ...dictTypePublicColumns } = getTableColumns(sysDictType);
const { deletedAt: _ddDeletedAt, version: _ddVersion, ...dictDataPublicColumns } = getTableColumns(sysDictData);

const DICT_TYPE_ORDER_COLUMNS = {
  sortOrder: sysDictType.sortOrder,
  createdAt: sysDictType.createdAt,
  updatedAt: sysDictType.updatedAt,
} as const;
type DictTypeOrderBy = keyof typeof DICT_TYPE_ORDER_COLUMNS;
const DEFAULT_DICT_TYPE_ORDER_BY: DictTypeOrderBy = "sortOrder";

function resolveDictTypeOrderColumn(sortBy: string | undefined) {
  if (sortBy && sortBy in DICT_TYPE_ORDER_COLUMNS) {
    return DICT_TYPE_ORDER_COLUMNS[sortBy as DictTypeOrderBy];
  }
  return DICT_TYPE_ORDER_COLUMNS[DEFAULT_DICT_TYPE_ORDER_BY];
}

const DICT_DATA_ORDER_COLUMNS = {
  sortOrder: sysDictData.sortOrder,
  createdAt: sysDictData.createdAt,
  updatedAt: sysDictData.updatedAt,
} as const;
type DictDataOrderBy = keyof typeof DICT_DATA_ORDER_COLUMNS;
const DEFAULT_DICT_DATA_ORDER_BY: DictDataOrderBy = "sortOrder";

function resolveDictDataOrderColumn(sortBy: string | undefined) {
  if (sortBy && sortBy in DICT_DATA_ORDER_COLUMNS) {
    return DICT_DATA_ORDER_COLUMNS[sortBy as DictDataOrderBy];
  }
  return DICT_DATA_ORDER_COLUMNS[DEFAULT_DICT_DATA_ORDER_BY];
}

function buildTypeWhere(opts: { keyword?: string; status?: number }): SQL | undefined {
  const conds: SQL[] = [isNull(sysDictType.deletedAt)];
  if (opts.keyword) {
    const like_ = `%${opts.keyword}%`;
    conds.push(
      or(like(sysDictType.name, like_), like(sysDictType.type, like_), like(sysDictType.remark, like_))!,
    );
  }
  if (opts.status !== undefined) conds.push(eq(sysDictType.status, opts.status));
  return and(...conds);
}

function buildDataWhere(opts: {
  typeId?: number;
  keyword?: string;
  status?: number;
}): SQL | undefined {
  const conds: SQL[] = [isNull(sysDictData.deletedAt)];
  if (opts.typeId !== undefined) conds.push(eq(sysDictData.typeId, opts.typeId));
  if (opts.keyword) {
    const like_ = `%${opts.keyword}%`;
    conds.push(
      or(
        like(sysDictData.label, like_),
        like(sysDictData.value, like_),
        like(sysDictData.tag, like_),
        like(sysDictData.remark, like_),
      )!,
    );
  }
  if (opts.status !== undefined) conds.push(eq(sysDictData.status, opts.status));
  return and(...conds);
}

async function fetchDictTypeDetail(id: number, db: AppQueryDb = drizzleDb): Promise<DictTypeDetailRow | null> {
  const creatorUser = aliasedTable(sysUser, "creator_user");
  const updaterUser = aliasedTable(sysUser, "updater_user");

  const [row] = await db
    .select({
      ...dictTypePublicColumns,
      creatorName: creatorUser.username,
      updaterName: updaterUser.username,
    })
    .from(sysDictType)
    .leftJoin(creatorUser, eq(creatorUser.id, sysDictType.creatorId))
    .leftJoin(updaterUser, eq(updaterUser.id, sysDictType.updaterId))
    .where(and(eq(sysDictType.id, id), isNull(sysDictType.deletedAt)))
    .limit(1);

  return row ? (row as DictTypeDetailRow) : null;
}

async function fetchDictDataDetail(id: number, db: AppQueryDb = drizzleDb): Promise<DictDataDetailRow | null> {
  const typeAlias = aliasedTable(sysDictType, "type_rel");
  const creatorUser = aliasedTable(sysUser, "creator_user");
  const updaterUser = aliasedTable(sysUser, "updater_user");

  const [row] = await db
    .select({
      ...dictDataPublicColumns,
      typeType: typeAlias.type,
      creatorName: creatorUser.username,
      updaterName: updaterUser.username,
    })
    .from(sysDictData)
    .leftJoin(typeAlias, eq(typeAlias.id, sysDictData.typeId))
    .leftJoin(creatorUser, eq(creatorUser.id, sysDictData.creatorId))
    .leftJoin(updaterUser, eq(updaterUser.id, sysDictData.updaterId))
    .where(and(eq(sysDictData.id, id), isNull(sysDictData.deletedAt)))
    .limit(1);

  return row ? (row as DictDataDetailRow) : null;
}

// ============================================================================
// Repository
// ============================================================================

export class DictRepository {
  // -------------------------------------------------------------------------
  // DictType - New Standard Methods
  // -------------------------------------------------------------------------

  static async listTypes(query: { page?: number; pageSize?: number; keyword?: string; status?: number; sortBy?: string; sortOrder?: string } = {}): Promise<DictTypeListRow[]> {
    const { page = 1, pageSize = 10, keyword, status, sortBy, sortOrder = "asc" } = query;
    const where = buildTypeWhere({ keyword, status });
    const dir = sortOrder === "asc" ? asc : desc;
    const orderCol = resolveDictTypeOrderColumn(sortBy);

    const creatorUser = aliasedTable(sysUser, "creator_user");
    const updaterUser = aliasedTable(sysUser, "updater_user");

    const baseQuery = drizzleDb
      .select({
        ...dictTypePublicColumns,
        creatorName: creatorUser.username,
        updaterName: updaterUser.username,
      })
      .from(sysDictType)
      .leftJoin(creatorUser, eq(creatorUser.id, sysDictType.creatorId))
      .leftJoin(updaterUser, eq(updaterUser.id, sysDictType.updaterId))
      .where(where)
      .orderBy(dir(orderCol));

    const rows = pageSize > 0
      ? await baseQuery.limit(pageSize).offset((page - 1) * pageSize)
      : await baseQuery;
    return rows as DictTypeListRow[];
  }

  static async countTypes(query: { keyword?: string; status?: number } = {}): Promise<number> {
    const where = buildTypeWhere(query);
    const [row] = await drizzleDb.select({ c: sqlCount() }).from(sysDictType).where(where);
    return Number(row?.c ?? 0);
  }

  static async findTypeById(id: number, db: AppQueryDb = drizzleDb): Promise<DictTypeDetailRow | null> {
    return fetchDictTypeDetail(id, db);
  }

  static async findTypeByType(type: string): Promise<DictTypeRow | null> {
    const [row] = await drizzleDb
      .select()
      .from(sysDictType)
      .where(and(eq(sysDictType.type, type), isNull(sysDictType.deletedAt)))
      .limit(1);
    return row ?? null;
  }

  static async createType(input: CreateDictTypeInput, db: AppQueryDb = drizzleDb): Promise<DictTypeDetailRow> {
    const { creatorId, updaterId, ...fields } = input;
    const now = dateUtils.now();

    const [inserted] = await db
      .insert(sysDictType)
      .values({
        ...fields,
        creatorId,
        updaterId,
        createdAt: now,
        updatedAt: now,
      })
      .$returningId();

    const created = await fetchDictTypeDetail(inserted.id, db);
    if (!created) throw new Error("Failed to read back created dict type");
    return created;
  }

  static async updateType(id: number, input: UpdateDictTypeInput, db: AppQueryDb = drizzleDb): Promise<DictTypeDetailRow> {
    const { updaterId, ...fields } = input;

    await db
      .update(sysDictType)
      .set({ ...fields, updatedAt: dateUtils.now() })
      .where(and(eq(sysDictType.id, id), isNull(sysDictType.deletedAt)));

    const updated = await fetchDictTypeDetail(id, db);
    if (!updated) throw new Error("Failed to read back updated dict type");
    return updated;
  }

  static async softDeleteType(id: number, db: AppQueryDb = drizzleDb): Promise<{ id: number } | null> {
    const [existing] = await db
      .select({ id: sysDictType.id })
      .from(sysDictType)
      .where(and(eq(sysDictType.id, id), isNull(sysDictType.deletedAt)))
      .limit(1);
    if (!existing) return null;

    const [countRow] = await db
      .select({ c: sqlCount() })
      .from(sysDictData)
      .where(and(eq(sysDictData.typeId, id), isNull(sysDictData.deletedAt)));
    if (Number(countRow?.c ?? 0) > 0) return null;

    await db
      .update(sysDictType)
      .set({ deletedAt: dateUtils.now(), status: 0, updatedAt: dateUtils.now() })
      .where(eq(sysDictType.id, id));

    return { id };
  }

  // -------------------------------------------------------------------------
  // DictData - New Standard Methods
  // -------------------------------------------------------------------------

  static async listData(query: { page?: number; pageSize?: number; typeId?: number; keyword?: string; status?: number; sortBy?: string; sortOrder?: string } = {}): Promise<DictDataListRow[]> {
    const { page = 1, pageSize = 10, typeId, keyword, status, sortBy, sortOrder = "asc" } = query;
    const where = buildDataWhere({ typeId, keyword, status });
    const dir = sortOrder === "asc" ? asc : desc;
    const orderCol = resolveDictDataOrderColumn(sortBy);

    const typeAlias = aliasedTable(sysDictType, "type_rel");
    const creatorUser = aliasedTable(sysUser, "creator_user");
    const updaterUser = aliasedTable(sysUser, "updater_user");

    const baseQuery = drizzleDb
      .select({
        ...dictDataPublicColumns,
        typeType: typeAlias.type,
        creatorName: creatorUser.username,
        updaterName: updaterUser.username,
      })
      .from(sysDictData)
      .leftJoin(typeAlias, eq(typeAlias.id, sysDictData.typeId))
      .leftJoin(creatorUser, eq(creatorUser.id, sysDictData.creatorId))
      .leftJoin(updaterUser, eq(updaterUser.id, sysDictData.updaterId))
      .where(where)
      .orderBy(dir(orderCol));

    const rows = pageSize > 0
      ? await baseQuery.limit(pageSize).offset((page - 1) * pageSize)
      : await baseQuery;
    return rows as DictDataListRow[];
  }

  static async countData(query: { typeId?: number; keyword?: string; status?: number } = {}): Promise<number> {
    const where = buildDataWhere(query);
    const [row] = await drizzleDb.select({ c: sqlCount() }).from(sysDictData).where(where);
    return Number(row?.c ?? 0);
  }

  static async findDataById(id: number, db: AppQueryDb = drizzleDb): Promise<DictDataDetailRow | null> {
    return fetchDictDataDetail(id, db);
  }

  static async findDataByTypeAndValue(typeId: number, value: string, db: AppQueryDb = drizzleDb): Promise<DictDataRow | null> {
    const [row] = await db
      .select()
      .from(sysDictData)
      .where(and(eq(sysDictData.typeId, typeId), eq(sysDictData.value, value), isNull(sysDictData.deletedAt)))
      .limit(1);
    return row ?? null;
  }

  static async createData(input: CreateDictDataInput, db: AppQueryDb = drizzleDb): Promise<DictDataDetailRow> {
    const { creatorId, updaterId, ...fields } = input;
    const now = dateUtils.now();

    const [inserted] = await db
      .insert(sysDictData)
      .values({
        ...fields,
        creatorId,
        updaterId,
        createdAt: now,
        updatedAt: now,
      })
      .$returningId();

    const created = await fetchDictDataDetail(inserted.id, db);
    if (!created) throw new Error("Failed to read back created dict data");
    return created;
  }

  static async updateData(id: number, input: UpdateDictDataInput, db: AppQueryDb = drizzleDb): Promise<DictDataDetailRow> {
    const { updaterId, ...fields } = input;

    await db
      .update(sysDictData)
      .set({ ...fields, updatedAt: dateUtils.now() })
      .where(and(eq(sysDictData.id, id), isNull(sysDictData.deletedAt)));

    const updated = await fetchDictDataDetail(id, db);
    if (!updated) throw new Error("Failed to read back updated dict data");
    return updated;
  }

  static async softDeleteData(id: number, db: AppQueryDb = drizzleDb): Promise<{ id: number } | null> {
    const [existing] = await db
      .select({ id: sysDictData.id })
      .from(sysDictData)
      .where(and(eq(sysDictData.id, id), isNull(sysDictData.deletedAt)))
      .limit(1);
    if (!existing) return null;

    await db
      .update(sysDictData)
      .set({ deletedAt: dateUtils.now(), status: 0, updatedAt: dateUtils.now() })
      .where(eq(sysDictData.id, id));

    return { id };
  }

  // -------------------------------------------------------------------------
  // All Dict Data Map
  // -------------------------------------------------------------------------

  static async getAllDictDataMap(): Promise<Record<string, { label: string; value: string }[]>> {
    const typeAlias = aliasedTable(sysDictType, "type_rel");
    const rows = await drizzleDb
      .select({
        typeType: typeAlias.type,
        label: sysDictData.label,
        value: sysDictData.value,
      })
      .from(sysDictData)
      .leftJoin(typeAlias, eq(typeAlias.id, sysDictData.typeId))
      .where(and(isNull(sysDictData.deletedAt), eq(sysDictData.status, 1)))
      .orderBy(asc(sysDictData.sortOrder));

    const result: Record<string, { label: string; value: string }[]> = {};
    for (const row of rows) {
      const type = row.typeType;
      if (!type) continue;
      if (!result[type]) result[type] = [];
      result[type].push({ label: row.label, value: row.value });
    }

    return result;
  }


}
