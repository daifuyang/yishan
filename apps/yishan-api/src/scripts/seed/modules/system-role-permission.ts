/**
 * 默认角色的后端功能/API 权限。
 *
 * 角色菜单与角色权限是两套独立关联：前者只控制导航可见性，后者才决定
 * requirePermission() 是否放行。权限码始终来自 Core 目录或插件 manifest，
 * 种子不创建自由配置的权限定义。
 */

import { and, eq, isNull } from 'drizzle-orm';
import { sysRole, sysRolePermission } from '@/db/schema';
import { ROLE_CODES } from '@/constants/permission-codes.js';
import { listPermissions } from '@/core/permissions/catalog.js';
import type { SeedDb } from '../context.js';

async function findRoleByCode(db: SeedDb, code: string) {
  const role = await db.query.sysRole.findFirst({
    where: and(eq(sysRole.code, code), isNull(sysRole.deletedAt)),
  });
  if (!role) throw new Error(`系统角色缺失 code=${code}`);
  return role;
}

async function replaceRolePermissions(
  db: SeedDb,
  roleId: number,
  permissionCodes: readonly string[],
  creatorId: number,
) {
  await db
    .update(sysRolePermission)
    .set({ deletedAt: new Date() })
    .where(and(eq(sysRolePermission.roleId, roleId), isNull(sysRolePermission.deletedAt)));

  const uniqueCodes = [...new Set(permissionCodes)];
  if (uniqueCodes.length === 0) return;
  await db
    .insert(sysRolePermission)
    .values(uniqueCodes.map((permissionCode) => ({ roleId, permissionCode, creatorId })))
    .onDuplicateKeyUpdate({ set: { deletedAt: null, creatorId } });
}

export async function bindRolePermissionsByDefault(db: SeedDb, adminUserId: number) {
  const [superAdmin, admin] = await Promise.all([
    findRoleByCode(db, ROLE_CODES.SUPER_ADMIN),
    findRoleByCode(db, ROLE_CODES.ADMIN),
  ]);
  const allCodes = listPermissions().map((item) => item.code);
  const adminCodes = allCodes.filter((code) => !code.startsWith('system:plugin:'));

  await Promise.all([
    replaceRolePermissions(db, superAdmin.id, allCodes, adminUserId),
    replaceRolePermissions(db, admin.id, adminCodes, adminUserId),
  ]);
}
