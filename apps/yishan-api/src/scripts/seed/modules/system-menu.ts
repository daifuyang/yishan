import { and, eq, isNull } from 'drizzle-orm';
import { sysMenu, sysMenuPermission } from '@/db/schema';
import { PERMISSION_DEFINITIONS } from '@/constants/permission-codes.js';
import crmManifest from '@/plugins/modules/crm/manifest.js';
import type { MenuSeedNode } from '../config.js';
import type { SeedDb } from '../context.js';

async function upsertMenuByPath(args: {
  db: SeedDb;
  name: string;
  path?: string;
  type: number;
  sortOrder: number;
  parentId: number | null;
  icon?: string;
  component?: string;
  hideInMenu?: boolean;
  isDefaultAction?: boolean;
  source?: 'custom' | 'plugin';
  pluginName?: string;
  pluginMenuKey?: string;
  adminUserId: number;
}) {
  const { db, name, path, type, sortOrder, parentId, icon, component, hideInMenu, isDefaultAction, source, pluginName, pluginMenuKey, adminUserId } = args;
  const parentCondition = parentId === null ? isNull(sysMenu.parentId) : eq(sysMenu.parentId, parentId);
  const existing = path
    ? await db.query.sysMenu.findFirst({ where: eq(sysMenu.path, path) })
    : await db.query.sysMenu.findFirst({ where: and(parentCondition, eq(sysMenu.name, name), isNull(sysMenu.deletedAt)) });
  const commonData: Record<string, unknown> = {
    name,
    type,
    parentId,
    ...(path !== undefined ? { path } : {}),
    ...(icon !== undefined ? { icon } : {}),
    ...(component !== undefined ? { component } : {}),
    status: 1,
    sortOrder,
    hideInMenu: hideInMenu ?? false,
    isDefaultAction: isDefaultAction ?? false,
    ...(source !== undefined ? { source } : {}),
    ...(pluginName !== undefined ? { pluginName } : {}),
    ...(pluginMenuKey !== undefined ? { pluginMenuKey } : {}),
    isExternalLink: false,
    keepAlive: false,
    updaterId: adminUserId,
  };
  if (existing) {
    await db.update(sysMenu).set(commonData).where(eq(sysMenu.id, existing.id));
    return existing;
  }

  await db.insert(sysMenu).values({
    ...commonData,
    creatorId: adminUserId,
  } as typeof sysMenu.$inferInsert);

  const created = path
    ? await db.query.sysMenu.findFirst({ where: eq(sysMenu.path, path) })
    : await db.query.sysMenu.findFirst({ where: and(parentCondition, eq(sysMenu.name, name), isNull(sysMenu.deletedAt)) });
  if (!created) {
    throw new Error(`菜单数据写入后未找到: ${path}`);
  }
  return created;
}

async function seedMenuTree(
  db: SeedDb,
  node: MenuSeedNode,
  parentId: number | null,
  adminUserId: number,
) {
  const menu = await upsertMenuByPath({
    db,
    name: node.name,
    path: node.path,
    type: node.type,
    sortOrder: node.sortOrder,
    parentId,
    icon: node.icon,
    component: node.component,
    hideInMenu: node.hideInMenu,
    isDefaultAction: node.isDefaultAction,
    source: node.source,
    pluginName: node.pluginName,
    pluginMenuKey: node.pluginMenuKey,
    adminUserId,
  });
  const codes = [...new Set(node.permissionCodes ?? [])];
  const knownCodes = new Set([
    ...PERMISSION_DEFINITIONS.map((permission) => permission.code),
    ...crmManifest.permissions.map((permission) => permission.code),
  ]);
  const unknownCodes = codes.filter((code) => !knownCodes.has(code));
  if (unknownCodes.length) {
    throw new Error(`菜单 ${node.path} 引用了未定义的核心权限：${unknownCodes.join(', ')}`);
  }
  await db.delete(sysMenuPermission).where(eq(sysMenuPermission.menuId, menu.id));
  if (codes.length) {
    await db.insert(sysMenuPermission).values([...new Set(codes)].map((permissionCode) => ({ menuId: menu.id, permissionCode })));
  }

  if (node.children?.length) {
    for (const child of node.children) {
      await seedMenuTree(db, child, menu.id, adminUserId);
    }
  }
}

export async function seedMenus(db: SeedDb, adminUserId: number, roots: MenuSeedNode[]) {
  for (const root of roots) {
    await seedMenuTree(db, root, null, adminUserId);
  }
  console.log('系统菜单结构创建完成');
}
