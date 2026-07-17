import { eq } from 'drizzle-orm';
import { sysDept } from '@/db/schema';
import type { DeptSeedNode } from '../config.js';
import type { SeedDb } from '../context.js';

async function upsertDept(db: SeedDb, args: { name: string; parentId: number | null; sortOrder: number; description?: string; adminUserId: number }) {
  const { name, parentId, sortOrder, description, adminUserId } = args;
  const updateData = {
    ...(parentId !== null ? { parentId } : {}),
    ...(description !== undefined ? { description } : {}),
    status: 1,
    sortOrder,
    leaderId: adminUserId,
    updaterId: adminUserId,
  };
  const createData = {
    name,
    ...(parentId !== null ? { parentId } : {}),
    ...(description !== undefined ? { description } : {}),
    status: 1,
    sortOrder,
    leaderId: adminUserId,
    creatorId: adminUserId,
    updaterId: adminUserId,
  };

  await db.insert(sysDept).values(createData).onDuplicateKeyUpdate({ set: updateData });

  const dept = await db.query.sysDept.findFirst({ where: eq(sysDept.name, name) });
  if (!dept) {
    throw new Error(`部门数据写入后未找到: ${name}`);
  }
  return dept;
}

async function upsertDeptTree(db: SeedDb, node: DeptSeedNode, parentId: number | null, adminUserId: number) {
  const dept = await upsertDept(db, {
    name: node.name,
    parentId,
    sortOrder: node.sortOrder,
    description: node.description,
    adminUserId,
  });

  if (node.children?.length) {
    for (const child of node.children) {
      await upsertDeptTree(db, child, dept.id, adminUserId);
    }
  }
}

export async function seedDepartments(db: SeedDb, adminUserId: number, tree: DeptSeedNode) {
  console.log('开始创建树形部门结构...');
  await upsertDeptTree(db, tree, null, adminUserId);
  console.log('树形部门结构创建完成');
}
