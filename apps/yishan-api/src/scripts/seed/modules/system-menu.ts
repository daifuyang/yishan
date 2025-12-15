import type { PrismaClient } from '../../../generated/prisma/client.js';
import type { MenuSeedNode } from '../config.js';

async function upsertMenuByPath(
  prisma: PrismaClient,
  args: {
    name: string;
    path: string;
    type: number;
    sortOrder: number;
    parentId: number | null;
    icon?: string;
    component?: string;
    adminUserId: number;
  },
) {
  const { name, path, type, sortOrder, parentId, icon, component, adminUserId } = args;
  const existing = await prisma.sysMenu.findFirst({ where: { path } });
  if (existing) {
    return prisma.sysMenu.update({
      where: { id: existing.id },
      data: {
        name,
        type,
        parentId,
        path,
        icon,
        component,
        status: 1,
        sort_order: sortOrder,
        hideInMenu: false,
        isExternalLink: false,
        keepAlive: false,
        updaterId: adminUserId,
      },
    });
  }

  return prisma.sysMenu.create({
    data: {
      name,
      type,
      parentId,
      path,
      icon,
      component,
      status: 1,
      sort_order: sortOrder,
      hideInMenu: false,
      isExternalLink: false,
      keepAlive: false,
      creatorId: adminUserId,
      updaterId: adminUserId,
    },
  });
}

async function seedMenuTree(
  prisma: PrismaClient,
  node: MenuSeedNode,
  parentId: number | null,
  adminUserId: number,
) {
  const menu = await upsertMenuByPath(prisma, {
    name: node.name,
    path: node.path,
    type: node.type,
    sortOrder: node.sortOrder,
    parentId,
    icon: node.icon,
    component: node.component,
    adminUserId,
  });

  if (node.children?.length) {
    for (const child of node.children) {
      await seedMenuTree(prisma, child, menu.id, adminUserId);
    }
  }
}

export async function seedMenus(prisma: PrismaClient, adminUserId: number, roots: MenuSeedNode[]) {
  for (const root of roots) {
    await seedMenuTree(prisma, root, null, adminUserId);
  }
  console.log('系统菜单结构创建完成');
}

