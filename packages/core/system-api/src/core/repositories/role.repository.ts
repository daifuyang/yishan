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
import { sysRole, sysRoleWorkbenchMenu, sysRoleMenu, sysRolePermission, sysRoleDept, sysUser } from "@/db/schema";

import { dateUtils } from "../../utils/date.js";
import { clampOffset } from "./_pagination.js";

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
  appMenuIds?: number[];
  permissionCodes?: string[];
  /** `dataScope = 5`（自定义）时的授权部门；其他档位忽略。 */
  deptIds?: number[];
}

/** `undefined` 表示不更新。 */
export interface UpdateRoleInput extends Partial<RolePersistedFields> {
  updaterId: number;
  menuIds?: number[];
  appMenuIds?: number[];
  permissionCodes?: string[];
  /** `dataScope = 5`（自定义）时的授权部门；其他档位忽略。 */
  deptIds?: number[];
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
  appMenuIds: number[];
  permissionCodes: string[];
  /** `dataScope = 5` 时生效的授权部门，供表单回显。 */
  deptIds: number[];
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

function buildRoleWhere(opts: { keyword?: string; status?: number; dataScope?: SQL }): SQL | undefined {
  const conds: SQL[] = [isNull(sysRole.deletedAt)];
  // sys_role 无部门归属，不施加行级数据范围（见 RoleRepository.dataScopeCondition）。
  if (opts.dataScope) conds.push(opts.dataScope);
  if (opts.keyword) {
    const like_ = `%${opts.keyword}%`;
    conds.push(or(like(sysRole.name, like_), like(sysRole.description, like_))!);
  }
  if (opts.status !== undefined) conds.push(eq(sysRole.status, opts.status));
  return and(...conds);
}

async function fetchRoleDetail(id: number, db: AppQueryDb = drizzleDb, dataScope?: SQL): Promise<RoleDetailRow | null> {
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
    .where(and(eq(sysRole.id, id), isNull(sysRole.deletedAt), dataScope))
    .limit(1);

  if (!row) return null;

  const [roleMenus, roleAppMenus, rolePermissions, roleDepts] = await Promise.all([
    db
      .select({ menuId: sysRoleMenu.menuId })
      .from(sysRoleMenu)
      .where(and(eq(sysRoleMenu.roleId, id), isNull(sysRoleMenu.deletedAt))),
    db
      .select({ appMenuId: sysRoleWorkbenchMenu.workbenchMenuId })
      .from(sysRoleWorkbenchMenu)
      .where(and(eq(sysRoleWorkbenchMenu.roleId, id), isNull(sysRoleWorkbenchMenu.deletedAt))),
    db
      .select({ permissionCode: sysRolePermission.permissionCode })
      .from(sysRolePermission)
      .where(and(eq(sysRolePermission.roleId, id), isNull(sysRolePermission.deletedAt))),
    db
      .select({ deptId: sysRoleDept.deptId })
      .from(sysRoleDept)
      .where(and(eq(sysRoleDept.roleId, id), isNull(sysRoleDept.deletedAt))),
  ]);

  return {
    ...row,
    menuIds: roleMenus.map((rm) => rm.menuId),
    appMenuIds: roleAppMenus.map((rm) => rm.appMenuId),
    permissionCodes: rolePermissions.map((rp) => rp.permissionCode),
    deptIds: roleDepts.map((rd) => rd.deptId),
  };
}

// ============================================================================
// Repository
// ============================================================================

export class RoleRepository {
  /**
   * 角色**不施加**行级数据范围。
   *
   * `sys_role` 没有部门列，也没有任何业务上的部门归属。此前按「仅创建人」降级是
   * 凭空发明的规则：结果是除了超管，任何管理员都只能看到自己建的角色，角色选择
   * 框、用户表单里的角色分配直接失效。RuoYi 同样不给 sys_role 加 `@DataScope`。
   *
   * 保留这个空实现是为了让「角色不走数据范围」是一个显式决定，而不是遗漏。
   * `sys_role_dept` 配置决定该角色的用户数据范围，其修改由角色授权权限控制，
   * 不代表角色记录本身已经施加行级过滤。
   */
  static async dataScopeCondition(): Promise<SQL | undefined> {
    return undefined
  }

  /** 获取角色列表 */
  static async list(query: { page?: number; pageSize?: number; keyword?: string; status?: number; sortBy?: string; sortOrder?: string } = {}): Promise<RoleListRow[]> {
    const { page = 1, pageSize = 10, keyword, status, sortBy, sortOrder = "desc" } = query;
    const where = buildRoleWhere({
      keyword,
      status,
      dataScope: await RoleRepository.dataScopeCondition(),
    });
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
      ? await baseQuery.limit(pageSize).offset(clampOffset(page, pageSize))
      : await baseQuery;
    return roles as RoleListRow[];
  }

  /** 获取角色总数 */
  static async count(query: { keyword?: string; status?: number } = {}): Promise<number> {
    const where = buildRoleWhere({ ...query, dataScope: await RoleRepository.dataScopeCondition() });
    const [row] = await drizzleDb.select({ c: sqlCount() }).from(sysRole).where(where);
    return Number(row?.c ?? 0);
  }

  /** 根据角色ID获取角色信息。`dataScope` 由调用方传入，避免绕过列表的行级限制。 */
  static async findById(id: number, db: AppQueryDb = drizzleDb, dataScope?: SQL): Promise<RoleDetailRow | null> {
    return fetchRoleDetail(id, db, dataScope);
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
    const { creatorId, updaterId, menuIds, appMenuIds, permissionCodes, deptIds, ...fields } = input;
    const uniqueMenuIds = menuIds ? [...new Set(menuIds)] : [];
    const uniqueAppMenuIds = appMenuIds ? [...new Set(appMenuIds)] : [];
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
    if (uniqueAppMenuIds.length > 0) {
      await db.insert(sysRoleWorkbenchMenu).values(uniqueAppMenuIds.map((appMenuId) => ({ roleId: inserted.id, workbenchMenuId: appMenuId })));
    }
    if (uniquePermissionCodes.length > 0) {
      await db.insert(sysRolePermission).values(
        uniquePermissionCodes.map((permissionCode) => ({ roleId: inserted.id, permissionCode, creatorId })),
      );
    }
    // 自定义数据范围（档位 5）。此前该档位只存得进算不出：没有写入路径，
    // sys_role_dept 永远是空的，解析出来的范围为空集 → 看不到任何人。
    const uniqueDeptIds = deptIds ? [...new Set(deptIds)] : [];
    if (uniqueDeptIds.length > 0) {
      await db.insert(sysRoleDept).values(uniqueDeptIds.map((deptId) => ({ roleId: inserted.id, deptId, creatorId })));
    }

    const role = await fetchRoleDetail(inserted.id, db);
    if (!role) throw new Error("Failed to read back created role");
    return role;
  }

  /** 更新角色 */
  static async update(id: number, input: UpdateRoleInput, db: AppQueryDb = drizzleDb): Promise<RoleDetailRow> {
    const { updaterId, menuIds, appMenuIds, permissionCodes, deptIds, ...fields } = input;

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

    if (appMenuIds !== undefined) {
      const uniqueAppMenuIds = [...new Set(appMenuIds)];
      const existingLinks = await db
        .select({ appMenuId: sysRoleWorkbenchMenu.workbenchMenuId })
        .from(sysRoleWorkbenchMenu)
        .where(and(eq(sysRoleWorkbenchMenu.roleId, id), isNull(sysRoleWorkbenchMenu.deletedAt)));
      const existingIds = existingLinks.map((l) => l.appMenuId);
      const toCreate = uniqueAppMenuIds.filter((m) => !existingIds.includes(m));
      const toDelete = existingIds.filter((m) => !uniqueAppMenuIds.includes(m));
      if (toCreate.length) {
        await db.insert(sysRoleWorkbenchMenu).values(toCreate.map((appMenuId) => ({ roleId: id, workbenchMenuId: appMenuId })));
      }
      if (toDelete.length) {
        await db.delete(sysRoleWorkbenchMenu).where(and(eq(sysRoleWorkbenchMenu.roleId, id), inArray(sysRoleWorkbenchMenu.workbenchMenuId, toDelete)));
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

    if (deptIds !== undefined) {
      const uniqueDeptIds = [...new Set(deptIds)];
      const existingLinks = await db
        .select({ deptId: sysRoleDept.deptId })
        .from(sysRoleDept)
        .where(and(eq(sysRoleDept.roleId, id), isNull(sysRoleDept.deletedAt)));
      const existingIds = existingLinks.map((l) => l.deptId);
      const toCreate = uniqueDeptIds.filter((d) => !existingIds.includes(d));
      const toDelete = existingIds.filter((d) => !uniqueDeptIds.includes(d));
      if (toCreate.length > 0) {
        await db.insert(sysRoleDept).values(toCreate.map((deptId) => ({ roleId: id, deptId, creatorId: updaterId })));
      }
      if (toDelete.length > 0) {
        await db.delete(sysRoleDept).where(and(eq(sysRoleDept.roleId, id), inArray(sysRoleDept.deptId, toDelete)));
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
