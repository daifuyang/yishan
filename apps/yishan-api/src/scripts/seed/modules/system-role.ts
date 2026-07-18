import { eq } from 'drizzle-orm';
import { sysRole, sysUserRole } from '@/db/schema';
import { rolesSeed } from '../config.js';
import type { SeedDb } from '../context.js';

type RoleSeedShape = { name: string; code: string; description: string };

async function ensureRole(
  db: SeedDb,
  roleSeed: RoleSeedShape,
  adminUserId: number,
) {
  await db
    .insert(sysRole)
    .values({
      name: roleSeed.name,
      code: roleSeed.code,
      description: roleSeed.description,
      status: 1,
      isSystemDefault: true,
      creatorId: adminUserId,
      updaterId: adminUserId,
    })
    .onDuplicateKeyUpdate({ set: { name: roleSeed.name, code: roleSeed.code } });

  const role = await db.query.sysRole.findFirst({ where: eq(sysRole.name, roleSeed.name) });
  if (!role) {
    throw new Error(`系统角色数据写入后未找到: ${roleSeed.name}`);
  }
  return role;
}

export async function ensureSystemRoles(db: SeedDb, adminUserId: number) {
  const superAdminRole = await ensureRole(db, rolesSeed.superAdmin, adminUserId);
  const adminRole = await ensureRole(db, rolesSeed.admin, adminUserId);
  const hospitalAccountRole = await ensureRole(db, rolesSeed.hospitalAccount, adminUserId);

  console.log('系统默认角色已准备:', {
    superAdmin: superAdminRole.name,
    normalAdmin: adminRole.name,
    hospitalAccount: hospitalAccountRole.name,
  });

  return { superAdminRole, adminRole, hospitalAccountRole };
}

export async function bindUserRole(db: SeedDb, userId: number, roleId: number) {
  await db
    .insert(sysUserRole)
    .values({ userId, roleId })
    .onDuplicateKeyUpdate({ set: { userId, roleId } });
}
