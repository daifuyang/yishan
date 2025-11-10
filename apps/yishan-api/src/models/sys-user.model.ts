/**
 * 用户数据访问模型
 */

import { prismaManager } from "../utils/prisma.js";
import { UserListQuery, CreateUserReq, SysUserResp, UpdateUserReq } from "../schemas/user.js";
import { SysUser } from "../generated/prisma/client.js";
import type { Prisma } from "../generated/prisma/client.js";
import { hashPassword } from "../utils/password.js";
import { dateUtils } from "../utils/date.js";

// Prisma 生成类型，包含 creator/updater 的必要选择集
type UserWithRelations = Prisma.SysUserGetPayload<{
  include: {
    creator: { select: { username: true } };
    updater: { select: { username: true } };
  };
}> & {
  creatorName?: string;
  updaterName?: string;
};

const genderMap = {
  0: "未知",
  1: "男",
  2: "女",
};

// 状态映射
const statusMap = {
  0: "禁用",
  1: "启用",
  2: "锁定",
};

export class SysUserModel {
  private static prisma = prismaManager.getClient();

  private static mapToResp(sysUser: UserWithRelations): SysUserResp {
    return {
      id: sysUser.id,
      username: sysUser.username ?? undefined,
      email: sysUser.email ?? undefined,
      phone: sysUser.phone ?? undefined,
      realName: sysUser.realName ?? undefined,
      nickname: sysUser.nickname ?? undefined,
      avatar: sysUser.avatar ?? undefined,
      gender: sysUser.gender,
      genderName: genderMap[sysUser.gender as keyof typeof genderMap] || "未知",
      birthDate: dateUtils.formatDate(sysUser.birthDate) ?? undefined,
      status: sysUser.status,
      statusName: statusMap[sysUser.status as keyof typeof statusMap] || "未知",
      lastLoginTime: dateUtils.formatISO(sysUser.lastLoginTime) ?? undefined,
      lastLoginIp: sysUser.lastLoginIp ?? undefined,
      loginCount: sysUser.loginCount,
      creatorId: sysUser.creatorId,
      creatorName: sysUser.creator?.username ?? sysUser.creatorName ?? undefined,
      createdAt: dateUtils.formatISO(sysUser.createdAt)!,
      updaterId: sysUser.updaterId,
      updaterName: sysUser.updater?.username ?? sysUser.updaterName ?? undefined,
      updatedAt: dateUtils.formatISO(sysUser.updatedAt)!,
    };
  }

  /**
   * 获取用户列表
   */
  static async getUserList(query: UserListQuery): Promise<SysUserResp[]> {
    const {
      page = 1,
      pageSize = 10,
      keyword,
      status,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = query;

    // 构建查询条件
    const where: any = {
      deletedAt: null, // 只查询未删除的用户
    };

    // 添加关键词搜索条件
    if (keyword) {
      where.OR = [
        { username: { contains: keyword } },
        { email: { contains: keyword } },
        { realName: { contains: keyword } },
        { nickname: { contains: keyword } },
      ];
    }

    // 添加状态筛选条件
    if (status !== undefined) {
      where.status = status;
    }

    // 构建排序条件
    const orderBy: any = {};
    orderBy[sortBy] = sortOrder;

    // 执行查询
    const sysUsers = await this.prisma.sysUser.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        creator: {
          select: { username: true }
        },
        updater: {
          select: { username: true }
        }
      }
    });

    // 转换数据格式以匹配SysUserResp类型
    return sysUsers.map((item) => {
      return {
        ...item,
        username: item.username ?? undefined,
        email: item.email ?? undefined,
        realName: item.realName ?? undefined,
        nickname: item.nickname ?? undefined,
        genderName: genderMap[item.gender as keyof typeof genderMap] || "未知",
        birthDate: dateUtils.formatDate(item.birthDate) ?? undefined,
        statusName: statusMap[item.status as keyof typeof statusMap] || "未知",
        lastLoginTime: dateUtils.formatISO(item.lastLoginTime) ?? undefined,
        creatorName: item.creator?.username ?? undefined,
        createdAt: dateUtils.formatISO(item.createdAt)!,
        updaterName: item.updater?.username ?? undefined,
        updatedAt: dateUtils.formatISO(item.updatedAt)!,
      } as SysUserResp;
    });
  }

  /**
   * 获取用户总数
   */
  static async getUserTotal(query: UserListQuery): Promise<number> {
    const { keyword, status } = query;

    // 构建查询条件
    const where: any = {
      deletedAt: null, // 只查询未删除的用户
    };

    // 添加关键词搜索条件
    if (keyword) {
      where.OR = [
        { username: { contains: keyword } },
        { email: { contains: keyword } },
        { realName: { contains: keyword } },
        { nickname: { contains: keyword } },
      ];
    }

    // 添加状态筛选条件
    if (status !== undefined) {
      where.status = status;
    }

    // 执行计数查询
    const count = await this.prisma.sysUser.count({
      where,
    });

    return count;
  }

  /**
   * 根据ID获取用户信息
   */
  static async getUserById(id: number): Promise<SysUserResp | null> {
    const sysUser = await this.prisma.sysUser.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        creator: { select: { username: true } },
        updater: { select: { username: true } }
      }
    });

    if (!sysUser) return null;

    return {
      id: sysUser.id,
      username: sysUser.username ?? undefined,
      email: sysUser.email ?? undefined,
      phone: sysUser.phone ?? undefined,
      realName: sysUser.realName ?? undefined,
      nickname: sysUser.nickname ?? undefined,
      avatar: sysUser.avatar ?? undefined,
      gender: sysUser.gender,
      genderName: genderMap[sysUser.gender as keyof typeof genderMap] || "未知",
      birthDate: dateUtils.formatDate(sysUser.birthDate) ?? undefined,
      status: sysUser.status,
      statusName: statusMap[sysUser.status as keyof typeof statusMap] || "未知",
      lastLoginTime: dateUtils.formatISO(sysUser.lastLoginTime) ?? undefined,
      lastLoginIp: sysUser.lastLoginIp ?? undefined,
      loginCount: sysUser.loginCount,
      creatorId: sysUser.creatorId,
      creatorName: sysUser.creator?.username ?? undefined,
      createdAt: dateUtils.formatISO(sysUser.createdAt)!,
      updaterId: sysUser.updaterId,
      updaterName: sysUser.updater?.username ?? undefined,
      updatedAt: dateUtils.formatISO(sysUser.updatedAt)!,
    };
  }

  /**
   * 软删除用户
   */
  static async deleteUser(id: number): Promise<SysUser | null> {
    const existing = await this.prisma.sysUser.findFirst({
      where: { id, deletedAt: null }
    });
    if (!existing) return null;

    const deleted = await this.prisma.sysUser.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: 0,
      }
    });
    return deleted;
  }

  /**
   * 根据用户名获取用户信息
   */
  static async getUserByUsername(username: string): Promise<SysUser | null> {
    const sysUser = await this.prisma.sysUser.findFirst({
      where: {
        username,
        deletedAt: null,
      },
    });
    return sysUser;
  }

  /**
   * 根据邮箱获取用户信息
   */
  static async getUserByEmail(email: string): Promise<SysUser | null> {
    const sysUser = await this.prisma.sysUser.findFirst({
      where: {
        email,
        deletedAt: null,
      },
    });

    return sysUser;
  }

  /**
   * 根据用户名或邮箱获取用户信息（用于登录）
   */
  static async getUserByUsernameOrEmail(usernameOrEmail: string): Promise<SysUser | null> {
    const sysUser = await this.prisma.sysUser.findFirst({
      where: {
        OR: [
          { username: usernameOrEmail },
          { email: usernameOrEmail }
        ],
        deletedAt: null,
      },
    });

    return sysUser;
  }

  /**
   * 创建用户
   */
  static async createUser(userReq: CreateUserReq): Promise<SysUserResp> {
    // 使用统一的密码加密工具
    const passwordHash = await hashPassword(userReq.password);

    // 构建用户数据，只包含提供的字段
    const userData: any = {
      passwordHash,
      phone: userReq.phone,
      loginCount: 0,
      gender: userReq.gender ?? 0,
      status: userReq.status ?? 1,
      creatorId: 1, // TODO: 从当前登录用户上下文获取
      updaterId: 1  // TODO: 从当前登录用户上下文获取
    };

    // 添加可选字段（如果提供）
    if (userReq.username !== undefined) userData.username = userReq.username;
    if (userReq.email !== undefined) userData.email = userReq.email;
    if (userReq.realName !== undefined) userData.realName = userReq.realName;
    if (userReq.nickname !== undefined) userData.nickname = userReq.nickname;
    if (userReq.avatar !== undefined) userData.avatar = userReq.avatar;
    if (userReq.birthDate !== undefined) {
      userData.birthDate = userReq.birthDate ? new Date(userReq.birthDate) : undefined;
    }

    // 创建用户
    const sysUser = await this.prisma.sysUser.create({
      data: userData,
      include: {
        creator: {
          select: { username: true }
        },
        updater: {
          select: { username: true }
        }
      }
    });

    return this.mapToResp(sysUser);
  }

  /**
   * 更新用户
   */
  static async updateUser(id: number, userReq: UpdateUserReq): Promise<SysUserResp> {
    // 构建更新数据
    const updateData: any = {};

    if (userReq.username !== undefined) updateData.username = userReq.username;
    if (userReq.email !== undefined) updateData.email = userReq.email;
    if (userReq.phone !== undefined) updateData.phone = userReq.phone;
    if (userReq.realName !== undefined) updateData.realName = userReq.realName;
    if (userReq.nickname !== undefined) updateData.nickname = userReq.nickname;
    if (userReq.avatar !== undefined) updateData.avatar = userReq.avatar;
    if (userReq.gender !== undefined) updateData.gender = userReq.gender;
    if (userReq.birthDate !== undefined) {
      updateData.birthDate = userReq.birthDate
        ? new Date(userReq.birthDate)
        : null;
    }
    if (userReq.status !== undefined) updateData.status = userReq.status;

    // 更新用户
    const sysUser = await this.prisma.sysUser.update({
      where: {
        id,
        deletedAt: null,
      },
      data: updateData,
      include: {
        creator: { select: { username: true } },
        updater: { select: { username: true } }
      }
    });

    return this.mapToResp(sysUser);
  }
}
