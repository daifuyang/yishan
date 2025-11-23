import { prismaManager } from "../utils/prisma.js";
import type { Prisma } from "../generated/prisma/client.js";
import { PageListQuery, CreatePageReq, PortalPageResp, UpdatePageReq } from "../schemas/page.js";
import { dateUtils } from "../utils/date.js";

type PageWithRelations = Prisma.PortalPageGetPayload<{
  include: {
    creator: { select: { username: true } };
    updater: { select: { username: true } };
  };
}> & { creatorName?: string; updaterName?: string };

export class PortalPageModel {
  private static prisma = prismaManager.getClient();

  private static toResp(p: PageWithRelations): PortalPageResp {
    return {
      id: p.id,
      title: p.title,
      path: p.path,
      content: p.content,
      status: p.status.toString(),
      publishTime: dateUtils.formatISO(p.publishTime) ?? undefined,
      attributes: (p.attributes as any) ?? undefined,
      creatorId: p.creatorId ?? undefined,
      creatorName: p.creator?.username ?? p.creatorName,
      createdAt: dateUtils.formatISO(p.createdAt)!,
      updaterId: p.updaterId ?? undefined,
      updaterName: p.updater?.username ?? p.updaterName,
      updatedAt: dateUtils.formatISO(p.updatedAt)!,
    };
  }

  static async getPageList(query: PageListQuery): Promise<PortalPageResp[]> {
    const { page = 1, pageSize = 10, keyword, status, sortBy = "createdAt", sortOrder = "desc" } = query;
    const where: any = { deletedAt: null };
    if (keyword) where.OR = [{ title: { contains: keyword } }, { path: { contains: keyword } }];
    if (status !== undefined) where.status = parseInt(status as string, 10);
    const orderBy: any = {}; orderBy[sortBy] = sortOrder;
    const pages = await this.prisma.portalPage.findMany({
      where,
      orderBy,
      skip: pageSize === 0 ? undefined : (page - 1) * pageSize,
      take: pageSize === 0 ? undefined : pageSize,
      include: { creator: { select: { username: true } }, updater: { select: { username: true } } },
    });
    return pages.map((p) => this.toResp(p as PageWithRelations));
  }

  static async getPageTotal(query: PageListQuery): Promise<number> {
    const { keyword, status } = query;
    const where: any = { deletedAt: null };
    if (keyword) where.OR = [{ title: { contains: keyword } }, { path: { contains: keyword } }];
    if (status !== undefined) where.status = parseInt(status as string, 10);
    return await this.prisma.portalPage.count({ where });
  }

  static async getPageById(id: number): Promise<PortalPageResp | null> {
    const p = await this.prisma.portalPage.findFirst({ where: { id, deletedAt: null }, include: { creator: { select: { username: true } }, updater: { select: { username: true } } } });
    if (!p) return null; return this.toResp(p as PageWithRelations);
  }

  static async getPageByPath(path: string) { return await this.prisma.portalPage.findFirst({ where: { path, deletedAt: null } }); }

  static async createPage(req: CreatePageReq, userId: number): Promise<PortalPageResp> {
    const p = await this.prisma.portalPage.create({
      data: {
        title: req.title,
        path: req.path,
        content: req.content,
        status: req.status ? parseInt(req.status, 10) : 1,
        publishTime: req.publishTime ? new Date(req.publishTime) : null,
        attributes: req.attributes ? (req.attributes as any) : undefined,
        creatorId: userId,
        updaterId: userId,
      },
      include: { creator: { select: { username: true } }, updater: { select: { username: true } } },
    });
    return this.toResp(p as PageWithRelations);
  }

  static async updatePage(id: number, req: UpdatePageReq, userId?: number): Promise<PortalPageResp> {
    const data: any = {};
    if (req.title !== undefined) data.title = req.title;
    if (req.path !== undefined) data.path = req.path;
    if (req.content !== undefined) data.content = req.content;
    if (req.status !== undefined) data.status = parseInt(req.status, 10);
    if (req.publishTime !== undefined) data.publishTime = req.publishTime ? new Date(req.publishTime) : null;
    if (req.attributes !== undefined) data.attributes = req.attributes as any;
    if (userId) data.updaterId = userId;
    const p = await this.prisma.portalPage.update({ where: { id }, data, include: { creator: { select: { username: true } }, updater: { select: { username: true } } } });
    return this.toResp(p as PageWithRelations);
  }

  static async deletePage(id: number): Promise<{ id: number } | null> {
    const exists = await this.prisma.portalPage.findFirst({ where: { id, deletedAt: null } });
    if (!exists) return null;
    await this.prisma.portalPage.update({ where: { id }, data: { deletedAt: new Date(), status: 0 } });
    return { id };
  }
}
