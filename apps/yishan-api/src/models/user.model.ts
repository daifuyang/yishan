/**
 * 用户数据访问模型
 */

import { prismaManager } from "../utils/prisma.js";
import { UserListQuery, SaveUserReq, SysUserResp } from "../schemas/user.js";
import { SysUser } from "../generated/prisma/client.js";
import { randomBytes } from "crypto";

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

export class UserModel {
  private static prisma = prismaManager.getClient();

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
        genderName: genderMap[item.gender as keyof typeof genderMap] || "未知",
        birthDate: item.birthDate?.toISOString().split("T")[0],
        statusName: statusMap[item.status as keyof typeof statusMap] || "未知",
        lastLoginTime: item.lastLoginTime?.toISOString(),
        creatorName: item.creator.username, // 需要根据creatorId查询创建人名称
        createdAt: item.createdAt.toISOString(),
        updaterName: item.updater.username, // 需要根据updaterId查询更新人名称
        updatedAt: item.updatedAt.toISOString(),
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
  static async getUserById(id: number): Promise<SysUser | null> {
    const sysUser = await this.prisma.sysUser.findUnique({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!sysUser) return null;

    // 转换数据格式以匹配SysUser类型
    return sysUser;
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
   * 创建用户
   */
  static async createUser(userReq: SaveUserReq): Promise<SysUserResp> {
    // 生成盐值
    const salt = randomBytes(16).toString("hex");

    // 生成密码哈希（简化处理，实际应该从请求中获取密码）
    // 注意：在真实场景中，应该从请求中传递密码，并使用passwordManager.hash进行加密
    const defaultPassword = "123456"; // 默认密码
    const passwordWithSalt = defaultPassword + salt;
    const passwordHash = Buffer.from(passwordWithSalt).toString("hex"); // 简化的哈希处理

    // 创建用户
    const sysUser = await this.prisma.sysUser.create({
      data: {
        username: userReq.username,
        email: userReq.email,
        phone: userReq.phone,
        realName: userReq.realName,
        avatar: userReq.avatar,
        gender: userReq.gender ?? 0,
        birthDate: userReq.birthDate ? new Date(userReq.birthDate) : undefined,
        status: userReq.status ?? 1,
        passwordHash,
        salt,
        loginCount: 0,
        creatorId: 1,
        updaterId: 1
      },
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
    return {
      id: sysUser.id,
      username: sysUser.username,
      email: sysUser.email,
      phone: sysUser.phone ?? undefined,
      realName: sysUser.realName,
      avatar: sysUser.avatar ?? undefined,
      gender: sysUser.gender,
      genderName: genderMap[sysUser.gender as keyof typeof genderMap] || "未知",
      birthDate: sysUser.birthDate?.toISOString().split("T")[0],
      status: sysUser.status,
      statusName: statusMap[sysUser.status as keyof typeof statusMap] || "未知",
      lastLoginTime: sysUser.lastLoginTime?.toISOString(),
      lastLoginIp: sysUser.lastLoginIp ?? undefined,
      loginCount: sysUser.loginCount,
      creatorId: sysUser.creatorId,
      creatorName: sysUser.creator.username,
      createdAt: sysUser.createdAt.toISOString(),
      updaterId: sysUser.updaterId,
      updaterName: sysUser.updater.username,
      updatedAt: sysUser.updatedAt.toISOString(),
    };
  }

  /**
   * 更新用户
   */
  static async updateUser(id: number, userReq: SaveUserReq): Promise<SysUser> {
    // 构建更新数据
    const updateData: any = {};

    if (userReq.username !== undefined) updateData.username = userReq.username;
    if (userReq.email !== undefined) updateData.email = userReq.email;
    if (userReq.phone !== undefined) updateData.phone = userReq.phone;
    if (userReq.realName !== undefined) updateData.realName = userReq.realName;
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
    });

    return sysUser;
  }
}
