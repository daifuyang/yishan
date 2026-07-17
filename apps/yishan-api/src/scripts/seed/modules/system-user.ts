import { eq } from 'drizzle-orm';
import { sysUser } from '@/db/schema';
import { hashPassword } from '../../../utils/password.js';
import { adminSeed } from '../config.js';
import type { SeedDb } from '../context.js';

export async function ensureAdminUser(db: SeedDb): Promise<any> {
  let adminUser = await db.query.sysUser.findFirst({ where: eq(sysUser.username, adminSeed.username) });
  if (adminUser) {
    console.log('管理员用户已存在，跳过创建');
    return adminUser;
  }

  const hashedPassword = await hashPassword(adminSeed.password);

  await db.insert(sysUser).values({
    username: adminSeed.username,
    email: adminSeed.email,
    phone: adminSeed.phone,
    passwordHash: hashedPassword,
    realName: adminSeed.realName,
    nickname: adminSeed.nickname,
    avatar: adminSeed.avatar,
    gender: adminSeed.gender,
    status: 1,
    loginCount: 0,
    // 保持与原脚本一致：管理员创建自己（约定为 1）
    creatorId: 1,
    updaterId: 1,
    version: 1,
  });

  adminUser = await db.query.sysUser.findFirst({ where: eq(sysUser.username, adminSeed.username) });
  if (!adminUser) {
    throw new Error(`管理员用户数据写入后未找到: ${adminSeed.username}`);
  }

  console.log('管理员用户创建成功:', {
    id: adminUser.id,
    username: adminUser.username,
    email: adminUser.email,
    realName: adminUser.realName,
    nickname: adminUser.nickname,
  });
  console.log(`管理员账号已创建: ${adminSeed.username}`);

  return adminUser;
}
