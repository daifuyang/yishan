/**
 * system-role-menu.ts — Section 1 RBAC 种子收尾。
 *
 * 将 sys_role 与 sys_menu 通过 sys_role_menu 关联起来。默认绑定策略：
 *   - super_admin  → 全部菜单
 *   - admin        → 全部菜单（除系统级敏感路径：站点配置、云存储）
 *   - normal_user  → 仅 account 菜单（个人中心、API Token）
 *
 * 仅初始化本次新建角色，保留已有授权及软删除记录。
 */

import { inArray, isNull } from 'drizzle-orm';
import { sysMenu, sysRole, sysRoleMenu } from '@/db/schema';
import { ROLE_CODES } from '@/constants/permission-codes.js';
import type { SeedDb } from '../context.js';

const ADMIN_EXCLUDED_PATH_PATTERNS = [
  '/system/site%',
  '/system/storage%',
];

function isAdminExcluded(path: string): boolean {
  return ADMIN_EXCLUDED_PATH_PATTERNS.some((p) => {
    const prefix = p.endsWith('%') ? p.slice(0, -1) : p;
    return path.startsWith(prefix);
  });
}

async function listAllMenuPaths(db: SeedDb): Promise<{ id: number; path: string }[]> {
  const rows = await db
    .select({ id: sysMenu.id, path: sysMenu.path })
    .from(sysMenu)
    .where(isNull(sysMenu.deletedAt));
  return rows.filter((r): r is { id: number; path: string } => Boolean(r.path));
}

async function bindRoleMenus(
  db: SeedDb,
  roleId: number,
  menuIds: number[],
) {
  if (menuIds.length === 0) return;
  await db
    .insert(sysRoleMenu)
    .values(menuIds.map((menuId) => ({ roleId, menuId })))
    .onDuplicateKeyUpdate({ set: { roleId } });
}

/**
 * 首次安装后补上新建角色的业务菜单，不重新授权已有角色。
 */
export async function bindRoleMenusByDefault(db: SeedDb, createdRoleIds: readonly number[]) {
  if (!createdRoleIds.length) return;
  const roles = await db.select().from(sysRole).where(inArray(sysRole.id, [...createdRoleIds]));
  const menus = await listAllMenuPaths(db);
  const accountMenuIds = menus
    .filter((m) => m.path.startsWith('/account'))
    .map((m) => m.id);
  const allMenuIds = menus.map((m) => m.id);
  const adminMenuIds = menus
    .filter((m) => !isAdminExcluded(m.path))
    .map((m) => m.id);
  for (const role of roles) {
    const menuIds = role.code === ROLE_CODES.SUPER_ADMIN ? allMenuIds
      : role.code === ROLE_CODES.ADMIN ? adminMenuIds : accountMenuIds;
    await bindRoleMenus(db, role.id, menuIds);
  }
  console.log('新建角色的默认菜单已准备');
}
