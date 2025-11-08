/**
 * 菜单数据访问模型
 */

import { prismaManager } from "../utils/prisma.js";
import { dateUtils } from "../utils/date.js";
import type { Prisma } from "../generated/prisma/client.js";
import { MenuListQuery, SaveMenuReq, SysMenuResp, UpdateMenuReq } from "../schemas/menu.js";

// 使用 Prisma 生成的类型（包含 parent/creator/updater 的最小选择集）
type MenuWithRelations = Prisma.SysMenuGetPayload<{
  include: {
    parent: { select: { name: true } };
    creator: { select: { username: true } };
    updater: { select: { username: true } };
  };
}> & {
  // 兼容某些查询场景下的别名字段（不一定存在）
  parentName?: string;
  creatorName?: string;
  updaterName?: string;
};

export class SysMenuModel {
  private static prisma = prismaManager.getClient();

  private static mapToResp(menu: MenuWithRelations): SysMenuResp {
    return {
      id: menu.id,
      name: menu.name,
      type: menu.type,
      path: menu.path ?? undefined,
      icon: menu.icon ?? undefined,
      component: menu.component ?? undefined,
      parentId: menu.parentId ?? undefined,
      parentName: menu.parent?.name ?? menu.parentName,
      status: menu.status,
      sort_order: menu.sort_order ?? 0,
      hideInMenu: !!menu.hideInMenu,
      isExternalLink: !!menu.isExternalLink,
      perm: menu.perm ?? undefined,
      keepAlive: !!menu.keepAlive,
      creatorId: menu.creatorId ?? undefined,
      creatorName: menu.creator?.username ?? menu.creatorName,
      createdAt: dateUtils.formatISO(menu.createdAt)!,
      updaterId: menu.updaterId ?? undefined,
      updaterName: menu.updater?.username ?? menu.updaterName,
      updatedAt: dateUtils.formatISO(menu.updatedAt)!,
    };
  }

  /** 获取菜单列表 */
  static async getMenuList(query: MenuListQuery): Promise<SysMenuResp[]> {
    const {
      page = 1,
      pageSize = 10,
      keyword,
      status,
      type,
      parentId,
      sortBy = "sort_order",
      sortOrder = "asc",
    } = query;

    const where: any = { deletedAt: null };

    if (keyword) {
      where.OR = [
        { name: { contains: keyword } },
        { path: { contains: keyword } },
        { component: { contains: keyword } },
        { perm: { contains: keyword } },
      ];
    }

    if (status !== undefined) where.status = status;
    if (type !== undefined) where.type = type;
    if (parentId !== undefined) where.parentId = parentId;

    const orderBy: any = {};
    orderBy[sortBy] = sortOrder;

    const menus = await this.prisma.sysMenu.findMany({
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

  /** 获取菜单总数 */
  static async getMenuTotal(query: MenuListQuery): Promise<number> {
    const { keyword, status, type, parentId } = query;
    const where: any = { deletedAt: null };
    if (keyword) {
      where.OR = [
        { name: { contains: keyword } },
        { path: { contains: keyword } },
        { component: { contains: keyword } },
        { perm: { contains: keyword } },
      ];
    }
    if (status !== undefined) where.status = status;
    if (type !== undefined) where.type = type;
    if (parentId !== undefined) where.parentId = parentId;
    return await this.prisma.sysMenu.count({ where });
  }

  /** 根据ID获取菜单 */
  static async getMenuById(id: number): Promise<SysMenuResp | null> {
    const menu = await this.prisma.sysMenu.findFirst({
      where: { id, deletedAt: null },
      include: {
        parent: { select: { name: true } },
        creator: { select: { username: true } },
        updater: { select: { username: true } },
      },
    });
    if (!menu) return null;
    return this.mapToResp(menu);
  }

  /** 根据父级与名称查询（用于唯一性校验） */
  static async getMenuByParentAndName(parentId: number | undefined | null, name: string) {
    return await this.prisma.sysMenu.findFirst({
      where: {
        AND: [
          { deletedAt: null },
          { name },
          { parentId: parentId ?? null },
        ],
      },
    });
  }

  /** 根据路径查询（用于唯一性校验） */
  static async getMenuByPath(path?: string) {
    if (!path) return null;
    return await this.prisma.sysMenu.findFirst({
      where: { path, deletedAt: null },
    });
  }

  /** 创建菜单 */
  static async createMenu(req: SaveMenuReq): Promise<SysMenuResp> {
    const menu = await this.prisma.sysMenu.create({
      data: {
        name: req.name,
        type: req.type ?? 1,
        parentId: req.parentId ?? null,
        path: req.path,
        icon: req.icon,
        component: req.component,
        status: req.status ?? 1,
        sort_order: req.sort_order ?? 0,
        hideInMenu: req.hideInMenu ?? false,
        isExternalLink: req.isExternalLink ?? false,
        perm: req.perm,
        keepAlive: req.keepAlive ?? false,
        creatorId: 1, // TODO: 从当前登录用户上下文获取
        updaterId: 1, // TODO: 从当前登录用户上下文获取
      },
      include: {
        parent: { select: { name: true } },
        creator: { select: { username: true } },
        updater: { select: { username: true } },
      },
    });
    return this.mapToResp(menu);
  }

  /** 更新菜单 */
  static async updateMenu(id: number, req: UpdateMenuReq): Promise<SysMenuResp> {
    const updateData: any = {};
    if (req.name !== undefined) updateData.name = req.name;
    if (req.type !== undefined) updateData.type = req.type;
    if (req.parentId !== undefined) updateData.parentId = req.parentId ?? null;
    if (req.path !== undefined) updateData.path = req.path;
    if (req.icon !== undefined) updateData.icon = req.icon;
    if (req.component !== undefined) updateData.component = req.component;
    if (req.status !== undefined) updateData.status = req.status;
    if (req.sort_order !== undefined) updateData.sort_order = req.sort_order;
    if (req.hideInMenu !== undefined) updateData.hideInMenu = req.hideInMenu;
    if (req.isExternalLink !== undefined) updateData.isExternalLink = req.isExternalLink;
    if (req.perm !== undefined) updateData.perm = req.perm;
    if (req.keepAlive !== undefined) updateData.keepAlive = req.keepAlive;

    const menu = await this.prisma.sysMenu.update({
      where: { id, deletedAt: null },
      data: updateData,
      include: {
        parent: { select: { name: true } },
        creator: { select: { username: true } },
        updater: { select: { username: true } },
      },
    });
    return this.mapToResp(menu);
  }

  /** 软删除菜单 */
  static async deleteMenu(id: number): Promise<{ id: number } | null> {
    const existing = await this.prisma.sysMenu.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return null;

    await this.prisma.sysMenu.update({
      where: { id },
      data: { deletedAt: new Date(), status: 0 },
    });

    return { id };
  }

  /** 统计角色绑定数量 */
  static async getRoleBindCount(menuId: number): Promise<number> {
    return await this.prisma.sysRoleMenu.count({
      where: { menuId, deletedAt: null },
    });
  }
}