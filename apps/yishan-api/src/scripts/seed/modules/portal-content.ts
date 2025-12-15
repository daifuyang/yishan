import type { PrismaClient } from '../../../generated/prisma/client.js';
import type { PortalArticleSeed, PortalCategorySeed, PortalPageSeed } from '../config.js';

export async function seedPortalCategories(
  prisma: PrismaClient,
  adminUserId: number,
  categories: PortalCategorySeed[],
) {
  const slugToId = new Map<string, number>();

  // 先处理无 parent 的，再处理有 parent 的，保证 parent 存在
  const ordered = [...categories].sort((a, b) => {
    const aHasParent = a.parentSlug ? 1 : 0;
    const bHasParent = b.parentSlug ? 1 : 0;
    return aHasParent - bHasParent;
  });

  for (const c of ordered) {
    const parentId = c.parentSlug ? slugToId.get(c.parentSlug) ?? null : null;
    const category = await prisma.portalCategory.upsert({
      where: { slug: c.slug },
      update: {
        name: c.name,
        parentId: parentId ?? undefined,
        description: c.description,
        status: 1,
        sort_order: c.sortOrder,
        updaterId: adminUserId,
      },
      create: {
        name: c.name,
        slug: c.slug,
        parentId: parentId ?? undefined,
        description: c.description,
        status: 1,
        sort_order: c.sortOrder,
        creatorId: adminUserId,
        updaterId: adminUserId,
      },
    });
    slugToId.set(c.slug, category.id);
  }

  return slugToId;
}

export async function seedPortalPages(
  prisma: PrismaClient,
  adminUserId: number,
  pages: PortalPageSeed[],
) {
  for (const p of pages) {
    const existing = await prisma.portalPage.findFirst({ where: { path: p.path } });
    if (existing) {
      await prisma.portalPage.update({
        where: { id: existing.id },
        data: {
          title: p.title,
          path: p.path,
          content: p.content,
          status: 1,
          publishTime: new Date(),
          attributes: p.attributes,
          updaterId: adminUserId,
        },
      });
    } else {
      await prisma.portalPage.create({
        data: {
          title: p.title,
          path: p.path,
          content: p.content,
          status: 1,
          publishTime: new Date(),
          attributes: p.attributes,
          creatorId: adminUserId,
          updaterId: adminUserId,
        },
      });
    }
  }
}

export async function seedPortalArticles(
  prisma: PrismaClient,
  adminUserId: number,
  articles: PortalArticleSeed[],
  categorySlugToId: Map<string, number>,
) {
  for (const a of articles) {
    const categoryIds = a.categorySlugs
      .map((slug) => categorySlugToId.get(slug))
      .filter((id): id is number => typeof id === 'number');

    const article = await prisma.portalArticle.upsert({
      where: { slug: a.slug },
      update: {
        title: a.title,
        content: a.content,
        status: a.status,
        isPinned: a.isPinned,
        publishTime: new Date(),
        tags: a.tags,
        attributes: a.attributes,
        updaterId: adminUserId,
      },
      create: {
        title: a.title,
        slug: a.slug,
        content: a.content,
        status: a.status,
        isPinned: a.isPinned,
        publishTime: new Date(),
        tags: a.tags,
        attributes: a.attributes,
        creatorId: adminUserId,
        updaterId: adminUserId,
      },
    });

    await prisma.portalArticleCategory.deleteMany({ where: { articleId: article.id } });
    if (categoryIds.length > 0) {
      await prisma.portalArticleCategory.createMany({
        data: categoryIds.map((cid) => ({ articleId: article.id, categoryId: cid })),
      });
    }
  }
}

