import { prismaManager } from '@/utils/prisma.js'
import type { Prisma } from '@generated/prisma/client.js'
import { PostListQuery, SavePostReq, SysPostResp, UpdatePostReq } from '../schemas/post.js'
import { dateUtils } from '../utils/date.js'

type PostWithRelations = Prisma.SysPostGetPayload<{
  include: {
    creator: { select: { username: true } }
    updater: { select: { username: true } }
  }
}> & { creatorName?: string, updaterName?: string }

export class SysPostModel {
  private static prisma = prismaManager.getClient()

  private static mapToResp (post: PostWithRelations): SysPostResp {
    return {
      id: post.id,
      name: post.name,
      status: post.status.toString(),
      sort_order: post.sort_order ?? 0,
      description: post.description ?? undefined,
      creatorId: post.creatorId ?? undefined,
      creatorName: post.creator?.username ?? post.creatorName,
      createdAt: dateUtils.formatISO(post.createdAt)!,
      updaterId: post.updaterId ?? undefined,
      updaterName: post.updater?.username ?? post.updaterName,
      updatedAt: dateUtils.formatISO(post.updatedAt)!
    }
  }

  static async getPostList (query: PostListQuery): Promise<SysPostResp[]> {
    const { page = 1, pageSize = 10, keyword, status, sortBy = 'sort_order', sortOrder = 'asc' } = query
    const where: any = { deletedAt: null }
    if (keyword) where.OR = [{ name: { contains: keyword } }, { description: { contains: keyword } }]
    if (status !== undefined) where.status = parseInt(status as string, 10)
    const orderBy: any = {}
    orderBy[sortBy] = sortOrder
    const posts = await this.prisma.sysPost.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        creator: { select: { username: true } },
        updater: { select: { username: true } }
      }
    })
    return posts.map((p) => this.mapToResp(p))
  }

  static async getPostTotal (query: PostListQuery): Promise<number> {
    const { keyword, status } = query
    const where: any = { deletedAt: null }
    if (keyword) where.OR = [{ name: { contains: keyword } }, { description: { contains: keyword } }]
    if (status !== undefined) where.status = parseInt(status as string, 10)
    return await this.prisma.sysPost.count({ where })
  }

  static async getPostById (id: number): Promise<SysPostResp | null> {
    const post = await this.prisma.sysPost.findFirst({
      where: { id, deletedAt: null },
      include: {
        creator: { select: { username: true } },
        updater: { select: { username: true } }
      }
    })
    if (!post) return null
    return this.mapToResp(post)
  }

  static async getPostByName (name: string) {
    return await this.prisma.sysPost.findFirst({ where: { name, deletedAt: null } })
  }

  static async createPost (req: SavePostReq): Promise<SysPostResp> {
    const post = await this.prisma.sysPost.create({
      data: {
        name: req.name,
        status: req.status ? parseInt(req.status, 10) : 1,
        sort_order: req.sort_order ?? 0,
        description: req.description,
        creatorId: 1,
        updaterId: 1
      },
      include: {
        creator: { select: { username: true } },
        updater: { select: { username: true } }
      }
    })
    return this.mapToResp(post)
  }

  static async updatePost (id: number, req: UpdatePostReq): Promise<SysPostResp> {
    const updateData: any = {}
    if (req.name !== undefined) updateData.name = req.name
    if (req.status !== undefined) updateData.status = parseInt(req.status, 10)
    if (req.sort_order !== undefined) updateData.sort_order = req.sort_order
    if (req.description !== undefined) updateData.description = req.description
    const post = await this.prisma.sysPost.update({
      where: { id, deletedAt: null },
      data: updateData,
      include: {
        creator: { select: { username: true } },
        updater: { select: { username: true } }
      }
    })
    return this.mapToResp(post)
  }

  static async deletePost (id: number): Promise<{ id: number } | null> {
    const existing = await this.prisma.sysPost.findFirst({ where: { id, deletedAt: null } })
    if (!existing) return null
    await this.prisma.sysPost.update({ where: { id }, data: { deletedAt: new Date(), status: 0 } })
    return { id }
  }
}
