/**
 * Permission Repository
 *
 * Section 3 — Drizzle 链路：所有 DB 访问都走 Repository。
 * 业务层（PermissionService）调用本类即可。
 */

import { and, eq, inArray, isNull } from "drizzle-orm";
import { drizzleDb, type AppQueryDb } from "@/db";
import { sysRole, sysRolePermission, sysUserRole } from "@/db/schema";

export interface PermissionQueryResult {
  perms: Set<string>;
  roleCodes: Set<string>;
}

export interface RolePermissionEntry {
  /** 该角色自身授予的权限码（sys_role_permission），不含超管哨兵。 */
  perms: Set<string>;
  /** 角色 code，用于识别 super_admin。 */
  code: string | null;
}

export class PermissionRepository {
  /**
   * 逐角色加载权限码。
   *
   * `loadPermissionsByRoleIds` 把多个角色拍平成一个 Set，因此无法回答
   * 「这次操作的权限是哪个角色授予的」。行级数据范围必须逐角色判断：
   * 否则一个与本次操作无关的角色的「全部数据权限」会放大当前操作的可见范围。
   *
   * 同样只返回启用、未删除角色的数据。
   */
  static async loadPermissionsByRole(
    roleIds: number[],
    db: AppQueryDb = drizzleDb,
  ): Promise<Map<number, RolePermissionEntry>> {
    const validRoleIds = [...new Set(roleIds.map((id) => Number(id)).filter((id) => !isNaN(id) && id > 0))];
    if (validRoleIds.length === 0) return new Map();
    const [roleRows, permissionLinks] = await Promise.all([
      db
        .select({ id: sysRole.id, code: sysRole.code })
        .from(sysRole)
        .where(
          and(inArray(sysRole.id, validRoleIds), isNull(sysRole.deletedAt), eq(sysRole.status, 1)),
        ),
      db
        .select({ roleId: sysRolePermission.roleId, perm: sysRolePermission.permissionCode })
        .from(sysRolePermission)
        .innerJoin(
          sysRole,
          and(
            eq(sysRole.id, sysRolePermission.roleId),
            isNull(sysRole.deletedAt),
            eq(sysRole.status, 1),
          ),
        )
        .where(and(inArray(sysRolePermission.roleId, validRoleIds), isNull(sysRolePermission.deletedAt))),
    ]);
    const matrix = new Map<number, RolePermissionEntry>();
    for (const row of roleRows) matrix.set(row.id, { perms: new Set(), code: row.code });
    for (const link of permissionLinks) {
      if (!link.perm) continue;
      matrix.get(link.roleId)?.perms.add(link.perm);
    }
    return matrix;
  }

  /**
 * 加载一组角色 ID 对应的权限点（来自角色 ↔ 独立权限关联）。
   * 返回 Set<string> 类型的权限集合 + 角色 code 集合。
   *
   * Section 1 — RBAC 完整性修复：
   *   - 仅查询 status = "1"（启用）的角色
   *   - 软删除（deletedAt IS NOT NULL）的记录一律排除
   *   - 否则禁用/逻辑删除的角色仍会授予权限，导致与配置状态不一致
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
    const [roleRows, permissionLinks] = await Promise.all([
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
        .select({ roleId: sysRolePermission.roleId, perm: sysRolePermission.permissionCode })
        .from(sysRolePermission)
        .innerJoin(
          sysRole,
          and(
            eq(sysRole.id, sysRolePermission.roleId),
            isNull(sysRole.deletedAt),
            eq(sysRole.status, 1),
          ),
        )
        .where(and(inArray(sysRolePermission.roleId, sortedIds), isNull(sysRolePermission.deletedAt))),
    ]);
    const perms = new Set<string>();
    const roleCodes = new Set<string>();
    for (const row of roleRows) {
      if (row.code) roleCodes.add(row.code);
    }
    for (const link of permissionLinks) {
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
