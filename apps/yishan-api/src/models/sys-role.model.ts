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
    const role = await this.prisma.sysRole.create({
      data: {
        name: req.name,
        description: req.description,
        status: req.status ?? 1,
        isSystemDefault: false,
        creatorId: 1, // TODO: 从当前登录用户上下文获取
        updaterId: 1, // TODO: 从当前登录用户上下文获取
      },
      include: {
        creator: { select: { username: true } },
        updater: { select: { username: true } },
      },
    });
    return this.mapToResp(role);
  }

  /**
   * 更新角色
   */
  static async updateRole(id: number, req: UpdateRoleReq): Promise<SysRoleResp> {
    const updateData: any = {};
    if (req.name !== undefined) updateData.name = req.name;
    if (req.description !== undefined) updateData.description = req.description;
    if (req.status !== undefined) updateData.status = req.status;

    const role = await this.prisma.sysRole.update({
      where: { id, deletedAt: null },
      data: updateData,
      include: {
        creator: { select: { username: true } },
        updater: { select: { username: true } },
      },
    });
    return this.mapToResp(role);
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