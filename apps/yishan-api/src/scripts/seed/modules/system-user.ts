import type { PrismaClient, SysUser } from '../../../generated/prisma/client.js';
import { hashPassword } from '../../../utils/password.js';
import { adminSeed } from '../config.js';

export async function ensureAdminUser(prisma: PrismaClient): Promise<SysUser> {
  let adminUser = await prisma.sysUser.findUnique({ where: { username: adminSeed.username } });
  if (adminUser) {
    console.log('管理员用户已存在，跳过创建');
    return adminUser;
  }

  const hashedPassword = await hashPassword(adminSeed.password);

  adminUser = await prisma.sysUser.create({
    data: {
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
    },
  });

  console.log('管理员用户创建成功:', {
    id: adminUser.id,
    username: adminUser.username,
    email: adminUser.email,
    realName: adminUser.realName,
    nickname: adminUser.nickname,
  });
  console.log('管理员登录信息:');
  console.log(`用户名: ${adminSeed.username}`);
  console.log(`密码: ${adminSeed.password}`);

  return adminUser;
}

