import type { PrismaClient } from '../../../generated/prisma/client.js';
import type { DeptSeedNode } from '../config.js';

async function upsertDept(prisma: PrismaClient, args: { name: string; parentId: number | null; sortOrder: number; description?: string; adminUserId: number }) {
  const { name, parentId, sortOrder, description, adminUserId } = args;
  return prisma.sysDept.upsert({
    where: { name },
    update: {
      parentId: parentId ?? undefined,
      description,
      status: 1,
      sort_order: sortOrder,
      leaderId: adminUserId,
      updaterId: adminUserId,
    },
    create: {
      name,
      parentId: parentId ?? undefined,
      description,
      status: 1,
      sort_order: sortOrder,
      leaderId: adminUserId,
      creatorId: adminUserId,
      updaterId: adminUserId,
    },
  });
}

async function upsertDeptTree(prisma: PrismaClient, node: DeptSeedNode, parentId: number | null, adminUserId: number) {
  const dept = await upsertDept(prisma, {
    name: node.name,
    parentId,
    sortOrder: node.sortOrder,
    description: node.description,
    adminUserId,
  });

  if (node.children?.length) {
    for (const child of node.children) {
      await upsertDeptTree(prisma, child, dept.id, adminUserId);
    }
  }
}

export async function seedDepartments(prisma: PrismaClient, adminUserId: number, tree: DeptSeedNode) {
  console.log('开始创建树形部门结构...');
  await upsertDeptTree(prisma, tree, null, adminUserId);
  console.log('树形部门结构创建完成');
}

