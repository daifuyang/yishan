/**
 * 用户业务逻辑服务
 */

import { prismaManager } from '../utils/prisma.js'
import { dateUtils } from '../utils/date.js'
import type { Prisma } from '../generated/prisma/client.js'
import type { UserListQuery, UserListData, UserBase } from '../schemas/user.js'

export class UserService {
  private static prisma = prismaManager.getClient()

  /**
   * 获取用户列表
   */
  static async getUserList(query: UserListQuery): Promise<UserListData> {
    const { 
      page = 1, 
      pageSize = 10, 
      keyword, 
      status, 
      sortBy = 'createdAt', 
      sortOrder = 'desc' 
    } = query

    // 构建查询条件
    const where: Prisma.SysUserWhereInput = {
      deletedAt: null // 只查询未删除的用户
    }

    // 关键词搜索
    if (keyword) {
      where.OR = [
        { username: { contains: keyword } },
        { email: { contains: keyword } },
        { realName: { contains: keyword } }
      ]
    }

    // 状态筛选
    if (status !== undefined) {
      where.status = status
    }

    // 构建排序条件
    const orderBy: Prisma.SysUserOrderByWithRelationInput = {}
    if (sortBy === 'createdAt') {
      orderBy.createdAt = sortOrder as Prisma.SortOrder
    } else if (sortBy === 'updatedAt') {
      orderBy.updatedAt = sortOrder as Prisma.SortOrder
    } else if (sortBy === 'lastLoginTime') {
      orderBy.lastLoginTime = sortOrder as Prisma.SortOrder
    } else if (sortBy === 'loginCount') {
      orderBy.loginCount = sortOrder as Prisma.SortOrder
    }

    // 计算偏移量
    const skip = (page - 1) * pageSize

    // 并行执行查询和计数
    const [users, total] = await Promise.all([
      UserService.prisma.sysUser.findMany({
        where,
        select: {
          id: true,
          username: true,
          email: true,
          phone: true,
          realName: true,
          avatar: true,
          gender: true,
          birthDate: true,
          status: true,
          lastLoginTime: true,
          lastLoginIp: true,
          loginCount: true,
          createdAt: true,
          updatedAt: true
        },
        orderBy,
        skip,
        take: pageSize
      }),
      UserService.prisma.sysUser.count({ where })
    ])

    // 格式化用户数据
    const formattedUsers: UserBase[] = users.map((user: any) => ({
      ...user,
      id: user.id.toString(),
      phone: user.phone ?? undefined,
      avatar: user.avatar ?? undefined,
      lastLoginIp: user.lastLoginIp ?? undefined,
      birthDate: dateUtils.formatDate(user.birthDate),
      lastLoginTime: dateUtils.formatISO(user.lastLoginTime),
      createdAt: dateUtils.formatISO(user.createdAt)!,
      updatedAt: dateUtils.formatISO(user.updatedAt)!
    }))

    // 计算总页数
    const totalPages = Math.ceil(total / pageSize)

    return {
      list: formattedUsers,
      pagination: {
        total,
        page,
        pageSize,
        totalPages
      }
    }
  }

  /**
   * 根据ID获取用户详情
   */
  static async getUserById(id: string): Promise<UserBase | null> {
    const user = await UserService.prisma.sysUser.findFirst({
      where: {
        id: BigInt(id),
        deletedAt: null
      },
      select: {
        id: true,
        username: true,
        email: true,
        phone: true,
        realName: true,
        avatar: true,
        gender: true,
        birthDate: true,
        status: true,
        lastLoginTime: true,
        lastLoginIp: true,
        loginCount: true,
        createdAt: true,
        updatedAt: true
      }
    })

    if (!user) {
      return null
    }

    return {
      ...user,
      id: user.id.toString(),
      phone: user.phone ?? undefined,
      avatar: user.avatar ?? undefined,
      lastLoginIp: user.lastLoginIp ?? undefined,
      birthDate: dateUtils.formatDate(user.birthDate) ?? undefined,
      lastLoginTime: dateUtils.formatISO(user.lastLoginTime) ?? undefined,
      createdAt: dateUtils.formatISO(user.createdAt)!,
      updatedAt: dateUtils.formatISO(user.updatedAt)!
    }
  }

  /**
   * 创建用户
   */
  static async createUser(data: Prisma.SysUserCreateInput, creatorId?: string): Promise<UserBase> {
    // 检查用户名是否已存在
    const existingUser = await UserService.prisma.sysUser.findFirst({
      where: {
        OR: [
          { username: data.username },
          { email: data.email }
        ],
        deletedAt: null
      }
    })

    if (existingUser) {
      throw new Error('用户名或邮箱已存在')
    }

    // 这里应该对密码进行加密处理
    // 暂时使用简单的处理方式，实际项目中应该使用 bcrypt 等库
    const salt = Math.random().toString(36).substring(2, 15)
    const passwordHash = data.passwordHash || 'default_password' // 使用传入的 passwordHash

    const user = await UserService.prisma.sysUser.create({
      data: {
        username: data.username,
        email: data.email,
        phone: data.phone,
        passwordHash,
        salt,
        realName: data.realName,
        avatar: data.avatar,
        gender: data.gender || 0,
        birthDate: data.birthDate,
        status: data.status || 1,
        creatorId: creatorId ? BigInt(creatorId) : null
      },
      select: {
        id: true,
        username: true,
        email: true,
        phone: true,
        realName: true,
        avatar: true,
        gender: true,
        birthDate: true,
        status: true,
        lastLoginTime: true,
        lastLoginIp: true,
        loginCount: true,
        createdAt: true,
        updatedAt: true
      }
    })

    return {
      ...user,
      id: user.id.toString(),
      phone: user.phone ?? undefined,
      avatar: user.avatar ?? undefined,
      lastLoginIp: user.lastLoginIp ?? undefined,
      birthDate: dateUtils.formatDate(user.birthDate) ?? undefined,
      lastLoginTime: dateUtils.formatISO(user.lastLoginTime) ?? undefined,
      createdAt: dateUtils.formatISO(user.createdAt)!,
      updatedAt: dateUtils.formatISO(user.updatedAt)!
    }
  }

  /**
   * 更新用户
   */
  static async updateUser(id: string, data: Prisma.SysUserUpdateInput, updaterId?: string): Promise<UserBase | null> {
    // 检查用户是否存在
    const existingUser = await UserService.prisma.sysUser.findFirst({
      where: {
        id: BigInt(id),
        deletedAt: null
      }
    })

    if (!existingUser) {
      return null
    }

    // 如果更新邮箱，检查是否与其他用户冲突
    if (data.email && typeof data.email === 'string') {
      const emailConflict = await UserService.prisma.sysUser.findFirst({
        where: {
          email: data.email,
          id: { not: BigInt(id) },
          deletedAt: null
        }
      })

      if (emailConflict) {
        throw new Error('邮箱已被其他用户使用')
      }
    }

    const updateData: Prisma.SysUserUpdateInput = {
      ...data,
      updater: updaterId ? {
        connect: { id: BigInt(updaterId) }
      } : undefined
    }

    const user = await UserService.prisma.sysUser.update({
      where: { id: BigInt(id) },
      data: updateData,
      select: {
        id: true,
        username: true,
        email: true,
        phone: true,
        realName: true,
        avatar: true,
        gender: true,
        birthDate: true,
        status: true,
        lastLoginTime: true,
        lastLoginIp: true,
        loginCount: true,
        createdAt: true,
        updatedAt: true
      }
    })

    return {
      ...user,
      id: user.id.toString(),
      phone: user.phone ?? undefined,
      avatar: user.avatar ?? undefined,
      lastLoginIp: user.lastLoginIp ?? undefined,
      birthDate: dateUtils.formatDate(user.birthDate) ?? undefined,
      lastLoginTime: dateUtils.formatISO(user.lastLoginTime) ?? undefined,
      createdAt: dateUtils.formatISO(user.createdAt)!,
      updatedAt: dateUtils.formatISO(user.updatedAt)!
    }
  }

  /**
   * 软删除用户
   */
  static async deleteUser(id: string, deleterId?: string): Promise<boolean> {
    try {
      await UserService.prisma.sysUser.update({
        where: { id: BigInt(id) },
        data: {
          deletedAt: dateUtils.now(),
          updaterId: deleterId ? BigInt(deleterId) : undefined
        }
      })
      return true
    } catch (error) {
      return false
    }
  }

  /**
   * 批量更新用户状态
   */
  static async batchUpdateStatus(ids: string[], status: number, updaterId?: string): Promise<number> {
    const result = await UserService.prisma.sysUser.updateMany({
      where: {
        id: { in: ids.map(id => BigInt(id)) },
        deletedAt: null
      },
      data: {
        status,
        updaterId: updaterId ? BigInt(updaterId) : undefined
      }
    })

    return result.count
  }
}

// 由于所有方法都是静态的，不再需要导出实例
// export const userService = new UserService()