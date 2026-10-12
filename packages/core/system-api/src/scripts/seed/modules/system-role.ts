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
  const existing = await db.query.sysRole.findFirst({ where: eq(sysRole.code, roleSeed.code) });
  if (existing) return { role: existing, created: false };
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
    });

  const role = await db.query.sysRole.findFirst({ where: eq(sysRole.code, roleSeed.code) });
  if (!role) {
    throw new Error(`系统角色数据写入后未找到: ${roleSeed.name}`);
  }
  return { role, created: true };
}

export async function ensureSystemRoles(db: SeedDb, adminUserId: number) {
  const superAdmin = await ensureRole(db, rolesSeed.superAdmin, adminUserId);
  const admin = await ensureRole(db, rolesSeed.admin, adminUserId);
  const superAdminRole = superAdmin.role;
  const adminRole = admin.role;

  console.log('系统默认角色已准备:', {
    superAdmin: superAdminRole.name,
    normalAdmin: adminRole.name,
  });

  return { superAdminRole, adminRole, createdRoleIds: [superAdmin, admin].filter(result => result.created).map(result => result.role.id) };
}

export async function bindUserRole(db: SeedDb, userId: number, roleId: number) {
  await db
    .insert(sysUserRole)
    .values({ userId, roleId })
    .onDuplicateKeyUpdate({ set: { userId, roleId } });
}
