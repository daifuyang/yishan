import { eq } from 'drizzle-orm';
import { sysMenu } from '@/db/schema';
import type { MenuSeedNode } from '../config.js';
import type { SeedDb } from '../context.js';

async function upsertMenuByPath(args: {
  db: SeedDb;
  name: string;
  path: string;
  type: number;
  sortOrder: number;
  parentId: number | null;
  icon?: string;
  component?: string;
  hideInMenu?: boolean;
  perm?: string;
  adminUserId: number;
}) {
  const { db, name, path, type, sortOrder, parentId, icon, component, hideInMenu, perm, adminUserId } = args;
  const existing = await db.query.sysMenu.findFirst({ where: eq(sysMenu.path, path) });
  const commonData: Record<string, unknown> = {
    name,
    type,
    parentId,
    path,
    ...(icon !== undefined ? { icon } : {}),
    ...(component !== undefined ? { component } : {}),
    status: 1,
    sortOrder,
    hideInMenu: hideInMenu ?? false,
    isExternalLink: false,
    keepAlive: false,
    updaterId: adminUserId,
  };
  // perm 允许为 undefined：不写入字段；空串与有效值都写入。
  if (perm !== undefined) {
    commonData.perm = perm;
  }

  if (existing) {
    await db.update(sysMenu).set(commonData).where(eq(sysMenu.id, existing.id));
    return existing;
  }

  await db.insert(sysMenu).values({
    ...commonData,
    creatorId: adminUserId,
  } as typeof sysMenu.$inferInsert);

  const created = await db.query.sysMenu.findFirst({ where: eq(sysMenu.path, path) });
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
    perm: node.perm,
    adminUserId,
  });

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
