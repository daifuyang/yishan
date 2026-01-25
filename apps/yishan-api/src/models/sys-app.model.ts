import { prismaManager } from "../utils/prisma.js";
import type { Prisma } from "../generated/prisma/client.js";
import { AppListQuery, SaveAppReq, SysAppResp, UpdateAppReq } from "../schemas/app.js";
import { dateUtils } from "../utils/date.js";

type AppWithRelations = Prisma.SysAppGetPayload<{
  include: {
    creator: { select: { username: true } };
    updater: { select: { username: true } };
  };
}> & {
  creatorName?: string;
  updaterName?: string;
};

export class SysAppModel {
  private static prisma = prismaManager.getClient();

  private static mapToResp(app: AppWithRelations): SysAppResp {
    return {
      id: app.id,
      name: app.name,
      icon: app.icon ?? undefined,
      iconColor: app.iconColor ?? undefined,
      status: app.status.toString(),
      sort_order: app.sort_order ?? 0,
      description: app.description ?? undefined,
      creatorId: app.creatorId ?? undefined,
      creatorName: app.creator?.username ?? app.creatorName,
      createdAt: dateUtils.formatISO(app.createdAt)!,
      updaterId: app.updaterId ?? undefined,
      updaterName: app.updater?.username ?? app.updaterName,
      updatedAt: dateUtils.formatISO(app.updatedAt)!,
    };
  }

  static async getAppList(query: AppListQuery): Promise<SysAppResp[]> {
    const { page = 1, pageSize = 10, keyword, status, sortBy = "sort_order", sortOrder = "asc" } = query;
    const where: any = { deletedAt: null };
    if (keyword) {
      where.OR = [{ name: { contains: keyword } }, { description: { contains: keyword } }];
    }
    if (status !== undefined) {
      where.status = parseInt(status as string, 10);
    }
    const orderBy: any = {};
    orderBy[sortBy] = sortOrder;
    const apps = await this.prisma.sysApp.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        creator: { select: { username: true } },
        updater: { select: { username: true } },
      },
    });
    return apps.map((a) => this.mapToResp(a));
  }

  static async getAppTotal(query: AppListQuery): Promise<number> {
    const { keyword, status } = query;
    const where: any = { deletedAt: null };
    if (keyword) {
      where.OR = [{ name: { contains: keyword } }, { description: { contains: keyword } }];
    }
    if (status !== undefined) {
      where.status = parseInt(status as string, 10);
    }
    return await this.prisma.sysApp.count({ where });
  }

  static async getAppById(id: number): Promise<SysAppResp | null> {
    const app = await this.prisma.sysApp.findFirst({
      where: { id, deletedAt: null },
      include: {
        creator: { select: { username: true } },
        updater: { select: { username: true } },
      },
    });
    if (!app) return null;
    return this.mapToResp(app);
  }

  static async getAppByName(name: string) {
    return await this.prisma.sysApp.findFirst({
      where: {
        name,
        deletedAt: null,
      },
    });
  }

  static async createApp(req: SaveAppReq, userId: number): Promise<SysAppResp> {
    const app = await this.prisma.sysApp.create({
      data: {
        name: req.name,
        icon: req.icon,
        iconColor: req.iconColor,
        status: req.status ? parseInt(req.status, 10) : 1,
        sort_order: req.sort_order ?? 0,
        description: req.description,
        creatorId: userId,
        updaterId: userId,
      },
      include: {
        creator: { select: { username: true } },
        updater: { select: { username: true } },
      },
    });
    return this.mapToResp(app);
  }

  static async updateApp(id: number, req: UpdateAppReq, userId: number): Promise<SysAppResp> {
    const updateData: any = { updaterId: userId };
    if (req.name !== undefined) updateData.name = req.name;
    if (req.icon !== undefined) updateData.icon = req.icon;
    if (req.iconColor !== undefined) updateData.iconColor = req.iconColor;
    if (req.status !== undefined) updateData.status = parseInt(req.status, 10);
    if (req.sort_order !== undefined) updateData.sort_order = req.sort_order;
    if (req.description !== undefined) updateData.description = req.description;
    const app = await this.prisma.sysApp.update({
      where: { id, deletedAt: null },
      data: updateData,
      include: {
        creator: { select: { username: true } },
        updater: { select: { username: true } },
      },
    });
    return this.mapToResp(app);
  }

  static async deleteApp(id: number, userId: number): Promise<{ id: number } | null> {
    const existing = await this.prisma.sysApp.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return null;
    await this.prisma.sysApp.update({
      where: { id },
      data: { deletedAt: new Date(), status: 0, updaterId: userId },
    });
    return { id };
  }
}
