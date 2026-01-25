import { prismaManager } from "../utils/prisma.js";
import { dateUtils } from "../utils/date.js";
import type { Prisma } from "../generated/prisma/client.js";
import { AppMenuListQuery, SaveAppMenuReq, SysAppMenuResp, UpdateAppMenuReq, AppMenuTreeNode } from "../schemas/app-menu.js";

type AppMenuWithRelations = Prisma.SysAppMenuGetPayload<{
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

export class SysAppMenuModel {
  private static prisma = prismaManager.getClient();

  private static mapToResp(menu: AppMenuWithRelations): SysAppMenuResp {
    return {
      id: menu.id,
      appId: menu.appId,
      name: menu.name,
      type: menu.type,
      path: menu.path ?? undefined,
      icon: menu.icon ?? undefined,
      component: menu.component ?? undefined,
      parentId: menu.parentId ?? undefined,
      parentName: menu.parent?.name ?? menu.parentName,
      status: menu.status.toString(),
      sort_order: menu.sort_order ?? 0,
      hideInMenu: !!menu.hideInMenu,
      isExternalLink: !!menu.isExternalLink,
      perm: menu.perm ?? undefined,
      keepAlive: !!menu.keepAlive,
      resourceId: menu.resourceId ?? undefined,
      creatorId: menu.creatorId ?? undefined,
      creatorName: menu.creator?.username ?? menu.creatorName,
      createdAt: dateUtils.formatISO(menu.createdAt)!,
      updaterId: menu.updaterId ?? undefined,
      updaterName: menu.updater?.username ?? menu.updaterName,
      updatedAt: dateUtils.formatISO(menu.updatedAt)!,
    };
  }

  static async getMenuList(appId: number, query: AppMenuListQuery): Promise<SysAppMenuResp[]> {
    const { page = 1, pageSize = 10, keyword, status, type, parentId, sortBy = "sort_order", sortOrder = "asc" } = query;
    const where: any = { deletedAt: null, appId };
    if (keyword) {
      where.OR = [
        { name: { contains: keyword } },
        { path: { contains: keyword } },
        { component: { contains: keyword } },
        { perm: { contains: keyword } },
      ];
    }
    if (status !== undefined) where.status = parseInt(status as string, 10);
    if (type !== undefined) where.type = type;
    if (parentId !== undefined) where.parentId = parentId;
    const orderBy: any = {};
    orderBy[sortBy] = sortOrder;
    const menus = await this.prisma.sysAppMenu.findMany({
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
    return menus.map((m) => this.mapToResp(m));
  }

  static async getMenuTotal(appId: number, query: AppMenuListQuery): Promise<number> {
    const { keyword, status, type, parentId } = query;
    const where: any = { deletedAt: null, appId };
    if (keyword) {
      where.OR = [
        { name: { contains: keyword } },
        { path: { contains: keyword } },
        { component: { contains: keyword } },
        { perm: { contains: keyword } },
      ];
    }
    if (status !== undefined) where.status = parseInt(status as string, 10);
    if (type !== undefined) where.type = type;
    if (parentId !== undefined) where.parentId = parentId;
    return await this.prisma.sysAppMenu.count({ where });
  }

  static async getMenuById(appId: number, id: number): Promise<SysAppMenuResp | null> {
    const menu = await this.prisma.sysAppMenu.findFirst({
      where: { id, appId, deletedAt: null },
      include: {
        parent: { select: { name: true } },
        creator: { select: { username: true } },
        updater: { select: { username: true } },
      },
    });
    if (!menu) return null;
    return this.mapToResp(menu);
  }

  static async getMenuByParentAndName(appId: number, parentId: number | null, name: string) {
    return await this.prisma.sysAppMenu.findFirst({
      where: { appId, parentId: parentId ?? null, name, deletedAt: null },
    });
  }

  static async getMenuByPath(appId: number, path?: string) {
    if (!path) return null;
    return await this.prisma.sysAppMenu.findFirst({
      where: { appId, path, deletedAt: null },
    });
  }

  static async createMenu(appId: number, req: SaveAppMenuReq, userId: number): Promise<SysAppMenuResp> {
    const menu = await this.prisma.sysAppMenu.create({
      data: {
        appId,
        name: req.name,
        type: req.type ?? 1,
        parentId: req.parentId ?? null,
        path: req.path,
        icon: req.icon,
        component: req.component,
        status: req.status ? parseInt(req.status, 10) : 1,
        sort_order: req.sort_order ?? 0,
        hideInMenu: req.hideInMenu ?? false,
        isExternalLink: req.isExternalLink ?? false,
        perm: req.perm,
        keepAlive: req.keepAlive ?? false,
        resourceId: req.resourceId ?? null,
        creatorId: userId,
        updaterId: userId,
      },
      include: {
        parent: { select: { name: true } },
        creator: { select: { username: true } },
        updater: { select: { username: true } },
      },
    });
    return this.mapToResp(menu);
  }

  static async updateMenu(appId: number, id: number, req: UpdateAppMenuReq, userId: number): Promise<SysAppMenuResp> {
    const updateData: any = { updaterId: userId };
    if (req.name !== undefined) updateData.name = req.name;
    if (req.type !== undefined) updateData.type = req.type;
    if (req.parentId !== undefined) updateData.parentId = req.parentId ?? null;
    if (req.path !== undefined) updateData.path = req.path;
    if (req.icon !== undefined) updateData.icon = req.icon;
    if (req.component !== undefined) updateData.component = req.component;
    if (req.status !== undefined) updateData.status = parseInt(req.status, 10);
    if (req.sort_order !== undefined) updateData.sort_order = req.sort_order;
    if (req.hideInMenu !== undefined) updateData.hideInMenu = req.hideInMenu;
    if (req.isExternalLink !== undefined) updateData.isExternalLink = req.isExternalLink;
    if (req.perm !== undefined) updateData.perm = req.perm;
    if (req.keepAlive !== undefined) updateData.keepAlive = req.keepAlive;
    if (req.resourceId !== undefined) updateData.resourceId = req.resourceId ?? null;
    const menu = await this.prisma.sysAppMenu.update({
      where: { id, appId, deletedAt: null },
      data: updateData,
      include: {
        parent: { select: { name: true } },
        creator: { select: { username: true } },
        updater: { select: { username: true } },
      },
    });
    return this.mapToResp(menu);
  }

  static async deleteMenu(appId: number, id: number, userId: number): Promise<{ id: number } | null> {
    const existing = await this.prisma.sysAppMenu.findFirst({ where: { id, appId, deletedAt: null } });
    if (!existing) return null;
    await this.prisma.sysAppMenu.update({
      where: { id },
      data: { deletedAt: new Date(), status: 0, updaterId: userId },
    });
    return { id };
  }

  static async getMenuTree(appId: number, rootId?: number | null): Promise<AppMenuTreeNode[]> {
    const menus = await this.prisma.sysAppMenu.findMany({
      where: { deletedAt: null, appId },
      orderBy: { sort_order: "asc" },
      include: {
        parent: { select: { name: true } },
        creator: { select: { username: true } },
        updater: { select: { username: true } },
      },
    });

    const nodeMap = new Map<number, AppMenuTreeNode>();
    const roots: AppMenuTreeNode[] = [];

    for (const m of menus) {
      const node: AppMenuTreeNode = { ...this.mapToResp(m), children: null } as any;
      nodeMap.set(m.id, node);
    }

    for (const m of menus) {
      const node = nodeMap.get(m.id)!;
      const pid = m.parentId ?? null;
      const isRootMatch = rootId === undefined ? pid === null : pid === (rootId ?? null);
      if (isRootMatch) {
        roots.push(node);
      } else if (pid !== null) {
        const parentNode = nodeMap.get(pid);
        if (parentNode) {
          if (!parentNode.children) parentNode.children = [];
          (parentNode.children as AppMenuTreeNode[]).push(node);
        }
      }
    }

    return roots;
  }
}
