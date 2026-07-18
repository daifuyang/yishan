/**
 * 菜单数据访问 Repository
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
import { sysMenu, sysMenuPermission, sysRoleMenu, sysUser } from "@/db/schema";
import { dateUtils } from "../../utils/date.js";

// ============================================================================
// Internal Input Types
// ============================================================================

type MenuPersistedFields = Pick<
  typeof sysMenu.$inferInsert,
  "name" | "type" | "parentId" | "path" | "icon" | "component" | "status" | "sortOrder" | "hideInMenu" | "isDefaultAction" | "isExternalLink" | "keepAlive"
>;

/** Service 已完成认证、校验和 API DTO 到持久化输入的转换。 */
export interface CreateMenuInput extends MenuPersistedFields {
  creatorId: number;
  updaterId: number;
}

/** `undefined` 表示不更新，`null` 表示显式清空可空字段。 */
export interface UpdateMenuInput extends Partial<MenuPersistedFields> {
  updaterId: number;
}

// ============================================================================
// Query Result Types
// ============================================================================

type MenuRow = typeof sysMenu.$inferSelect;
type PublicMenuRow = Omit<MenuRow, "deletedAt" | "version">;

interface MenuListRow extends PublicMenuRow {
  parentName: string | null;
  creatorName: string | null;
  updaterName: string | null;
}

interface MenuDetailRow extends MenuListRow {}

// ============================================================================
// Internal Helpers
// ============================================================================

function sqlCount() {
  return sql<number>`count(*)`;
}

const { deletedAt: _deletedAt, version: _version, ...menuPublicColumns } = getTableColumns(sysMenu);

const MENU_ORDER_COLUMNS = {
  sortOrder: sysMenu.sortOrder,
  createdAt: sysMenu.createdAt,
  updatedAt: sysMenu.updatedAt,
} as const;
type MenuOrderBy = keyof typeof MENU_ORDER_COLUMNS;
const DEFAULT_MENU_ORDER_BY: MenuOrderBy = "sortOrder";

function resolveMenuOrderColumn(sortBy: string | undefined) {
  if (sortBy && sortBy in MENU_ORDER_COLUMNS) {
    return MENU_ORDER_COLUMNS[sortBy as MenuOrderBy];
  }
  return MENU_ORDER_COLUMNS[DEFAULT_MENU_ORDER_BY];
}

function buildMenuWhere(opts: {
  keyword?: string;
  status?: number;
  type?: number;
  parentId?: number;
  withDeleted?: boolean;
}): SQL | undefined {
  const conds: SQL[] = opts.withDeleted ? [] : [isNull(sysMenu.deletedAt)];
  if (opts.keyword) {
    const like_ = `%${opts.keyword}%`;
    conds.push(
      or(
        like(sysMenu.name, like_),
        like(sysMenu.path, like_),
        like(sysMenu.component, like_),
      )!,
    );
  }
  if (opts.status !== undefined) conds.push(eq(sysMenu.status, opts.status));
  if (opts.type !== undefined) conds.push(eq(sysMenu.type, opts.type));
  if (opts.parentId !== undefined) conds.push(eq(sysMenu.parentId, opts.parentId));
  return conds.length ? and(...conds) : undefined;
}

async function fetchMenuDetail(id: number, db: AppQueryDb = drizzleDb): Promise<MenuDetailRow | null> {
  const parentMenu = aliasedTable(sysMenu, "parent_menu");
  const creatorUser = aliasedTable(sysUser, "creator_user");
  const updaterUser = aliasedTable(sysUser, "updater_user");

  const [row] = await db
    .select({
      ...menuPublicColumns,
      parentName: parentMenu.name,
      creatorName: creatorUser.username,
      updaterName: updaterUser.username,
    })
    .from(sysMenu)
    .leftJoin(parentMenu, eq(parentMenu.id, sysMenu.parentId))
    .leftJoin(creatorUser, eq(creatorUser.id, sysMenu.creatorId))
    .leftJoin(updaterUser, eq(updaterUser.id, sysMenu.updaterId))
    .where(and(eq(sysMenu.id, id), isNull(sysMenu.deletedAt)))
    .limit(1);

  return row ? (row as MenuDetailRow) : null;
}

// ============================================================================
// Repository
// ============================================================================

export class MenuRepository {
  static async findPermissionCodesByMenuIds(menuIds: number[], db: AppQueryDb = drizzleDb): Promise<Map<number, string[]>> {
    const result = new Map<number, string[]>();
    if (menuIds.length === 0) return result;
    const rows = await db.select({ menuId: sysMenuPermission.menuId, permissionCode: sysMenuPermission.permissionCode })
      .from(sysMenuPermission).where(inArray(sysMenuPermission.menuId, [...new Set(menuIds)]));
    for (const row of rows) result.set(row.menuId, [...(result.get(row.menuId) || []), row.permissionCode]);
    return result;
  }

  static async replacePermissionCodes(menuId: number, codes: string[], db: AppQueryDb = drizzleDb): Promise<void> {
    await db.delete(sysMenuPermission).where(eq(sysMenuPermission.menuId, menuId));
    const uniqueCodes = [...new Set(codes)];
    if (uniqueCodes.length > 0) await db.insert(sysMenuPermission).values(uniqueCodes.map((permissionCode) => ({ menuId, permissionCode })));
  }
  /** 获取菜单列表 */
  static async list(query: { page?: number; pageSize?: number; keyword?: string; status?: number; type?: number; parentId?: number; sortBy?: string; sortOrder?: string } = {}): Promise<MenuListRow[]> {
    const { page = 1, pageSize = 10, keyword, status, type, parentId, sortBy, sortOrder = "asc" } = query;
    const where = buildMenuWhere({ keyword, status, type, parentId });
    const dir = sortOrder === "asc" ? asc : desc;
    const orderCol = resolveMenuOrderColumn(sortBy);

    const parentMenu = aliasedTable(sysMenu, "parent_menu");
    const creatorUser = aliasedTable(sysUser, "creator_user");
    const updaterUser = aliasedTable(sysUser, "updater_user");

    const baseQuery = drizzleDb
      .select({
        ...menuPublicColumns,
        parentName: parentMenu.name,
        creatorName: creatorUser.username,
        updaterName: updaterUser.username,
      })
      .from(sysMenu)
      .leftJoin(parentMenu, eq(parentMenu.id, sysMenu.parentId))
      .leftJoin(creatorUser, eq(creatorUser.id, sysMenu.creatorId))
      .leftJoin(updaterUser, eq(updaterUser.id, sysMenu.updaterId))
      .where(where)
      .orderBy(dir(orderCol));

    const menus = pageSize > 0
      ? await baseQuery.limit(pageSize).offset((page - 1) * pageSize)
      : await baseQuery;
    return menus as MenuListRow[];
  }

  /** 获取菜单总数 */
  static async count(query: { keyword?: string; status?: number; type?: number; parentId?: number } = {}): Promise<number> {
    const where = buildMenuWhere(query);
    const [row] = await drizzleDb.select({ c: sqlCount() }).from(sysMenu).where(where);
    return Number(row?.c ?? 0);
  }

  /** 根据ID获取菜单 */
  static async findById(id: number, db: AppQueryDb = drizzleDb): Promise<MenuDetailRow | null> {
    return fetchMenuDetail(id, db);
  }

  /** 根据父级与名称查询(用于唯一性校验) */
  static async findByParentAndName(parentId: number | undefined | null, name: string): Promise<MenuRow | null> {
    const parentCond = parentId == null
      ? isNull(sysMenu.parentId)
      : eq(sysMenu.parentId, parentId);

    const [row] = await drizzleDb
      .select()
      .from(sysMenu)
      .where(
        and(
          isNull(sysMenu.deletedAt),
          eq(sysMenu.name, name),
          parentCond,
        ),
      )
      .limit(1);
    return row ?? null;
  }

  /** 根据路径查询(用于唯一性校验) */
  static async findByPath(path: string): Promise<MenuRow | null> {
    const [row] = await drizzleDb
      .select()
      .from(sysMenu)
      .where(and(eq(sysMenu.path, path), isNull(sysMenu.deletedAt)))
      .limit(1);
    return row ?? null;
  }

  /** 创建菜单 */
  static async create(input: CreateMenuInput, db: AppQueryDb = drizzleDb): Promise<MenuDetailRow> {
    const { creatorId, updaterId, ...fields } = input;
    const now = dateUtils.now();

    const [inserted] = await db
      .insert(sysMenu)
      .values({
        ...fields,
        creatorId,
        updaterId,
        createdAt: now,
        updatedAt: now,
      })
      .$returningId();

    const created = await fetchMenuDetail(inserted.id, db);
    if (!created) throw new Error("Failed to read back created menu");
    return created;
  }

  /** 更新菜单 */
  static async update(id: number, input: UpdateMenuInput, db: AppQueryDb = drizzleDb): Promise<MenuDetailRow> {
    const { updaterId, ...fields } = input;

    await db
      .update(sysMenu)
      .set({ ...fields, updatedAt: dateUtils.now() })
      .where(and(eq(sysMenu.id, id), isNull(sysMenu.deletedAt)));

    const updated = await fetchMenuDetail(id, db);
    if (!updated) throw new Error("Failed to read back updated menu");
    return updated;
  }

  /** 软删除菜单 */
  static async softDelete(id: number, db: AppQueryDb = drizzleDb): Promise<MenuRow | null> {
    const [existing] = await db
      .select({ id: sysMenu.id })
      .from(sysMenu)
      .where(and(eq(sysMenu.id, id), isNull(sysMenu.deletedAt)))
      .limit(1);
    if (!existing) return null;

    await db
      .update(sysMenu)
      .set({ deletedAt: dateUtils.now(), status: 0, updatedAt: dateUtils.now() })
      .where(eq(sysMenu.id, id));

    const [deleted] = await db
      .select()
      .from(sysMenu)
      .where(eq(sysMenu.id, id))
      .limit(1);
    return deleted ?? null;
  }

  /** 统计角色绑定数量 */
  static async countByRoleMenu(menuId: number, db: AppQueryDb = drizzleDb): Promise<number> {
    const [row] = await db
      .select({ c: sqlCount() })
      .from(sysRoleMenu)
      .where(and(eq(sysRoleMenu.menuId, menuId), isNull(sysRoleMenu.deletedAt)));
    return Number(row?.c ?? 0);
  }

  /** 获取菜单树（原始数据，用于 service 处理） */
  static async listAllForTree(db: AppQueryDb = drizzleDb): Promise<MenuListRow[]> {
    const parentMenu = aliasedTable(sysMenu, "parent_menu");
    const creatorUser = aliasedTable(sysUser, "creator_user");
    const updaterUser = aliasedTable(sysUser, "updater_user");

    const menus = await db
      .select({
        ...menuPublicColumns,
        parentName: parentMenu.name,
        creatorName: creatorUser.username,
        updaterName: updaterUser.username,
      })
      .from(sysMenu)
      .leftJoin(parentMenu, eq(parentMenu.id, sysMenu.parentId))
      .leftJoin(creatorUser, eq(creatorUser.id, sysMenu.creatorId))
      .leftJoin(updaterUser, eq(updaterUser.id, sysMenu.updaterId))
      .where(isNull(sysMenu.deletedAt))
      .orderBy(asc(sysMenu.sortOrder));

    return menus as MenuListRow[];
  }

  /** 获取授权菜单相关原始数据（用于 service 处理） */
  static async listAllForAuthorization(db: AppQueryDb = drizzleDb): Promise<MenuListRow[]> {
    return this.listAllForTree(db);
  }

  /** 获取角色绑定的菜单ID列表 */
  static async findMenuIdsByRoleIds(roleIds: number[], db: AppQueryDb = drizzleDb): Promise<number[]> {
    if (!roleIds || roleIds.length === 0) return [];
    const uniqueRoleIds = [...new Set(roleIds)];
    
    const links = await db
      .select({ menuId: sysRoleMenu.menuId })
      .from(sysRoleMenu)
      .where(and(inArray(sysRoleMenu.roleId, uniqueRoleIds), isNull(sysRoleMenu.deletedAt)));
    
    return Array.from(new Set(links.map((l) => l.menuId)));
  }

  /** 获取授权菜单路径（原始数据） */
  static async findAllMenuPaths(db: AppQueryDb = drizzleDb): Promise<{ id: number; parentId: number | null; path: string | null; isExternalLink: boolean | null; status: number }[]> {
    const menus = await db
      .select({
        id: sysMenu.id,
        parentId: sysMenu.parentId,
        path: sysMenu.path,
        isExternalLink: sysMenu.isExternalLink,
        status: sysMenu.status,
      })
      .from(sysMenu)
      .where(and(isNull(sysMenu.deletedAt), eq(sysMenu.status, 1)))
      .orderBy(asc(sysMenu.sortOrder));
    return menus;
  }


}
