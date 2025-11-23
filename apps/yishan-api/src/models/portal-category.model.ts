import { prismaManager } from "../utils/prisma.js";
import type { Prisma } from "../generated/prisma/client.js";
import { CategoryListQuery, PortalCategoryResp, SaveCategoryReq, UpdateCategoryReq } from "../schemas/article.js";
import { dateUtils } from "../utils/date.js";

type CategoryWithRelations = Prisma.PortalCategoryGetPayload<{
  include: {
    parent: { select: { name: true } };
    creator: { select: { username: true } };
    updater: { select: { username: true } };
  };
}> & { parentName?: string; creatorName?: string; updaterName?: string };

export class PortalCategoryModel {
  private static prisma = prismaManager.getClient();

  private static toResp(c: CategoryWithRelations): PortalCategoryResp {
    return {
      id: c.id,
      name: c.name,
      slug: c.slug ?? undefined,
      parentId: c.parentId ?? 0,
      parentName: c.parent?.name ?? c.parentName,
      status: c.status.toString(),
      sort_order: c.sort_order ?? 0,
      description: c.description ?? undefined,
      creatorId: c.creatorId ?? undefined,
      creatorName: c.creator?.username ?? c.creatorName,
      createdAt: dateUtils.formatISO(c.createdAt)!,
      updaterId: c.updaterId ?? undefined,
      updaterName: c.updater?.username ?? c.updaterName,
      updatedAt: dateUtils.formatISO(c.updatedAt)!,
    };
  }

  static async getCategoryList(query: CategoryListQuery): Promise<PortalCategoryResp[]> {
    const { page = 1, pageSize = 10, keyword, status, parentId, sortBy = "sort_order", sortOrder = "asc" } = query;
    const where: any = { deletedAt: null };
    if (keyword) {
      where.OR = [{ name: { contains: keyword } }, { description: { contains: keyword } }];
    }
    if (status !== undefined) where.status = parseInt(status as string, 10);
    if (parentId !== undefined) where.parentId = parentId;
    const orderBy: any = {}; orderBy[sortBy] = sortOrder;
    const categories = await this.prisma.portalCategory.findMany({
      where,
      orderBy,
      skip: pageSize === 0 ? undefined : (page - 1) * pageSize,
      take: pageSize === 0 ? undefined : pageSize,
      include: { parent: { select: { name: true } }, creator: { select: { username: true } }, updater: { select: { username: true } } },
    });
    return categories.map((c) => this.toResp(c as CategoryWithRelations));
  }

  static async getCategoryTotal(query: CategoryListQuery): Promise<number> {
    const { keyword, status, parentId } = query;
    const where: any = { deletedAt: null };
    if (keyword) where.OR = [{ name: { contains: keyword } }, { description: { contains: keyword } }];
    if (status !== undefined) where.status = parseInt(status as string, 10);
    if (parentId !== undefined) where.parentId = parentId;
    return await this.prisma.portalCategory.count({ where });
  }

  static async getCategoryById(id: number): Promise<PortalCategoryResp | null> {
    const c = await this.prisma.portalCategory.findFirst({
      where: { id, deletedAt: null },
      include: { parent: { select: { name: true } }, creator: { select: { username: true } }, updater: { select: { username: true } } },
    });
    if (!c) return null; return this.toResp(c as CategoryWithRelations);
  }

  static async getCategoryByName(name: string, parentId?: number) {
    return await this.prisma.portalCategory.findFirst({ where: { name, parentId: parentId ?? null, deletedAt: null } });
  }

  static async createCategory(req: SaveCategoryReq, userId: number): Promise<PortalCategoryResp> {
    const c = await this.prisma.portalCategory.create({
      data: {
        name: req.name,
        slug: req.slug ?? null,
        parentId: req.parentId ?? null,
        status: req.status ? parseInt(req.status, 10) : 1,
        sort_order: req.sort_order ?? 0,
        description: req.description ?? null,
        creatorId: userId,
        updaterId: userId,
      },
      include: { parent: { select: { name: true } }, creator: { select: { username: true } }, updater: { select: { username: true } } },
    });
    return this.toResp(c as CategoryWithRelations);
  }

  static async updateCategory(id: number, req: UpdateCategoryReq, userId?: number): Promise<PortalCategoryResp> {
    const data: any = {};
    if (req.name !== undefined) data.name = req.name;
    if (req.slug !== undefined) data.slug = req.slug ?? null;
    if (req.parentId !== undefined) data.parentId = req.parentId ?? null;
    if (req.status !== undefined) data.status = parseInt(req.status, 10);
    if (req.sort_order !== undefined) data.sort_order = req.sort_order;
    if (req.description !== undefined) data.description = req.description ?? null;
    if (userId) data.updaterId = userId;
    const c = await this.prisma.portalCategory.update({
      where: { id },
      data,
      include: { parent: { select: { name: true } }, creator: { select: { username: true } }, updater: { select: { username: true } } },
    });
    return this.toResp(c as CategoryWithRelations);
  }

  static async deleteCategory(id: number): Promise<{ id: number } | null> {
    const exists = await this.prisma.portalCategory.findFirst({ where: { id, deletedAt: null } });
    if (!exists) return null;
    await this.prisma.portalCategory.update({ where: { id }, data: { deletedAt: new Date(), status: 0 } });
    return { id };
  }
}

