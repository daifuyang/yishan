import { prismaManager } from "../utils/prisma.js";
import type { Prisma } from "../generated/prisma/client.js";
import {
  AppResourceListQuery,
  AppResourceTreeNode,
  CreateAppResourceReq,
  SysAppResourceResp,
  UpdateAppResourceReq,
} from "../schemas/app-resource.js";
import { dateUtils } from "../utils/date.js";

type AppResourceWithRelations = Prisma.SysAppResourceGetPayload<{
  include: {
    parent: { select: { name: true } };
    creator: { select: { username: true } };
    updater: { select: { username: true } };
  };
}> & {
  parentName?: string;
  creatorName?: string;
  updaterName?: string;
};

export class SysAppResourceModel {
  private static prisma = prismaManager.getClient();

  private static mapToResp(resource: AppResourceWithRelations): SysAppResourceResp {
    return {
      id: resource.id,
      appId: resource.appId,
      parentId: resource.parentId ?? undefined,
      type: resource.type,
      name: resource.name,
      description: resource.description ?? undefined,
      status: resource.status.toString(),
      sort_order: resource.sort_order ?? 0,
      config: resource.config ?? undefined,
      creatorId: resource.creatorId ?? undefined,
      creatorName: resource.creator?.username ?? resource.creatorName,
      createdAt: dateUtils.formatISO(resource.createdAt)!,
      updaterId: resource.updaterId ?? undefined,
      updaterName: resource.updater?.username ?? resource.updaterName,
      updatedAt: dateUtils.formatISO(resource.updatedAt)!,
    };
  }

  static async getResourceList(appId: number, query: AppResourceListQuery): Promise<SysAppResourceResp[]> {
    const { page = 1, pageSize = 10, keyword, status, type, parentId, sortBy = "sort_order", sortOrder = "asc" } = query;
    const where: any = { deletedAt: null, appId };
    if (keyword) {
      where.OR = [{ name: { contains: keyword } }, { description: { contains: keyword } }];
    }
    if (status !== undefined) where.status = parseInt(status as string, 10);
    if (type) where.type = type;
    if (parentId !== undefined) where.parentId = parentId;
    
    const orderBy: any = {};
    orderBy[sortBy] = sortOrder;
    const resources = await this.prisma.sysAppResource.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        parent: { select: { name: true } },
        creator: { select: { username: true } },
        updater: { select: { username: true } },
      },
    });
    return resources.map((r) => this.mapToResp(r));
  }

  static async getResourceTotal(appId: number, query: AppResourceListQuery): Promise<number> {
    const { keyword, status, type, parentId } = query;
    const where: any = { deletedAt: null, appId };
    if (keyword) {
      where.OR = [{ name: { contains: keyword } }, { description: { contains: keyword } }];
    }
    if (status !== undefined) where.status = parseInt(status as string, 10);
    if (type) where.type = type;
    if (parentId !== undefined) where.parentId = parentId;
    return await this.prisma.sysAppResource.count({ where });
  }

  static async getResourceById(appId: number, id: number): Promise<SysAppResourceResp | null> {
    const resource = await this.prisma.sysAppResource.findFirst({
      where: { id, appId, deletedAt: null },
      include: {
        parent: { select: { name: true } },
        creator: { select: { username: true } },
        updater: { select: { username: true } },
      },
    });
    if (!resource) return null;
    return this.mapToResp(resource);
  }

  static async getResourceByName(appId: number, name: string) {
    return await this.prisma.sysAppResource.findFirst({
      where: { appId, name, deletedAt: null },
    });
  }

  static async getResourceTree(appId: number, rootId?: number | null): Promise<AppResourceTreeNode[]> {
    const resources = await this.prisma.sysAppResource.findMany({
      where: { deletedAt: null, appId },
      orderBy: { sort_order: "asc" },
      include: {
        parent: { select: { name: true } },
        creator: { select: { username: true } },
        updater: { select: { username: true } },
      },
    });

    const nodeMap = new Map<number, AppResourceTreeNode>();
    const roots: AppResourceTreeNode[] = [];

    for (const resource of resources) {
      const node: AppResourceTreeNode = { ...this.mapToResp(resource), children: null } as any;
      nodeMap.set(resource.id, node);
    }

    for (const resource of resources) {
      const node = nodeMap.get(resource.id)!;
      const pid = resource.parentId ?? null;
      const isRootMatch = rootId === undefined ? pid === null : pid === (rootId ?? null);
      if (isRootMatch) {
        roots.push(node);
      } else if (pid !== null) {
        const parentNode = nodeMap.get(pid);
        if (parentNode) {
          if (!parentNode.children) parentNode.children = [];
          (parentNode.children as AppResourceTreeNode[]).push(node);
        }
      }
    }

    return roots;
  }

  static async createResource(appId: number, req: CreateAppResourceReq, userId: number): Promise<SysAppResourceResp> {
    const resource = await this.prisma.sysAppResource.create({
      data: {
        appId,
        parentId: req.parentId ?? null,
        type: req.type,
        name: req.name,
        description: req.description,
        status: req.status ? parseInt(req.status, 10) : 1,
        sort_order: req.sort_order ?? 0,
        config: req.config ?? undefined,
        creatorId: userId,
        updaterId: userId,
      },
      include: {
        parent: { select: { name: true } },
        creator: { select: { username: true } },
        updater: { select: { username: true } },
      },
    });
    return this.mapToResp(resource);
  }

  static async updateResource(appId: number, id: number, req: UpdateAppResourceReq, userId: number): Promise<SysAppResourceResp> {
    const updateData: any = { updaterId: userId };
    if (req.parentId !== undefined) updateData.parentId = req.parentId ?? null;
    if (req.type !== undefined) updateData.type = req.type;
    if (req.name !== undefined) updateData.name = req.name;
    if (req.description !== undefined) updateData.description = req.description;
    if (req.status !== undefined) updateData.status = parseInt(req.status, 10);
    if (req.sort_order !== undefined) updateData.sort_order = req.sort_order;
    if (req.config !== undefined) updateData.config = req.config;
    const resource = await this.prisma.sysAppResource.update({
      where: { id, appId, deletedAt: null },
      data: updateData,
      include: {
        parent: { select: { name: true } },
        creator: { select: { username: true } },
        updater: { select: { username: true } },
      },
    });
    return this.mapToResp(resource);
  }

  static async deleteResource(appId: number, id: number, userId: number): Promise<{ id: number } | null> {
    const existing = await this.prisma.sysAppResource.findFirst({ where: { id, appId, deletedAt: null } });
    if (!existing) return null;
    await this.prisma.sysAppResource.update({
      where: { id },
      data: { deletedAt: new Date(), status: 0, updaterId: userId },
    });
    return { id };
  }
}
