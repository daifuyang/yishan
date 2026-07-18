/**
 * 角色数据访问 Repository
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
import { sysRole, sysRoleMenu, sysRolePermission, sysUser } from "@/db/schema";
import { dateUtils } from "../../utils/date.js";

// ============================================================================
// Internal Input Types
// ============================================================================

type RolePersistedFields = Pick<
  typeof sysRole.$inferInsert,
  "name" | "description" | "status" | "dataScope"
>;

/** Service 已完成认证、校验和 API DTO 到持久化输入的转换。 */
export interface CreateRoleInput extends RolePersistedFields {
  creatorId: number;
  updaterId: number;
  menuIds?: number[];
  permissionCodes?: string[];
}

/** `undefined` 表示不更新。 */
export interface UpdateRoleInput extends Partial<RolePersistedFields> {
  updaterId: number;
  menuIds?: number[];
  permissionCodes?: string[];
}

// ============================================================================
// Query Result Types
// ============================================================================

type RoleRow = typeof sysRole.$inferSelect;
type PublicRoleRow = Omit<RoleRow, "deletedAt" | "version">;

interface RoleListRow extends PublicRoleRow {
  creatorName: string | null;
  updaterName: string | null;
}

interface RoleDetailRow extends RoleListRow {
  menuIds: number[];
  permissionCodes: string[];
}

// ============================================================================
// Internal Helpers
// ============================================================================

function sqlCount() {
  return sql<number>`count(*)`;
}

const { deletedAt: _deletedAt, version: _version, ...rolePublicColumns } = getTableColumns(sysRole);

const ROLE_ORDER_COLUMNS = {
  createdAt: sysRole.createdAt,
  updatedAt: sysRole.updatedAt,
} as const;
type RoleOrderBy = keyof typeof ROLE_ORDER_COLUMNS;
const DEFAULT_ROLE_ORDER_BY: RoleOrderBy = "createdAt";

function resolveRoleOrderColumn(sortBy: string | undefined) {
  if (sortBy && sortBy in ROLE_ORDER_COLUMNS) {
    return ROLE_ORDER_COLUMNS[sortBy as RoleOrderBy];
  }
  return ROLE_ORDER_COLUMNS[DEFAULT_ROLE_ORDER_BY];
}

function buildRoleWhere(opts: { keyword?: string; status?: number }): SQL | undefined {
  const conds: SQL[] = [isNull(sysRole.deletedAt)];
  if (opts.keyword) {
    const like_ = `%${opts.keyword}%`;
    conds.push(or(like(sysRole.name, like_), like(sysRole.description, like_))!);
  }
  if (opts.status !== undefined) conds.push(eq(sysRole.status, opts.status));
  return and(...conds);
}

async function fetchRoleDetail(id: number, db: AppQueryDb = drizzleDb): Promise<RoleDetailRow | null> {
  const creatorUser = aliasedTable(sysUser, "creator_user");
  const updaterUser = aliasedTable(sysUser, "updater_user");

  const [row] = await db
    .select({
      ...rolePublicColumns,
      creatorName: creatorUser.username,
      updaterName: updaterUser.username,
    })
    .from(sysRole)
    .leftJoin(creatorUser, eq(creatorUser.id, sysRole.creatorId))
    .leftJoin(updaterUser, eq(updaterUser.id, sysRole.updaterId))
    .where(and(eq(sysRole.id, id), isNull(sysRole.deletedAt)))
    .limit(1);

  if (!row) return null;

  const [roleMenus, rolePermissions] = await Promise.all([
    db
      .select({ menuId: sysRoleMenu.menuId })
      .from(sysRoleMenu)
      .where(and(eq(sysRoleMenu.roleId, id), isNull(sysRoleMenu.deletedAt))),
    db
      .select({ permissionCode: sysRolePermission.permissionCode })
      .from(sysRolePermission)
      .where(and(eq(sysRolePermission.roleId, id), isNull(sysRolePermission.deletedAt))),
  ]);

  return {
    ...row,
    menuIds: roleMenus.map((rm) => rm.menuId),
    permissionCodes: rolePermissions.map((rp) => rp.permissionCode),
  };
}

// ============================================================================
// Repository
// ============================================================================

export class RoleRepository {
  /** 获取角色列表 */
  static async list(query: { page?: number; pageSize?: number; keyword?: string; status?: number; sortBy?: string; sortOrder?: string } = {}): Promise<RoleListRow[]> {
    const { page = 1, pageSize = 10, keyword, status, sortBy, sortOrder = "desc" } = query;
    const where = buildRoleWhere({ keyword, status });
    const dir = sortOrder === "asc" ? asc : desc;
    const orderCol = resolveRoleOrderColumn(sortBy);

    const creatorUser = aliasedTable(sysUser, "creator_user");
    const updaterUser = aliasedTable(sysUser, "updater_user");

    const baseQuery = drizzleDb
      .select({
        ...rolePublicColumns,
        creatorName: creatorUser.username,
        updaterName: updaterUser.username,
      })
      .from(sysRole)
      .leftJoin(creatorUser, eq(creatorUser.id, sysRole.creatorId))
      .leftJoin(updaterUser, eq(updaterUser.id, sysRole.updaterId))
      .where(where)
      .orderBy(dir(orderCol));

    const roles = pageSize > 0
      ? await baseQuery.limit(pageSize).offset((page - 1) * pageSize)
      : await baseQuery;
    return roles as RoleListRow[];
  }

  /** 获取角色总数 */
  static async count(query: { keyword?: string; status?: number } = {}): Promise<number> {
    const where = buildRoleWhere(query);
    const [row] = await drizzleDb.select({ c: sqlCount() }).from(sysRole).where(where);
    return Number(row?.c ?? 0);
  }

  /** 根据角色ID获取角色信息 */
  static async findById(id: number, db: AppQueryDb = drizzleDb): Promise<RoleDetailRow | null> {
    return fetchRoleDetail(id, db);
  }

  /** 根据角色名称获取原始角色信息（用于唯一性校验） */
  static async findByName(name: string): Promise<RoleRow | null> {
    const [row] = await drizzleDb
      .select()
      .from(sysRole)
      .where(and(eq(sysRole.name, name), isNull(sysRole.deletedAt)))
      .limit(1);
    return row ?? null;
  }

  /** 创建角色 */
  static async create(input: CreateRoleInput, db: AppQueryDb = drizzleDb): Promise<RoleDetailRow> {
    const { creatorId, updaterId, menuIds, permissionCodes, ...fields } = input;
    const uniqueMenuIds = menuIds ? [...new Set(menuIds)] : [];
    const uniquePermissionCodes = permissionCodes ? [...new Set(permissionCodes)] : [];
    const now = dateUtils.now();

    const [inserted] = await db
      .insert(sysRole)
      .values({
        ...fields,
        isSystemDefault: false,
        creatorId,
        updaterId,
        createdAt: now,
        updatedAt: now,
      })
      .$returningId();

    if (uniqueMenuIds.length > 0) {
      await db.insert(sysRoleMenu).values(uniqueMenuIds.map((menuId) => ({ roleId: inserted.id, menuId })));
    }
    if (uniquePermissionCodes.length > 0) {
      await db.insert(sysRolePermission).values(
        uniquePermissionCodes.map((permissionCode) => ({ roleId: inserted.id, permissionCode, creatorId })),
      );
    }

    const role = await fetchRoleDetail(inserted.id, db);
    if (!role) throw new Error("Failed to read back created role");
    return role;
  }

  /** 更新角色 */
  static async update(id: number, input: UpdateRoleInput, db: AppQueryDb = drizzleDb): Promise<RoleDetailRow> {
    const { updaterId, menuIds, permissionCodes, ...fields } = input;

    await db
      .update(sysRole)
      .set({ ...fields, updaterId, updatedAt: dateUtils.now() })
      .where(and(eq(sysRole.id, id), isNull(sysRole.deletedAt)));

    if (menuIds !== undefined) {
      const uniqueMenuIds = [...new Set(menuIds)];
      const existingLinks = await db
        .select({ menuId: sysRoleMenu.menuId })
        .from(sysRoleMenu)
        .where(and(eq(sysRoleMenu.roleId, id), isNull(sysRoleMenu.deletedAt)));
      const existingIds = existingLinks.map((l) => l.menuId);
      const toCreate = uniqueMenuIds.filter((m) => !existingIds.includes(m));
      const toDelete = existingIds.filter((m) => !uniqueMenuIds.includes(m));
      if (toCreate.length) {
        await db.insert(sysRoleMenu).values(toCreate.map((menuId) => ({ roleId: id, menuId })));
      }
      if (toDelete.length) {
        await db.delete(sysRoleMenu).where(and(eq(sysRoleMenu.roleId, id), inArray(sysRoleMenu.menuId, toDelete)));
      }
    }

    if (permissionCodes !== undefined) {
      const uniquePermissionCodes = [...new Set(permissionCodes)];
      const existingLinks = await db
        .select({ permissionCode: sysRolePermission.permissionCode })
        .from(sysRolePermission)
        .where(and(eq(sysRolePermission.roleId, id), isNull(sysRolePermission.deletedAt)));
      const existingCodes = existingLinks.map((link) => link.permissionCode);
      const toCreate = uniquePermissionCodes.filter((code) => !existingCodes.includes(code));
      const toDelete = existingCodes.filter((code) => !uniquePermissionCodes.includes(code));
      if (toCreate.length > 0) {
        await db.insert(sysRolePermission).values(
          toCreate.map((permissionCode) => ({ roleId: id, permissionCode, creatorId: updaterId })),
        );
      }
      if (toDelete.length > 0) {
        await db.delete(sysRolePermission).where(
          and(eq(sysRolePermission.roleId, id), inArray(sysRolePermission.permissionCode, toDelete)),
        );
      }
    }

    const finalRole = await fetchRoleDetail(id, db);
    if (!finalRole) throw new Error("Failed to read back updated role");
    return finalRole;
  }

  /** 软删除角色 */
  static async softDelete(id: number, db: AppQueryDb = drizzleDb): Promise<RoleRow | null> {
    const [existing] = await db
      .select({ id: sysRole.id })
      .from(sysRole)
      .where(and(eq(sysRole.id, id), isNull(sysRole.deletedAt)))
      .limit(1);
    if (!existing) return null;

    const now = dateUtils.now();
    await db
      .update(sysRole)
      .set({ deletedAt: now, status: 0, updatedAt: now })
      .where(eq(sysRole.id, id));

    const [deleted] = await db
      .select()
      .from(sysRole)
      .where(eq(sysRole.id, id))
      .limit(1);
    return deleted ?? null;
  }


}
