import { prismaManager } from "../utils/prisma.js";
import type { Prisma } from "../generated/prisma/client.js";
import { ArticleListQuery, CreateArticleReq, PortalArticleResp, UpdateArticleReq } from "../schemas/article.js";
import { dateUtils } from "../utils/date.js";

type ArticleWithRelations = Prisma.PortalArticleGetPayload<{
  include: {
    creator: { select: { username: true } };
    updater: { select: { username: true } };
    articleCategories: { select: { categoryId: true } };
  };
}> & { creatorName?: string; updaterName?: string };

export class PortalArticleModel {
  private static prisma = prismaManager.getClient();

  private static toResp(a: ArticleWithRelations): PortalArticleResp {
    return {
      id: a.id,
      title: a.title,
      slug: a.slug ?? undefined,
      summary: a.summary ?? undefined,
      content: a.content,
      coverImage: a.coverImage ?? undefined,
      status: a.status.toString(),
      isPinned: a.isPinned ?? false,
      publishTime: dateUtils.formatISO(a.publishTime) ?? undefined,
      tags: Array.isArray(a.tags as any) ? (a.tags as any) : undefined,
      attributes: (a.attributes as any) ?? undefined,
      categoryIds: a.articleCategories?.map((c) => c.categoryId),
      creatorId: a.creatorId ?? undefined,
      creatorName: a.creator?.username ?? a.creatorName,
      createdAt: dateUtils.formatISO(a.createdAt)!,
      updaterId: a.updaterId ?? undefined,
      updaterName: a.updater?.username ?? a.updaterName,
      updatedAt: dateUtils.formatISO(a.updatedAt)!,
    };
  }

  static async getArticleList(query: ArticleListQuery): Promise<PortalArticleResp[]> {
    const { page = 1, pageSize = 10, keyword, status, categoryId, startTime, endTime, sortBy = "createdAt", sortOrder = "desc" } = query;

    const where: any = { deletedAt: null };

    if (keyword) {
      where.OR = [
        { title: { contains: keyword } },
        { summary: { contains: keyword } },
        { content: { contains: keyword } },
      ];
    }

    if (status !== undefined) {
      where.status = parseInt(status as string, 10);
    }

    if (startTime) {
      where.createdAt = where.createdAt || {};
      where.createdAt.gte = new Date(startTime);
    }
    if (endTime) {
      where.createdAt = where.createdAt || {};
      where.createdAt.lte = new Date(endTime);
    }

    const orderBy: any = {};
    orderBy[sortBy] = sortOrder;

    const articles = await this.prisma.portalArticle.findMany({
      where,
      orderBy,
      skip: pageSize === 0 ? undefined : (page - 1) * pageSize,
      take: pageSize === 0 ? undefined : pageSize,
      include: {
        creator: { select: { username: true } },
        updater: { select: { username: true } },
        articleCategories: categoryId ? { where: { categoryId }, select: { categoryId: true } } : { select: { categoryId: true } },
      },
    });

    // 如果指定了categoryId，需要过滤不包含该分类的文章（Prisma include无法直接过滤父记录）
    const filtered = categoryId
      ? articles.filter((a) => a.articleCategories.some((c) => c.categoryId === categoryId))
      : articles;

    return filtered.map((a) => this.toResp(a));
  }

  static async getArticleTotal(query: ArticleListQuery): Promise<number> {
    const { keyword, status, categoryId, startTime, endTime } = query;

    const where: any = { deletedAt: null };
    if (keyword) {
      where.OR = [
        { title: { contains: keyword } },
        { summary: { contains: keyword } },
        { content: { contains: keyword } },
      ];
    }
    if (status !== undefined) {
      where.status = parseInt(status as string, 10);
    }
    if (startTime) {
      where.createdAt = where.createdAt || {};
      where.createdAt.gte = new Date(startTime);
    }
    if (endTime) {
      where.createdAt = where.createdAt || {};
      where.createdAt.lte = new Date(endTime);
    }

    // categoryId统计需通过关联过滤
    if (categoryId) {
      return await this.prisma.portalArticle.count({
        where: {
          ...where,
          articleCategories: { some: { categoryId } },
        },
      });
    }
    return await this.prisma.portalArticle.count({ where });
  }

  static async getArticleById(id: number): Promise<PortalArticleResp | null> {
    const article = await this.prisma.portalArticle.findFirst({
      where: { id, deletedAt: null },
      include: {
        creator: { select: { username: true } },
        updater: { select: { username: true } },
        articleCategories: { select: { categoryId: true } },
      },
    });
    if (!article) return null;
    return this.toResp(article as ArticleWithRelations);
  }

  static async getArticleBySlug(slug: string) {
    return await this.prisma.portalArticle.findFirst({ where: { slug, deletedAt: null } });
  }

  static async createArticle(req: CreateArticleReq, userId: number): Promise<PortalArticleResp> {
    const result = await this.prisma.$transaction(async (tx) => {
      const created = await tx.portalArticle.create({
        data: {
          title: req.title,
          slug: req.slug ?? null,
          summary: req.summary ?? null,
          content: req.content,
          coverImage: req.coverImage ?? null,
          status: req.status ? parseInt(req.status, 10) : 0,
          isPinned: req.isPinned ?? false,
          publishTime: req.publishTime ? new Date(req.publishTime) : null,
          tags: req.tags ? (req.tags as any) : undefined,
          attributes: req.attributes ? (req.attributes as any) : undefined,
          creatorId: userId,
          updaterId: userId,
        },
        include: {
          creator: { select: { username: true } },
          updater: { select: { username: true } },
        },
      });

      if (req.categoryIds && req.categoryIds.length > 0) {
        await tx.portalArticleCategory.createMany({
          data: req.categoryIds.map((cid) => ({ articleId: created.id, categoryId: cid })),
        });
      }

      const final = await tx.portalArticle.findUnique({
        where: { id: created.id },
        include: {
          creator: { select: { username: true } },
          updater: { select: { username: true } },
          articleCategories: { select: { categoryId: true } },
        },
      });
      return final as ArticleWithRelations;
    });
    return this.toResp(result);
  }

  static async updateArticle(id: number, req: UpdateArticleReq, userId?: number): Promise<PortalArticleResp> {
    const data: any = {};
    if (req.title !== undefined) data.title = req.title;
    if (req.slug !== undefined) data.slug = req.slug ?? null;
    if (req.summary !== undefined) data.summary = req.summary ?? null;
    if (req.content !== undefined) data.content = req.content;
    if (req.coverImage !== undefined) data.coverImage = req.coverImage ?? null;
    if (req.status !== undefined) data.status = parseInt(req.status, 10);
    if (req.isPinned !== undefined) data.isPinned = req.isPinned;
    if (req.publishTime !== undefined) data.publishTime = req.publishTime ? new Date(req.publishTime) : null;
    if (req.tags !== undefined) data.tags = req.tags as any;
    if (req.attributes !== undefined) data.attributes = req.attributes as any;
    if (userId) data.updaterId = userId;

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.portalArticle.update({
        where: { id },
        data,
        include: {
          creator: { select: { username: true } },
          updater: { select: { username: true } },
        },
      });

      if (req.categoryIds) {
        await tx.portalArticleCategory.deleteMany({ where: { articleId: id } });
        if (req.categoryIds.length > 0) {
          await tx.portalArticleCategory.createMany({ data: req.categoryIds.map((cid) => ({ articleId: id, categoryId: cid })) });
        }
      }

      const final = await tx.portalArticle.findUnique({
        where: { id },
        include: {
          creator: { select: { username: true } },
          updater: { select: { username: true } },
          articleCategories: { select: { categoryId: true } },
        },
      });
      return final as ArticleWithRelations;
    });
    return this.toResp(result);
  }

  static async deleteArticle(id: number): Promise<{ id: number } | null> {
    const existing = await this.prisma.portalArticle.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return null;
    await this.prisma.portalArticle.update({ where: { id }, data: { deletedAt: new Date(), status: 0 } });
    return { id };
  }

  static async publishArticle(id: number, userId: number): Promise<PortalArticleResp | null> {
    const existing = await this.prisma.portalArticle.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return null;
    await this.prisma.portalArticle.update({
      where: { id },
      data: { status: 1, publishTime: dateUtils.now(), updaterId: userId },
      include: {
        creator: { select: { username: true } },
        updater: { select: { username: true } },
      },
    });
    const final = await this.prisma.portalArticle.findUnique({
      where: { id },
      include: { articleCategories: { select: { categoryId: true } }, creator: { select: { username: true } }, updater: { select: { username: true } } },
    });
    return this.toResp(final as ArticleWithRelations);
  }
}
