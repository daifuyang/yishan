import type { PrismaClient } from '../../../generated/prisma/client.js';
import type { PortalTemplateSeed } from '../config.js';

async function upsertTemplate(
  prisma: PrismaClient,
  adminUserId: number,
  t: PortalTemplateSeed,
) {
  const existed = await prisma.portalTemplate.findFirst({
    where: {
      name: t.name,
      type: t.type === 'article' ? 1 : 2,
      deletedAt: null,
    },
  });

  if (existed) {
    const updateData: any = {
      description: t.description ?? existed.description ?? undefined,
      schema: t.schema ? (t.schema as any) : undefined,
      config: t.config ? (t.config as any) : undefined,
      status: 1,
      isSystemDefault: true,
      updaterId: adminUserId,
    };
    return prisma.portalTemplate.update({ where: { id: existed.id }, data: updateData });
  }

  const createData: any = {
    name: t.name,
    type: t.type === 'article' ? 1 : 2,
    description: t.description ?? null,
    schema: t.schema ? (t.schema as any) : undefined,
    config: t.config ? (t.config as any) : undefined,
    status: 1,
    isSystemDefault: true,
    creatorId: adminUserId,
    updaterId: adminUserId,
  };
  return prisma.portalTemplate.create({ data: createData });
}

async function upsertSysOption(
  prisma: PrismaClient,
  adminUserId: number,
  key: string,
  value: string,
) {
  const existed = await prisma.sysOption.findFirst({ where: { key } });
  if (existed) {
    await prisma.sysOption.update({ where: { id: existed.id }, data: { value, updaterId: adminUserId } });
  } else {
    await prisma.sysOption.create({
      data: { key, value, status: 1, creatorId: adminUserId, updaterId: adminUserId },
    });
  }
}

export async function seedPortalTemplates(prisma: PrismaClient, adminUserId: number, templates: PortalTemplateSeed[]) {
  for (const t of templates) {
    await upsertTemplate(prisma, adminUserId, t);
  }

  // 初始化系统参数：默认模板ID（保持原逻辑）
  try {
    const defaultArticle = await prisma.portalTemplate.findFirst({ where: { name: '默认详情', type: 1, deletedAt: null } });
    const defaultPage = await prisma.portalTemplate.findFirst({ where: { name: '默认页面', type: 2, deletedAt: null } });
    if (defaultArticle) {
      await upsertSysOption(prisma, adminUserId, 'defaultArticleTemplateId', String(defaultArticle.id));
    }
    if (defaultPage) {
      await upsertSysOption(prisma, adminUserId, 'defaultPageTemplateId', String(defaultPage.id));
    }
    console.log('系统默认模板参数初始化完成');
  } catch (e) {
    console.warn('系统默认模板参数初始化失败:', e);
  }
}

