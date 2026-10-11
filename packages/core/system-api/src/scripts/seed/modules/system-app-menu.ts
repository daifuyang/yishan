/**
 * system-app-menu.ts — App 工作台菜单种子（sys_workbench_menu / sys_role_workbench_menu）。
 *
 * 与 Web 的 sys_menu 完全独立。分组按名称、入口按 page 幂等：已存在即跳过，
 * 不覆盖管理员在后台做过的修改。
 */

import { and, eq, inArray, isNull } from 'drizzle-orm';
import { sysRole, sysRoleWorkbenchMenu, sysWorkbenchMenu } from '@/db/schema';
import { ROLE_CODES } from '@/constants/permission-codes.js';
import type { AppMenuSeedNode } from '../config.js';
import type { SeedDb } from '../context.js';

const CORE_MODULE_ID = 'core';

async function ensureGroup(db: SeedDb, node: AppMenuSeedNode, creatorId: number): Promise<number> {
  const [existing] = await db
    .select({ id: sysWorkbenchMenu.id })
    .from(sysWorkbenchMenu)
    .where(and(isNull(sysWorkbenchMenu.deletedAt), isNull(sysWorkbenchMenu.parentId), eq(sysWorkbenchMenu.name, node.name)))
    .limit(1);
  if (existing) return existing.id;
  const [inserted] = await db
    .insert(sysWorkbenchMenu)
    .values({
      parentId: null,
      type: 0,
      name: node.name,
      icon: node.icon ?? null,
      page: null,
      moduleId: CORE_MODULE_ID,
      sortOrder: node.sortOrder,
      status: 1,
      creatorId,
      updaterId: creatorId,
    })
    .$returningId();
  return inserted.id;
}

async function ensureEntry(
  db: SeedDb,
  node: AppMenuSeedNode,
  groupId: number,
  moduleId: string,
  creatorId: number,
): Promise<void> {
  if (!node.page) throw new Error(`工作台入口 ${node.name} 缺少 page`);
  const [existing] = await db
    .select({ id: sysWorkbenchMenu.id })
    .from(sysWorkbenchMenu)
    .where(and(isNull(sysWorkbenchMenu.deletedAt), eq(sysWorkbenchMenu.page, node.page)))
    .limit(1);
  if (existing) return;
  await db.insert(sysWorkbenchMenu).values({
    parentId: groupId,
    type: 1,
    name: node.name,
    icon: node.icon ?? null,
    page: node.page,
    moduleId,
    sortOrder: node.sortOrder,
    status: 1,
    creatorId,
    updaterId: creatorId,
  });
}

export async function seedAppMenus(
  db: SeedDb,
  creatorId: number,
  nodes: readonly AppMenuSeedNode[],
  moduleId: string = CORE_MODULE_ID,
): Promise<void> {
  for (const group of nodes) {
    const groupId = await ensureGroup(db, group, creatorId);
    for (const entry of group.children ?? []) {
      await ensureEntry(db, entry, groupId, moduleId, creatorId);
    }
  }
}

/** 新建角色的默认工作台授权：super_admin / admin 全部入口，普通角色仅标记 normalUser 的入口。 */
export async function bindRoleAppMenusByDefault(
  db: SeedDb,
  createdRoleIds: readonly number[],
  nodes: readonly AppMenuSeedNode[],
): Promise<void> {
  if (!createdRoleIds.length) return;
  const roles = await db.select().from(sysRole).where(inArray(sysRole.id, [...createdRoleIds]));
  const rows = await db
    .select({ id: sysWorkbenchMenu.id, parentId: sysWorkbenchMenu.parentId, page: sysWorkbenchMenu.page })
    .from(sysWorkbenchMenu)
    .where(isNull(sysWorkbenchMenu.deletedAt));
  const allIds = rows.map((row) => row.id);

  const normalPages = new Set(
    nodes.flatMap((group) => (group.children ?? []).filter((entry) => entry.normalUser).map((entry) => entry.page)),
  );
  const normalEntries = rows.filter((row) => row.page && normalPages.has(row.page));
  const normalIds = [
    ...new Set(normalEntries.flatMap((row) => (row.parentId == null ? [row.id] : [row.id, row.parentId]))),
  ];

  for (const role of roles) {
    const menuIds = role.code === ROLE_CODES.SUPER_ADMIN || role.code === ROLE_CODES.ADMIN ? allIds : normalIds;
    if (!menuIds.length) continue;
    await db
      .insert(sysRoleWorkbenchMenu)
      .values(menuIds.map((workbenchMenuId) => ({ roleId: role.id, workbenchMenuId })))
      .onDuplicateKeyUpdate({ set: { roleId: role.id } });
  }
  console.log('新建角色的默认工作台菜单已准备');
}
