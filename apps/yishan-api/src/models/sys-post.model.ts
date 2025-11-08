/**
 * 岗位数据访问模型
 */

import { prismaManager } from "../utils/prisma.js";
import type { Prisma } from "../generated/prisma/client.js";
import { PostListQuery, SavePostReq, SysPostResp, UpdatePostReq } from "../schemas/post.js";
import { dateUtils } from "../utils/date.js";

// Prisma 生成类型，包含 creator/updater 的必要选择集
type PostWithRelations = Prisma.SysPostGetPayload<{
  include: {
    creator: { select: { username: true } };
    updater: { select: { username: true } };
  };
}> & {
  creatorName?: string;
  updaterName?: string;
};

export class SysPostModel {
  private static prisma = prismaManager.getClient();

  private static mapToResp(post: PostWithRelations): SysPostResp {
    return {
      id: post.id,
      name: post.name,
      code: post.code ?? undefined,
      status: post.status,
      sort_order: post.sort_order ?? 0,
      description: post.description ?? undefined,
      creatorId: post.creatorId ?? undefined,
      creatorName: post.creator?.username ?? post.creatorName,
      createdAt: dateUtils.formatISO(post.createdAt)!,
      updaterId: post.updaterId ?? undefined,
      updaterName: post.updater?.username ?? post.updaterName,
      updatedAt: dateUtils.formatISO(post.updatedAt)!,
    };
  }

  /** 获取岗位列表 */
  static async getPostList(query: PostListQuery): Promise<SysPostResp[]> {
    const {
      page = 1,
      pageSize = 10,
      keyword,
      status,
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

    const orderBy: any = {};
    orderBy[sortBy] = sortOrder;

    const posts = await this.prisma.sysPost.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        creator: { select: { username: true } },
        updater: { select: { username: true } },
      },
    });

    return posts.map((p) => this.mapToResp(p));
  }

  /** 获取岗位总数 */
  static async getPostTotal(query: PostListQuery): Promise<number> {
    const { keyword, status } = query;

    const where: any = { deletedAt: null };
    if (keyword) {
      where.OR = [
        { name: { contains: keyword } },
        { code: { contains: keyword } },
        { description: { contains: keyword } },
      ];
    }
    if (status !== undefined) where.status = status;
    return await this.prisma.sysPost.count({ where });
  }

  /** 根据ID获取岗位 */
  static async getPostById(id: number): Promise<SysPostResp | null> {
    const post = await this.prisma.sysPost.findFirst({
      where: { id, deletedAt: null },
      include: {
        creator: { select: { username: true } },
        updater: { select: { username: true } },
      },
    });
    if (!post) return null;
    return this.mapToResp(post);
  }

  /** 根据名称或编码获取岗位 */
  static async getPostByNameOrCode(name?: string, code?: string) {
    return await this.prisma.sysPost.findFirst({
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

  /** 创建岗位 */
  static async createPost(req: SavePostReq): Promise<SysPostResp> {
    const post = await this.prisma.sysPost.create({
      data: {
        name: req.name,
        code: req.code,
        status: req.status ?? 1,
        sort_order: req.sort_order ?? 0,
        description: req.description,
        creatorId: 1, // TODO: 从当前登录用户上下文获取
        updaterId: 1, // TODO: 从当前登录用户上下文获取
      },
      include: {
        creator: { select: { username: true } },
        updater: { select: { username: true } },
      },
    });
    return this.mapToResp(post);
  }

  /** 更新岗位 */
  static async updatePost(id: number, req: UpdatePostReq): Promise<SysPostResp> {
    const updateData: any = {};
    if (req.name !== undefined) updateData.name = req.name;
    if (req.code !== undefined) updateData.code = req.code;
    if (req.status !== undefined) updateData.status = req.status;
    if (req.sort_order !== undefined) updateData.sort_order = req.sort_order;
    if (req.description !== undefined) updateData.description = req.description;

    const post = await this.prisma.sysPost.update({
      where: { id, deletedAt: null },
      data: updateData,
      include: {
        creator: { select: { username: true } },
        updater: { select: { username: true } },
      },
    });
    return this.mapToResp(post);
  }

  /** 软删除岗位 */
  static async deletePost(id: number): Promise<{ id: number } | null> {
    const existing = await this.prisma.sysPost.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return null;

    await this.prisma.sysPost.update({
      where: { id },
      data: { deletedAt: new Date(), status: 0 },
    });

    return { id };
  }
}