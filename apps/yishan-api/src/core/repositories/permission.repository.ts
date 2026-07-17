/**
 * Permission Repository
 *
 * Section 3 — Drizzle 链路：所有 DB 访问都走 Repository。
 * 业务层（PermissionService）调用本类即可。
 */

import { and, eq, inArray, isNull } from "drizzle-orm";
import { drizzleDb, type AppQueryDb } from "@/db";
import { sysMenu, sysRole, sysRoleMenu, sysUserRole } from "@/db/schema";

export interface PermissionQueryResult {
  perms: Set<string>;
  roleCodes: Set<string>;
}

export class PermissionRepository {
  /**
   * 加载一组角色 ID 对应的权限点（来自角色 ↔ 菜单 ↔ perm）。
   * 返回 Set<string> 类型的权限集合 + 角色 code 集合。
   *
   * Section 1 — RBAC 完整性修复：
   *   - 仅查询 status = "1"（启用）的角色与菜单
   *   - 软删除（deletedAt IS NOT NULL）的记录一律排除
   *   - 否则禁用/逻辑删除的角色或菜单仍会授予权限，导致与 UI 状态不一致
   */
  static async loadPermissionsByRoleIds(
    roleIds: number[] | number | undefined | null,
    db: AppQueryDb = drizzleDb,
  ): Promise<PermissionQueryResult> {
    // 确保 roleIds 是一个有效的数字数组
    const normalizedRoleIds = Array.isArray(roleIds)
      ? roleIds
      : (roleIds != null ? [Number(roleIds)] : []);

    // 过滤并转换为有效的数字
    const validRoleIds = normalizedRoleIds
      .map(id => Number(id))
      .filter(id => !isNaN(id) && id > 0);

    if (validRoleIds.length === 0) {
      return { perms: new Set<string>(), roleCodes: new Set<string>() };
    }
    const sortedIds = [...new Set(validRoleIds)];
    const [roleRows, menuLinks] = await Promise.all([
      db
        .select({ id: sysRole.id, code: sysRole.code })
        .from(sysRole)
        .where(
          and(
            inArray(sysRole.id, sortedIds),
            isNull(sysRole.deletedAt),
            eq(sysRole.status, 1),
          ),
        ),
      db
        .select({ roleId: sysRoleMenu.roleId, perm: sysMenu.perm })
        .from(sysRoleMenu)
        .innerJoin(
          sysMenu,
          and(
            eq(sysMenu.id, sysRoleMenu.menuId),
            isNull(sysMenu.deletedAt),
            eq(sysMenu.status, 1),
          ),
        )
        .where(and(inArray(sysRoleMenu.roleId, sortedIds), isNull(sysRoleMenu.deletedAt))),
    ]);
    const perms = new Set<string>();
    const roleCodes = new Set<string>();
    for (const row of roleRows) {
      if (row.code) roleCodes.add(row.code);
    }
    for (const link of menuLinks) {
      if (link.perm) perms.add(link.perm);
    }
    return { perms, roleCodes };
  }

  /** 当前用户的活跃 role IDs。 */
  static async loadActiveRoleIdsByUserId(
    userId: number,
    db: AppQueryDb = drizzleDb,
  ): Promise<number[]> {
    const rows = await db
      .select({ roleId: sysUserRole.roleId })
      .from(sysUserRole)
      .where(and(eq(sysUserRole.userId, userId), isNull(sysUserRole.deletedAt)));
    return rows.map((r) => r.roleId);
  }
}
