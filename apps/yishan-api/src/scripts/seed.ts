import "dotenv/config";

import { prismaManager } from '../utils/prisma.js';
import { hashPassword } from '../utils/password.js';

const prisma = prismaManager.getClient();

async function main() {
  console.log('开始执行种子数据脚本...');

  try {
    // 检查或创建 admin 用户
    let adminUser = await prisma.sysUser.findUnique({
      where: { username: 'admin' }
    });

    if (!adminUser) {
      // 创建管理员用户
      const adminPassword = 'admin123';
      const hashedPassword = await hashPassword(adminPassword);

      adminUser = await prisma.sysUser.create({
        data: {
          username: 'admin',
          email: 'admin@yishan.com',
          phone: '13800138000', // 添加手机号
          passwordHash: hashedPassword,
          realName: '愚公',
          nickname: '超级管理员',
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
        realName: adminUser.realName,
        nickname: adminUser.nickname
      });

      console.log('🔑 管理员登录信息:');
      console.log('   用户名: admin');
      console.log('   密码: admin123');
    } else {
      console.log('管理员用户已存在，跳过创建');
    }

    // 创建系统默认角色（超级管理员、普通管理员）
    const SUPER_ADMIN = '超级管理员';
    const ADMIN = '普通管理员';

    const superAdminRole = await prisma.sysRole.upsert({
      where: { name: SUPER_ADMIN },
      update: {},
      create: {
        name: SUPER_ADMIN,
        description: '拥有系统最高权限',
        status: 1,
        isSystemDefault: true,
        creatorId: adminUser!.id,
        updaterId: adminUser!.id
      }
    });

    const adminRole = await prisma.sysRole.upsert({
      where: { name: ADMIN },
      update: {},
      create: {
        name: ADMIN,
        description: '拥有基础管理权限',
        status: 1,
        isSystemDefault: true,
        creatorId: adminUser!.id,
        updaterId: adminUser!.id
      }
    });

    console.log('✅ 系统默认角色已准备:', {
      superAdmin: superAdminRole.name,
      normalAdmin: adminRole.name
    });

    // 为管理员用户绑定“超级管理员”角色
    await prisma.sysUserRole.upsert({
      where: { userId_roleId: { userId: adminUser!.id, roleId: superAdminRole.id } },
      update: {},
      create: {
        userId: adminUser!.id,
        roleId: superAdminRole.id
      }
    });

    console.log('✅ 已为管理员用户绑定角色:', {
      user: adminUser!.username,
      role: superAdminRole.name
    });

    // ================================
    // 树形部门结构（愚公软件为一级目录）
    // ================================
    console.log('开始创建树形部门结构（愚公软件）...');

    // 辅助函数：按名称唯一进行 upsert
    const upsertDept = async (
      name: string,
      parentId: number | null,
      sortOrder: number,
      description?: string
    ) => {
      const dept = await prisma.sysDept.upsert({
        where: { name },
        update: {
          parentId: parentId ?? undefined,
          description,
          status: 1,
          sort_order: sortOrder,
          leaderId: adminUser!.id,
          updaterId: adminUser!.id
        },
        create: {
          name,
          parentId: parentId ?? undefined,
          description,
          status: 1,
          sort_order: sortOrder,
          leaderId: adminUser!.id,
          creatorId: adminUser!.id,
          updaterId: adminUser!.id
        }
      });
      return dept;
    };

    // 一级目录：愚公软件
    const rootYugong = await upsertDept('愚公软件', null, 0, '公司根节点');

    // 二级目录：公司层级
    const shHq = await upsertDept('上海总公司', rootYugong.id, 1, '总部');
    const czBranch = await upsertDept('常州分公司', rootYugong.id, 2, '分公司');

    // 三级目录：深圳总公司下的部门
    await upsertDept('研发部门（上海）', shHq.id, 1, '研发部门');
    await upsertDept('市场部门（上海）', shHq.id, 2, '市场部门');
    await upsertDept('测试部门（上海）', shHq.id, 3, '测试部门');
    await upsertDept('财务部门（上海）', shHq.id, 4, '财务部门');
    await upsertDept('运维部门（上海）', shHq.id, 5, '运维部门');

    // 三级目录：长沙分公司下的部门
    await upsertDept('市场部门（常州）', czBranch.id, 1, '市场部门');
    await upsertDept('财务部门（常州）', czBranch.id, 2, '财务部门');

    console.log('✅ 树形部门结构创建完成');

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