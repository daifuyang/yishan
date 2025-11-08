/**
 * 部门数据访问模型
 */

import { prismaManager } from "../utils/prisma.js";
import type { Prisma } from "../generated/prisma/client.js";
import { DeptListQuery, SaveDeptReq, SysDeptResp, UpdateDeptReq } from "../schemas/department.js";
import { dateUtils } from "../utils/date.js";

// Prisma 生成类型，包含 parent/leader/creator/updater 的必要选择集
type DeptWithRelations = Prisma.SysDeptGetPayload<{
  include: {
    parent: { select: { name: true } };
    leader: { select: { username: true } };
    creator: { select: { username: true } };
    updater: { select: { username: true } };
  };
}> & {
  parentName?: string;
  leaderName?: string;
  creatorName?: string;
  updaterName?: string;
};

export class SysDeptModel {
  private static prisma = prismaManager.getClient();

  private static mapToResp(dept: DeptWithRelations): SysDeptResp {
    return {
      id: dept.id,
      name: dept.name,
      code: dept.code ?? undefined,
      parentId: dept.parentId ?? undefined,
      parentName: dept.parent?.name ?? dept.parentName,
      status: dept.status,
      sort_order: dept.sort_order ?? 0,
      description: dept.description ?? undefined,
      leaderId: dept.leaderId ?? undefined,
      leaderName: dept.leader?.username ?? dept.leaderName,
      creatorId: dept.creatorId ?? undefined,
      creatorName: dept.creator?.username ?? dept.creatorName,
      createdAt: dateUtils.formatISO(dept.createdAt)!,
      updaterId: dept.updaterId ?? undefined,
      updaterName: dept.updater?.username ?? dept.updaterName,
      updatedAt: dateUtils.formatISO(dept.updatedAt)!,
    };
  }

  /** 获取部门列表 */
  static async getDeptList(query: DeptListQuery): Promise<SysDeptResp[]> {
    const {
      page = 1,
      pageSize = 10,
      keyword,
      status,
      parentId,
      sortBy = "sort_order",
      sortOrder = "asc",
    } = query;

    const where: any = { deletedAt: null };

    if (keyword) {
      where.OR = [
        { name: { contains: keyword } },
        { code: { contains: keyword } },
        { description: { contains: keyword } },
      ];
    }

    if (status !== undefined) {
      where.status = status;
    }

    if (parentId !== undefined) {
      where.parentId = parentId;
    }

    const orderBy: any = {};
    orderBy[sortBy] = sortOrder;

    const depts = await this.prisma.sysDept.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        parent: { select: { name: true } },
        leader: { select: { username: true } },
        creator: { select: { username: true } },
        updater: { select: { username: true } },
      },
    });

    return depts.map((d) => this.mapToResp(d));
  }

  /** 获取部门总数 */
  static async getDeptTotal(query: DeptListQuery): Promise<number> {
    const { keyword, status, parentId } = query;

    const where: any = { deletedAt: null };
    if (keyword) {
      where.OR = [
        { name: { contains: keyword } },
        { code: { contains: keyword } },
        { description: { contains: keyword } },
      ];
    }
    if (status !== undefined) where.status = status;
    if (parentId !== undefined) where.parentId = parentId;
    return await this.prisma.sysDept.count({ where });
  }

  /** 根据ID获取部门 */
  static async getDeptById(id: number): Promise<SysDeptResp | null> {
    const dept = await this.prisma.sysDept.findFirst({
      where: { id, deletedAt: null },
      include: {
        parent: { select: { name: true } },
        leader: { select: { username: true } },
        creator: { select: { username: true } },
        updater: { select: { username: true } },
      },
    });
    if (!dept) return null;
    return this.mapToResp(dept);
  }

  /** 根据名称或编码获取部门 */
  static async getDeptByNameOrCode(name?: string, code?: string) {
    return await this.prisma.sysDept.findFirst({
      where: {
        AND: [
          { deletedAt: null },
          {
            OR: [
              ...(name ? [{ name }] : []),
              ...(code ? [{ code }] : []),
            ],
          },
        ],
      },
    });
  }

  /** 创建部门 */
  static async createDept(req: SaveDeptReq): Promise<SysDeptResp> {
    const dept = await this.prisma.sysDept.create({
      data: {
        name: req.name,
        code: req.code,
        parentId: req.parentId ?? null,
        status: req.status ?? 1,
        sort_order: req.sort_order ?? 0,
        description: req.description,
        leaderId: req.leaderId ?? null,
        creatorId: 1, // TODO: 从当前登录用户上下文获取
        updaterId: 1, // TODO: 从当前登录用户上下文获取
      },
      include: {
        parent: { select: { name: true } },
        leader: { select: { username: true } },
        creator: { select: { username: true } },
        updater: { select: { username: true } },
      },
    });
    return this.mapToResp(dept);
  }

  /** 更新部门 */
  static async updateDept(id: number, req: UpdateDeptReq): Promise<SysDeptResp> {
    const updateData: any = {};
    if (req.name !== undefined) updateData.name = req.name;
    if (req.code !== undefined) updateData.code = req.code;
    if (req.parentId !== undefined) updateData.parentId = req.parentId;
    if (req.status !== undefined) updateData.status = req.status;
    if (req.sort_order !== undefined) updateData.sort_order = req.sort_order;
    if (req.description !== undefined) updateData.description = req.description;
    if (req.leaderId !== undefined) updateData.leaderId = req.leaderId;

    const dept = await this.prisma.sysDept.update({
      where: { id, deletedAt: null },
      data: updateData,
      include: {
        parent: { select: { name: true } },
        leader: { select: { username: true } },
        creator: { select: { username: true } },
        updater: { select: { username: true } },
      },
    });
    return this.mapToResp(dept);
  }

  /** 软删除部门 */
  static async deleteDept(id: number): Promise<{ id: number } | null> {
    const existing = await this.prisma.sysDept.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return null;

    await this.prisma.sysDept.update({
      where: { id },
      data: { deletedAt: new Date(), status: 0 },
    });

    return { id };
  }
}