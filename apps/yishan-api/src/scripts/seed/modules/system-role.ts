import type { PrismaClient } from '../../../generated/prisma/client.js';
import { rolesSeed } from '../config.js';

export async function ensureSystemRoles(prisma: PrismaClient, adminUserId: number) {
  const superAdminRole = await prisma.sysRole.upsert({
    where: { name: rolesSeed.superAdmin.name },
    update: {},
    create: {
      name: rolesSeed.superAdmin.name,
      description: rolesSeed.superAdmin.description,
      status: 1,
      isSystemDefault: true,
      creatorId: adminUserId,
      updaterId: adminUserId,
    },
  });

  const adminRole = await prisma.sysRole.upsert({
    where: { name: rolesSeed.admin.name },
    update: {},
    create: {
      name: rolesSeed.admin.name,
      description: rolesSeed.admin.description,
      status: 1,
      isSystemDefault: true,
      creatorId: adminUserId,
      updaterId: adminUserId,
    },
  });

  console.log('系统默认角色已准备:', {
    superAdmin: superAdminRole.name,
    normalAdmin: adminRole.name,
  });

  return { superAdminRole, adminRole };
}

export async function bindUserRole(prisma: PrismaClient, userId: number, roleId: number) {
  await prisma.sysUserRole.upsert({
    where: { userId_roleId: { userId, roleId } },
    update: {},
    create: { userId, roleId },
  });
}

