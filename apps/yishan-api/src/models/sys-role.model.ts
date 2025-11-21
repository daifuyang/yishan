/**
 * 角色数据访问模型
 */

import { prismaManager } from "../utils/prisma.js";
import type { Prisma, SysRole } from "../generated/prisma/client.js";
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
      status: role.status.toString(),
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
   * 获取角色列表（返回API响应格式，status为字符串类型）
   * 主要用于API响应，已包含关联数据和格式转换
   * @param query 查询参数
   * @returns 转换后的角色响应对象数组
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
      where.status = parseInt(status as string, 10);
    }

    const orderBy: any = {};
    orderBy[sortBy] = sortOrder;

    // 如果pageSize为0，直接返回全部数据，不应用分页
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
   * 获取角色总数（返回数字类型）
   * 主要用于分页统计，返回符合条件的角色总数
   * @param query 查询参数
   * @returns 角色总数
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
      where.status = parseInt(status as string, 10);
    }

    return await this.prisma.sysRole.count({ where });
  }

  /**
   * 根据角色ID获取角色信息（返回API响应格式，status为字符串类型）
   * 主要用于API响应，已包含关联数据和格式转换
   * @param id 角色ID
   * @returns 转换后的角色响应对象或null
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
   * 根据角色名称获取原始角色信息（返回数据库原始对象，status为数字类型）
   * 主要用于内部业务逻辑，如唯一性检查等
   * @param name 角色名称
   * @returns 原始角色对象或null
   */
  static async getRawRoleByName(name: string): Promise<SysRole | null> {
    return await this.prisma.sysRole.findFirst({
      where: { name, deletedAt: null },
    });
  }

  /**
   * 创建角色（返回API响应格式，status为字符串类型）
   * 主要用于API响应，已包含关联数据和格式转换
   * @param req 角色创建请求数据
   * @returns 转换后的角色响应对象
   */
  static async createRole(req: SaveRoleReq): Promise<SysRoleResp> {
    const result = await this.prisma.$transaction(async (prisma) => {
      // 将字符串类型的status转换为数字类型
      const statusNum = req.status ? parseInt(req.status, 10) : 1;
      
      const role = await prisma.sysRole.create({
        data: {
          name: req.name,
          description: req.description,
          status: statusNum,
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
   * 更新角色（返回API响应格式，status为字符串类型）
   * 主要用于API响应，已包含关联数据和格式转换
   * @param id 角色ID
   * @param req 角色更新请求数据
   * @returns 转换后的角色响应对象
   */
  static async updateRole(id: number, req: UpdateRoleReq): Promise<SysRoleResp> {
    const result = await this.prisma.$transaction(async (prisma) => {
      const updateData: any = {};
      if (req.name !== undefined) updateData.name = req.name;
      if (req.description !== undefined) updateData.description = req.description;
      if (req.status !== undefined) {
        // 将字符串类型的status转换为数字类型
        updateData.status = parseInt(req.status, 10);
      }

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
   * 软删除角色（将状态设置为禁用并标记删除时间）
   * @param id 角色ID
   * @returns 删除结果或null
   */
  static async deleteRole(id: number): Promise<SysRole | null> {
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

    return existing;
  }
}