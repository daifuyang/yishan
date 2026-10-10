import { and, eq, isNull } from 'drizzle-orm';
import { sysMenu, sysMenuPermission } from '@/db/schema';
import { PERMISSION_CODES } from '@yishan/core-api/permissions/catalog';
import type { MenuSeedNode } from '../config.js';
import type { SeedDb } from '../context.js';

async function ensureMenuByPath(args: {
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
  adminUserId: number;
}) {
  const { db, name, path, type, sortOrder, parentId, icon, component, hideInMenu, isDefaultAction, adminUserId } = args;
  const parentCondition = parentId === null ? isNull(sysMenu.parentId) : eq(sysMenu.parentId, parentId);
  const existing = path
    ? await db.query.sysMenu.findFirst({ where: eq(sysMenu.path, path) })
    : await db.query.sysMenu.findFirst({ where: and(parentCondition, eq(sysMenu.name, name)) });
  if (existing) return { menu: existing, created: false };
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
    isExternalLink: false,
    keepAlive: false,
    updaterId: adminUserId,
  };
  await db.insert(sysMenu).values({
    ...commonData,
    creatorId: adminUserId,
  } as typeof sysMenu.$inferInsert);

  const created = path
    ? await db.query.sysMenu.findFirst({ where: eq(sysMenu.path, path) })
    : await db.query.sysMenu.findFirst({ where: and(parentCondition, eq(sysMenu.name, name)) });
  if (!created) {
    throw new Error(`菜单数据写入后未找到: ${path}`);
  }
  return { menu: created, created: true };
}

async function seedMenuTree(
  db: SeedDb,
  node: MenuSeedNode,
  parentId: number | null,
  adminUserId: number,
) {
  const { menu, created } = await ensureMenuByPath({
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
    adminUserId,
  });
  const codes = [...new Set(node.permissionCodes ?? [])];
  const knownCodes = new Set<string>(PERMISSION_CODES);
  const unknownCodes = codes.filter((code) => !knownCodes.has(code));
  if (unknownCodes.length) {
    throw new Error(`菜单 ${node.path} 引用了未定义的核心权限：${unknownCodes.join(', ')}`);
  }
  if (created && codes.length) {
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

export async function seedProductMenus(db: SeedDb, creatorId: number, nodes: readonly MenuSeedNode[]): Promise<void> {
  async function visit(node: MenuSeedNode, parentId: number | null, parentCreated: boolean): Promise<void> {
    let menuId = parentId;
    let menuCreated = parentCreated;
    if (node.path) {
      const { menu, created } = await ensureMenuByPath({ db, ...node, parentId, adminUserId: creatorId });
      menuId = menu.id;
      menuCreated = created;
    }
    if (menuCreated && menuId !== null) {
      for (const permissionCode of new Set(node.permissionCodes ?? [])) {
        await db.insert(sysMenuPermission).values({ menuId, permissionCode }).onDuplicateKeyUpdate({ set: { permissionCode } });
      }
    }
    for (const child of node.children ?? []) await visit(child, menuId, menuCreated);
  }
  for (const node of nodes) await visit(node, null, false);
}
