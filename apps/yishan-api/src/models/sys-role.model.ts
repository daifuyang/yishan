/**
 * 角色数据访问模型
 */

import { prismaManager } from "../utils/prisma.js";
import type { Prisma } from "../generated/prisma/client.js";
import { RoleListQuery, SaveRoleReq, SysRoleResp, UpdateRoleReq } from "../schemas/role.js";
import { dateUtils } from "../utils/date.js";

// Prisma 生成类型，包含 creator/updater 的必要选择集
type RoleWithRelations = Prisma.SysRoleGetPayload<{
  include: {
    creator: { select: { username: true } };
    updater: { select: { username: true } };
  };
}> & {
  creatorName?: string;
  updaterName?: string;
  roleMenus?: { menuId: number }[];
};

export class SysRoleModel {
  private static prisma = prismaManager.getClient();

  private static mapToResp(role: RoleWithRelations): SysRoleResp {
    return {
      id: role.id,
      name: role.name,
      description: role.description ?? undefined,
      status: role.status,
      isSystemDefault: role.isSystemDefault ?? false,
      creatorId: role.creatorId ?? undefined,
      creatorName: role.creator?.username ?? role.creatorName,
      createdAt: dateUtils.formatISO(role.createdAt)!,
      updaterId: role.updaterId ?? undefined,
      updaterName: role.updater?.username ?? role.updaterName,
      updatedAt: dateUtils.formatISO(role.updatedAt)!,
      menuIds: role.roleMenus ? role.roleMenus.map((rm) => rm.menuId) : undefined,
    };
  }

  /**
   * 获取角色列表
   */
  static async getRoleList(query: RoleListQuery): Promise<SysRoleResp[]> {
    const {
      page = 1,
      pageSize = 10,
      keyword,
      status,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = query;

    const where: any = { deletedAt: null };

    if (keyword) {
      where.OR = [
        { name: { contains: keyword } },
        { description: { contains: keyword } },
      ];
    }

    if (status !== undefined) {
      where.status = status;
    }

    const orderBy: any = {};
    orderBy[sortBy] = sortOrder;

    const roles = await this.prisma.sysRole.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        creator: { select: { username: true } },
        updater: { select: { username: true } },
      },
    });

    return roles.map((r) => this.mapToResp(r));
  }

  /**
   * 获取角色总数
   */
  static async getRoleTotal(query: RoleListQuery): Promise<number> {
    const { keyword, status } = query;

    const where: any = { deletedAt: null };

    if (keyword) {
      where.OR = [
        { name: { contains: keyword } },
        { description: { contains: keyword } },
      ];
    }

    if (status !== undefined) {
      where.status = status;
    }

    return await this.prisma.sysRole.count({ where });
  }

  /**
   * 根据ID获取角色信息
   */
  static async getRoleById(id: number): Promise<SysRoleResp | null> {
    const role = await this.prisma.sysRole.findFirst({
      where: { id, deletedAt: null },
      include: {
        creator: { select: { username: true } },
        updater: { select: { username: true } },
        roleMenus: { select: { menuId: true } },
      },
    });
    if (!role) return null;
    return this.mapToResp(role);
  }

  /**
   * 根据名称获取角色
   */
  static async getRoleByName(name: string) {
    return await this.prisma.sysRole.findFirst({
      where: { name, deletedAt: null },
    });
  }

  /**
   * 创建角色
   */
  static async createRole(req: SaveRoleReq): Promise<SysRoleResp> {
    const result = await this.prisma.$transaction(async (prisma) => {
      const role = await prisma.sysRole.create({
        data: {
          name: req.name,
          description: req.description,
          status: req.status ?? 1,
          isSystemDefault: false,
          creatorId: 1,
          updaterId: 1,
        },
      });

      if (req.menuIds && req.menuIds.length > 0) {
        await prisma.sysRoleMenu.createMany({
          data: req.menuIds.map((menuId) => ({ roleId: role.id, menuId })),
        });
      }

      return role;
    });

    const finalRole = await this.prisma.sysRole.findUniqueOrThrow({
      where: { id: result.id },
      include: {
        creator: { select: { username: true } },
        updater: { select: { username: true } },
        roleMenus: { select: { menuId: true } },
      },
    });
    return this.mapToResp(finalRole as RoleWithRelations);
  }

  /**
   * 更新角色
   */
  static async updateRole(id: number, req: UpdateRoleReq): Promise<SysRoleResp> {
    const result = await this.prisma.$transaction(async (prisma) => {
      const updateData: any = {};
      if (req.name !== undefined) updateData.name = req.name;
      if (req.description !== undefined) updateData.description = req.description;
      if (req.status !== undefined) updateData.status = req.status;

      const role = await prisma.sysRole.update({
        where: { id, deletedAt: null },
        data: updateData,
      });

      if (req.menuIds !== undefined) {
        const existingLinks = await prisma.sysRoleMenu.findMany({
          where: { roleId: id },
          select: { menuId: true },
        });
        const existingMenuIds = existingLinks.map((l) => l.menuId);
        const targetMenuIds = req.menuIds ?? [];

        const toCreate = targetMenuIds.filter((mId) => !existingMenuIds.includes(mId));
        const toDelete = existingMenuIds.filter((mId) => !targetMenuIds.includes(mId));

        if (toCreate.length > 0) {
          await prisma.sysRoleMenu.createMany({
            data: toCreate.map((menuId) => ({ roleId: id, menuId })),
          });
        }
        if (toDelete.length > 0) {
          await prisma.sysRoleMenu.deleteMany({
            where: { roleId: id, menuId: { in: toDelete } },
          });
        }
      }

      return role;
    });

    const finalRole = await this.prisma.sysRole.findUniqueOrThrow({
      where: { id: result.id },
      include: {
        creator: { select: { username: true } },
        updater: { select: { username: true } },
        roleMenus: { select: { menuId: true } },
      },
    });
    return this.mapToResp(finalRole as RoleWithRelations);
  }

  /**
   * 软删除角色
   */
  static async deleteRole(id: number): Promise<{ id: number } | null> {
    const existing = await this.prisma.sysRole.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) return null;

    await this.prisma.sysRole.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: 0,
      },
    });

    return { id };
  }
}