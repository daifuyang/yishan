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

    const upsertPost = async (
      name: string,
      sortOrder: number,
      description?: string
    ) => {
      const post = await prisma.sysPost.upsert({
        where: { name },
        update: {
          status: 1,
          sort_order: sortOrder,
          description,
          updaterId: adminUser!.id,
        },
        create: {
          name,
          status: 1,
          sort_order: sortOrder,
          description,
          creatorId: adminUser!.id,
          updaterId: adminUser!.id,
        },
      });
      return post;
    };

    await upsertPost('董事长', 1, '公司最高负责人');
    await upsertPost('项目经理', 2, '项目管理与协调');
    await upsertPost('人力资源', 3, '人事管理');
    await upsertPost('普通员工', 4, '基础岗位');

    console.log('✅ 岗位数据创建完成');

    console.log('开始创建系统菜单结构...');

    const upsertMenuByPath = async (
      name: string,
      path: string,
      type: number,
      sortOrder: number,
      parentId: number | null,
      icon?: string,
      component?: string
    ) => {
      const existing = await prisma.sysMenu.findFirst({ where: { path } });
      if (existing) {
        const menu = await prisma.sysMenu.update({
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
            updaterId: adminUser!.id,
          },
        });
        return menu;
      } else {
        const menu = await prisma.sysMenu.create({
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
            creatorId: adminUser!.id,
            updaterId: adminUser!.id,
          },
        });
        return menu;
      }
    };

    const systemRoot = await upsertMenuByPath('系统管理', '/system', 0, 1, null, 'setting');
    const childRoutes = [
      { path: '/system/user', name: '用户管理', component: './system/user' },
      { path: '/system/role', name: '角色管理', component: './system/role' },
      { path: '/system/department', name: '部门管理', component: './system/department' },
      { path: '/system/post', name: '岗位管理', component: './system/post' },
      { path: '/system/menu', name: '菜单管理', component: './system/menu' },
      { path: '/system/dict', name: '字典管理', component: './system/dict' },
    ];

    let childOrder = 1;
    for (const r of childRoutes) {
      if ((r as any).component) {
        const item = r as any;
        await upsertMenuByPath(item.name, item.path, 1, childOrder++, systemRoot.id, undefined, item.component);
      }
    }

    console.log('✅ 系统菜单结构创建完成');

    console.log('开始创建系统字典数据...');

    const upsertDictType = async (
      name: string,
      type: string,
      sortOrder: number,
      remark?: string
    ) => {
      const dictType = await prisma.sysDictType.upsert({
        where: { type },
        update: {
          name,
          status: 1,
          sort_order: sortOrder,
          remark,
          updaterId: adminUser!.id,
        },
        create: {
          name,
          type,
          status: 1,
          sort_order: sortOrder,
          remark,
          creatorId: adminUser!.id,
          updaterId: adminUser!.id,
        },
      });
      return dictType;
    };

    const upsertDictData = async (
      typeId: number,
      label: string,
      value: string,
      sortOrder: number,
      isDefault = false,
      remark?: string
    ) => {
      const dictData = await prisma.sysDictData.upsert({
        where: { typeId_value: { typeId, value } },
        update: {
          label,
          status: 1,
          sort_order: sortOrder,
          remark,
          isDefault,
          updaterId: adminUser!.id,
        },
        create: {
          typeId,
          label,
          value,
          status: 1,
          sort_order: sortOrder,
          remark,
          isDefault,
          creatorId: adminUser!.id,
          updaterId: adminUser!.id,
        },
      });
      return dictData;
    };

    const userGenderType = await upsertDictType('用户性别', 'user_gender', 1, '用户性别字典');
    await upsertDictData(userGenderType.id, '保密', '0', 0);
    await upsertDictData(userGenderType.id, '男', '1', 1);
    await upsertDictData(userGenderType.id, '女', '2', 2);

    const userStatusType = await upsertDictType('用户状态', 'user_status', 2, '用户状态字典');
    await upsertDictData(userStatusType.id, '禁用', '0', 0);
    await upsertDictData(userStatusType.id, '启用', '1', 1, true);
    await upsertDictData(userStatusType.id, '拉黑', '2', 2);

    const defaultStatusType = await upsertDictType('默认状态', 'default_status', 3, '通用启用/禁用状态字典');
    await upsertDictData(defaultStatusType.id, '禁用', '0', 0);
    await upsertDictData(defaultStatusType.id, '启用', '1', 1, true);

    console.log('✅ 系统字典数据创建完成');

    const upsertCategory = async (
      name: string,
      slug: string,
      parentId: number | null,
      sortOrder: number,
      description?: string
    ) => {
      const category = await prisma.portalCategory.upsert({
        where: { slug },
        update: {
          name,
          parentId: parentId ?? undefined,
          description,
          status: 1,
          sort_order: sortOrder,
          updaterId: adminUser!.id,
        },
        create: {
          name,
          slug,
          parentId: parentId ?? undefined,
          description,
          status: 1,
          sort_order: sortOrder,
          creatorId: adminUser!.id,
          updaterId: adminUser!.id,
        },
      });
      return category;
    };

    const newsCat = await upsertCategory('新闻', 'news', null, 1, '公司新闻');
    const noticeCat = await upsertCategory('公告', 'notice', null, 2, '系统公告');
    const blogCat = await upsertCategory('技术博客', 'blog', null, 3, '技术分享');

    const upsertPage = async (
      title: string,
      path: string,
      content: string,
      attributes?: Record<string, any>
    ) => {
      const existing = await prisma.portalPage.findFirst({ where: { path } });
      if (existing) {
        const page = await prisma.portalPage.update({
          where: { id: existing.id },
          data: {
            title,
            path,
            content,
            status: 1,
            publishTime: new Date(),
            attributes,
            updaterId: adminUser!.id,
          },
        });
        return page;
      } else {
        const page = await prisma.portalPage.create({
          data: {
            title,
            path,
            content,
            status: 1,
            publishTime: new Date(),
            attributes,
            creatorId: adminUser!.id,
            updaterId: adminUser!.id,
          },
        });
        return page;
      }
    };

    await upsertPage('首页', '/home', '欢迎访问门户网站', { banner: '/assets/banner.jpg' });
    await upsertPage('关于我们', '/about', '关于我们页面内容', { layout: 'full' });
    await upsertPage('联系我们', '/contact', '联系方式与地址', { form: true });

    // ================================
    // 模板：默认详情（文章）与默认页面（页面）
    // ================================
    const upsertTemplate = async (
      name: string,
      type: 'article' | 'page',
      description?: string,
      schema?: Record<string, any>,
      config?: Record<string, any>,
    ) => {
      const existed = await prisma.portalTemplate.findFirst({ where: { name, type: type === 'article' ? 1 : 2, deletedAt: null } });
      if (existed) {
        const updateData: any = {
          description: description ?? existed.description ?? undefined,
          schema: schema ? (schema as any) : undefined,
          config: config ? (config as any) : undefined,
          status: 1,
          isSystemDefault: true,
          updaterId: adminUser!.id,
        };
        const t = await prisma.portalTemplate.update({
          where: { id: existed.id },
          data: updateData,
        });
        return t;
      }
      const createData: any = {
        name,
        type: type === 'article' ? 1 : 2,
        description: description ?? null,
        schema: schema ? (schema as any) : undefined,
        config: config ? (config as any) : undefined,
        status: 1,
        isSystemDefault: true,
        creatorId: adminUser!.id,
        updaterId: adminUser!.id,
      };
      const t = await prisma.portalTemplate.create({ data: createData });
      return t;
    };

    await upsertTemplate('默认详情', 'article', '系统默认文章详情模板');
    await upsertTemplate('默认页面', 'page', '系统默认页面模板');

    // 初始化系统参数：默认模板ID
    try {
      const defaultArticle = await prisma.portalTemplate.findFirst({ where: { name: '默认详情', type: 1, deletedAt: null } });
      const defaultPage = await prisma.portalTemplate.findFirst({ where: { name: '默认页面', type: 2, deletedAt: null } });
      if (defaultArticle) {
        const existed = await prisma.sysOption.findFirst({ where: { key: 'defaultArticleTemplateId' } });
        if (existed) {
          await prisma.sysOption.update({ where: { id: existed.id }, data: { value: defaultArticle.id, updaterId: adminUser!.id } });
        } else {
          await prisma.sysOption.create({ data: { key: 'defaultArticleTemplateId', value: defaultArticle.id, status: 1, creatorId: adminUser!.id, updaterId: adminUser!.id } });
        }
      }
      if (defaultPage) {
        const existed = await prisma.sysOption.findFirst({ where: { key: 'defaultPageTemplateId' } });
        if (existed) {
          await prisma.sysOption.update({ where: { id: existed.id }, data: { value: defaultPage.id, updaterId: adminUser!.id } });
        } else {
          await prisma.sysOption.create({ data: { key: 'defaultPageTemplateId', value: defaultPage.id, status: 1, creatorId: adminUser!.id, updaterId: adminUser!.id } });
        }
      }
      console.log('✅ 系统默认模板参数初始化完成');
    } catch (e) {
      console.warn('⚠️ 系统默认模板参数初始化失败:', e);
    }

    const upsertArticle = async (
      title: string,
      slug: string,
      content: string,
      categoryIds: number[],
      status: number,
      isPinned: boolean,
      tags?: string[],
      attributes?: Record<string, any>
    ) => {
      const article = await prisma.portalArticle.upsert({
        where: { slug },
        update: {
          title,
          content,
          status,
          isPinned,
          publishTime: new Date(),
          tags,
          attributes,
          updaterId: adminUser!.id,
        },
        create: {
          title,
          slug,
          content,
          status,
          isPinned,
          publishTime: new Date(),
          tags,
          attributes,
          creatorId: adminUser!.id,
          updaterId: adminUser!.id,
        },
      });
      await prisma.portalArticleCategory.deleteMany({ where: { articleId: article.id } });
      if (categoryIds.length > 0) {
        await prisma.portalArticleCategory.createMany({
          data: categoryIds.map((cid) => ({ articleId: article.id, categoryId: cid })),
        });
      }
      return article;
    };

    await upsertArticle('欢迎使用门户', 'welcome', '这是门户的欢迎文章', [newsCat.id], 1, true, ['置顶', '公告'], { readingTime: 3 });
    await upsertArticle('系统发布 1.0', 'release-1-0', '系统 1.0 版本发布说明', [noticeCat.id], 1, false, ['发布'], { version: '1.0.0' });
    await upsertArticle('使用指南', 'how-to-use', '系统使用指南与最佳实践', [blogCat.id], 1, false, ['指南'], { level: 'beginner' });

    const portalRoot = await upsertMenuByPath('门户管理', '/portal', 0, 2, null, 'global');
    await upsertMenuByPath('文章管理', '/portal/articles', 1, 1, portalRoot.id, undefined, './portal/articles');
    await upsertMenuByPath('页面管理', '/portal/pages', 1, 2, portalRoot.id, undefined, './portal/pages');
    await upsertMenuByPath('分类管理', '/portal/categories', 1, 3, portalRoot.id, undefined, './portal/categories');
    // 模板管理菜单
    await upsertMenuByPath('文章模板', '/portal/article-templates', 1, 4, portalRoot.id, undefined, './portal/article-templates');
    await upsertMenuByPath('页面模板', '/portal/page-templates', 1, 5, portalRoot.id, undefined, './portal/page-templates');

    console.log('✅ 门户管理菜单创建完成');

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
