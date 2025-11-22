/**
 * 菜单数据访问模型
 */

import { prismaManager } from "../utils/prisma.js";
import { dateUtils } from "../utils/date.js";
import type { Prisma } from "../generated/prisma/client.js";
import { MenuListQuery, SaveMenuReq, SysMenuResp, UpdateMenuReq, MenuTreeNode } from "../schemas/menu.js";

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
      status: menu.status.toString(),
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

    if (status !== undefined) where.status = parseInt(status as string, 10);
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
    if (status !== undefined) where.status = parseInt(status as string, 10);
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
        status: req.status ? parseInt(req.status, 10) : 1,
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
    if (req.status !== undefined) updateData.status = parseInt(req.status, 10);
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

  static async getMenuTree(rootId?: number | null): Promise<MenuTreeNode[]> {
    const menus = await this.prisma.sysMenu.findMany({
      where: { deletedAt: null },
      orderBy: { sort_order: "asc" },
      include: {
        parent: { select: { name: true } },
        creator: { select: { username: true } },
        updater: { select: { username: true } },
      },
    });

    const nodeMap = new Map<number, MenuTreeNode>();
    const roots: MenuTreeNode[] = [];

    for (const m of menus) {
      const node: MenuTreeNode = { ...this.mapToResp(m), children: null } as any;
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
          (parentNode.children as MenuTreeNode[]).push(node);
        }
      }
    }

    return roots;
  }

  static async getAuthorizedMenuTreeByRoleIds(roleIds: number[]): Promise<MenuTreeNode[]> {
    if (!roleIds || roleIds.length === 0) return [] as any;
    const links = await this.prisma.sysRoleMenu.findMany({
      where: { roleId: { in: roleIds }, deletedAt: null },
      select: { menuId: true },
    });
    const assignedIds = Array.from(new Set(links.map((l) => l.menuId)));

    const superAdminOnly = roleIds.length === 1 && roleIds[0] === 1;

    const menus = await this.prisma.sysMenu.findMany({
      where: { deletedAt: null },
      orderBy: { sort_order: "asc" },
      include: {
        parent: { select: { name: true } },
        creator: { select: { username: true } },
        updater: { select: { username: true } },
      },
    });

    const byId = new Map<number, typeof menus[number]>();
    for (const m of menus) byId.set(m.id, m);

    const allow = new Set<number>();
    if (assignedIds.length === 0 && superAdminOnly) {
      for (const m of menus) allow.add(m.id);
    } else {
      for (const id of assignedIds) {
        let cur = byId.get(id);
        while (cur) {
          allow.add(cur.id);
          const pid = cur.parentId ?? null;
          if (pid === null) break;
          cur = byId.get(pid!);
        }
      }
    }

    const filtered = menus.filter((m) => allow.has(m.id) && m.status === 1);

    const nodeMap = new Map<number, MenuTreeNode>();
    const roots: MenuTreeNode[] = [];

    for (const m of filtered) {
      const node: MenuTreeNode = { ...this.mapToResp(m), children: null } as any;
      nodeMap.set(m.id, node);
    }

    for (const m of filtered) {
      const node = nodeMap.get(m.id)!;
      const pid = m.parentId ?? null;
      if (pid === null || !nodeMap.has(pid)) {
        roots.push(node);
      } else {
        const parentNode = nodeMap.get(pid)!;
        if (!parentNode.children) parentNode.children = [];
        (parentNode.children as MenuTreeNode[]).push(node);
      }
    }

    return roots;
  }

  static async getAuthorizedMenuPathsByRoleIds(roleIds: number[]): Promise<string[]> {
    if (!roleIds || roleIds.length === 0) return [] as any;
    const links = await this.prisma.sysRoleMenu.findMany({
      where: { roleId: { in: roleIds }, deletedAt: null },
      select: { menuId: true },
    });
    const assignedIds = Array.from(new Set(links.map((l) => l.menuId)));

    const superAdminOnly = roleIds.length === 1 && roleIds[0] === 1;

    const menus = await this.prisma.sysMenu.findMany({
      where: { deletedAt: null, status: 1 },
      orderBy: { sort_order: "asc" },
      select: {
        id: true,
        parentId: true,
        path: true,
        isExternalLink: true,
      },
    });

    const byId = new Map<number, { id: number; parentId: number | null; path: string | null; isExternalLink: boolean | null }>();
    for (const m of menus) byId.set(m.id, { id: m.id, parentId: m.parentId ?? null, path: m.path ?? null, isExternalLink: !!m.isExternalLink });

    const allow = new Set<number>();
    if (assignedIds.length === 0 && superAdminOnly) {
      for (const m of menus) allow.add(m.id);
    } else {
      for (const id of assignedIds) {
        let cur = byId.get(id);
        while (cur) {
          allow.add(cur.id);
          if (cur.parentId === null) break;
          cur = byId.get(cur.parentId);
        }
      }
    }

    const paths = new Set<string>();
    for (const id of allow) {
      const m = byId.get(id);
      if (!m) continue;
      if (m.path && !m.isExternalLink) paths.add(m.path);
    }
    return Array.from(paths);
  }
}