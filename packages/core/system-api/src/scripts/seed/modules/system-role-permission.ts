/**
 * 默认角色的后端功能/API 权限。
 *
 * 角色菜单与角色权限是两套独立关联：前者只控制导航可见性，后者才决定
 * requirePermission() 是否放行。权限码始终来自 Core 目录，
 * 种子不创建自由配置的权限定义。
 */

import { sysRolePermission } from '@/db/schema';
import { listPermissions } from '@yishan/core-api/permissions/catalog';
import type { SeedDb } from '../context.js';

async function insertRolePermissions(
  db: SeedDb,
  roleId: number,
  permissionCodes: readonly string[],
  creatorId: number,
) {
  const uniqueCodes = [...new Set(permissionCodes)];
  if (uniqueCodes.length === 0) return;
  await db
    .insert(sysRolePermission)
    .values(uniqueCodes.map((permissionCode) => ({ roleId, permissionCode, creatorId })))
    .onDuplicateKeyUpdate({ set: { roleId } });
}

export async function bindRolePermissionsByDefault(db: SeedDb, adminUserId: number, createdRoleIds: readonly number[]) {
  if (!createdRoleIds.length) return;
  const allCodes = listPermissions().map((item) => item.code);

  for (const id of createdRoleIds) await insertRolePermissions(db, id, allCodes, adminUserId);
}
