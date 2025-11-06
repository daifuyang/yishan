import "dotenv/config";

import { prismaManager } from '../utils/prisma.js';
import { hashPassword } from '../utils/password.js';

const prisma = prismaManager.getClient();

async function main() {
  console.log('开始执行种子数据脚本...');

  try {
    // 检查是否已存在admin用户
    const existingAdmin = await prisma.sysUser.findUnique({
      where: { username: 'admin' }
    });

    if (existingAdmin) {
      console.log('管理员用户已存在，跳过创建');
      return;
    }

    // 创建管理员用户
    const adminPassword = 'admin123';
    const hashedPassword = await hashPassword(adminPassword);

    const adminUser = await prisma.sysUser.create({
      data: {
        username: 'admin',
        email: 'admin@yishan.com',
        passwordHash: hashedPassword,
        // salt 已经包含在 passwordHash 中，不需要单独存储
        realName: '系统管理员',
        avatar: '',
        gender: 1, // 男性
        status: 1, // 启用状态
        loginCount: 0,
        creatorId: 1, // 自引用，管理员创建自己
        updaterId: 1, // 自引用，管理员更新自己
        version: 1
      }
    });

    console.log('✅ 管理员用户创建成功:', {
      id: adminUser.id,
      username: adminUser.username,
      email: adminUser.email,
      realName: adminUser.realName
    });

    console.log('🔑 管理员登录信息:');
    console.log('   用户名: admin');
    console.log('   密码: admin123');

  } catch (error) {
    console.error('❌ 种子数据创建失败:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error('种子脚本执行失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log('种子数据脚本执行完成');
  });