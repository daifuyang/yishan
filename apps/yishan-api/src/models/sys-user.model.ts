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
    userDepts: { select: { deptId: true } };
    userRoles: { select: { roleId: true } };
  };
}>;

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
      gender: sysUser.gender.toString(),
      genderName: genderMap[sysUser.gender as keyof typeof genderMap] || "未知",
      birthDate: dateUtils.formatDate(sysUser.birthDate) ?? undefined,
      status: sysUser.status.toString(),
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
      deptIds: sysUser.userDepts.map((d) => d.deptId),
      roleIds: sysUser.userRoles.map((r) => r.roleId),
    };
  }

  /**
   * 获取用户列表（返回API响应格式，status为字符串类型）
   * 主要用于API响应，已包含关联数据和格式转换
   * @param query 查询参数
   * @returns 转换后的用户响应对象数组
   */
  static async getUserList(query: UserListQuery): Promise<SysUserResp[]> {
    const {
      page = 1,
      pageSize = 10,
      keyword,
      status,
      startTime,
      endTime,
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

    // 添加时间范围筛选条件
    if (startTime) {
      where.createdAt = where.createdAt || {};
      where.createdAt.gte = new Date(startTime);
    }
    if (endTime) {
      where.createdAt = where.createdAt || {};
      where.createdAt.lte = new Date(endTime);
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
        gender: item.gender.toString(),
        status: item.status.toString(),
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
   * 获取用户总数（返回数字类型）
   * 主要用于分页统计，返回符合条件的用户总数
   * @param query 查询参数
   * @returns 用户总数
   */
  static async getUserTotal(query: UserListQuery): Promise<number> {
    const { keyword, status, startTime, endTime } = query;

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

    // 添加时间范围筛选条件
    if (startTime) {
      where.createdAt = where.createdAt || {};
      where.createdAt.gte = new Date(startTime);
    }
    if (endTime) {
      where.createdAt = where.createdAt || {};
      where.createdAt.lte = new Date(endTime);
    }

    // 执行计数查询
    const count = await this.prisma.sysUser.count({
      where,
    });

    return count;
  }

  /**
   * 根据用户ID获取用户信息（返回API响应格式，status为字符串类型）
   * 主要用于API响应，已包含关联数据和格式转换
   * @param id 用户ID
   * @returns 转换后的用户响应对象或null
   */
  static async getUserById(id: number): Promise<SysUserResp | null> {
    const sysUser = await this.prisma.sysUser.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        creator: { select: { username: true } },
        updater: { select: { username: true } },
        userDepts: { select: { deptId: true } },
        userRoles: { select: { roleId: true } },
      }
    });

    if (!sysUser) return null;

    return this.mapToResp(sysUser);
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
   * 根据用户名获取原始用户信息（返回数据库原始对象，status为数字类型）
   * 主要用于内部业务逻辑，如登录验证、唯一性检查等
   * @param username 用户名
   * @returns 原始用户对象或null
   */
  static async getRawUserByUsername(username: string): Promise<SysUser | null> {
    const sysUser = await this.prisma.sysUser.findFirst({
      where: {
        username,
        deletedAt: null,
      },
    });
    return sysUser;
  }

  /**
   * 根据邮箱获取原始用户信息（返回数据库原始对象，status为数字类型）
   * 主要用于内部业务逻辑，如登录验证、唯一性检查等
   * @param email 邮箱地址
   * @returns 原始用户对象或null
   */
  static async getRawUserByEmail(email: string): Promise<SysUser | null> {
    const sysUser = await this.prisma.sysUser.findFirst({
      where: {
        email,
        deletedAt: null,
      },
    });

    return sysUser;
  }

  /**
   * 根据手机号获取原始用户信息（返回数据库原始对象，status为数字类型）
   * 主要用于内部业务逻辑，如登录验证、唯一性检查等
   * @param phone 手机号
   * @returns 原始用户对象或null
   */
  static async getRawUserByPhone(phone: string): Promise<SysUser | null> {
    const sysUser = await this.prisma.sysUser.findFirst({
      where: {
        phone,
        deletedAt: null,
      },
    });

    return sysUser;
  }

  /**
   * 根据用户名或邮箱获取原始用户信息（返回数据库原始对象，status为数字类型）
   * 主要用于登录验证等内部业务逻辑
   * @param usernameOrEmail 用户名或邮箱地址
   * @returns 原始用户对象或null
   */
  static async getRawUserByUsernameOrEmail(usernameOrEmail: string): Promise<SysUser | null> {
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
   * 创建用户（返回API响应格式，status为字符串类型）
   * 主要用于API响应，已包含关联数据和格式转换
   * @param userReq 用户创建请求数据
   * @param currentUserId 当前操作用户ID
   * @returns 转换后的用户响应对象
   */
  static async createUser(userReq: CreateUserReq, currentUserId: number): Promise<SysUserResp> {
    const { deptIds, roleIds, password, gender, status, ...restUserReq } = userReq;
    const passwordHash = await hashPassword(password);

    // 将字符串类型的gender和status转换为数字类型
    const genderNum = gender ? parseInt(gender, 10) : 0;
    const statusNum = status ? parseInt(status, 10) : 1;

    const result = await this.prisma.$transaction(async (prisma) => {
      const sysUser = await prisma.sysUser.create({
        data: {
          ...restUserReq,
          passwordHash,
          loginCount: 0,
          gender: genderNum,
          status: statusNum,
          creatorId: currentUserId,
          updaterId: currentUserId,
          birthDate: restUserReq.birthDate ? new Date(restUserReq.birthDate) : undefined,
        },
      });

      if (deptIds && deptIds.length > 0) {
        await prisma.sysUserDept.createMany({
          data: deptIds.map((deptId) => ({
            userId: sysUser.id,
            deptId,
          })),
        });
      }

      if (roleIds && roleIds.length > 0) {
        await prisma.sysUserRole.createMany({
          data: roleIds.map((roleId) => ({
            userId: sysUser.id,
            roleId,
          })),
        });
      }

      return sysUser;
    });

    const finalUser = await this.prisma.sysUser.findUniqueOrThrow({
      where: { id: result.id },
      include: {
        creator: { select: { username: true } },
        updater: { select: { username: true } },
        userDepts: { select: { deptId: true } },
        userRoles: { select: { roleId: true } },
      },
    });

    return this.mapToResp(finalUser);
  }

  /**
   * 更新用户（返回API响应格式，status为字符串类型）
   * 主要用于API响应，已包含关联数据和格式转换
   * @param id 用户ID
   * @param userReq 用户更新请求数据
   * @param currentUserId 当前操作用户ID
   * @returns 转换后的用户响应对象
   */
  static async updateUser(id: number, userReq: UpdateUserReq, currentUserId: number): Promise<SysUserResp> {
    const { deptIds, roleIds, password, gender, status, ...restUserReq } = userReq;

    // 准备更新数据，处理字符串到数字的转换
    const updateData: any = {
      ...restUserReq,
      updaterId: currentUserId,
      birthDate: restUserReq.birthDate
        ? new Date(restUserReq.birthDate)
        : null,
    };

    // 将字符串类型的gender和status转换为数字类型
    if (gender !== undefined) {
      updateData.gender = parseInt(gender, 10);
    }
    if (status !== undefined) {
      updateData.status = parseInt(status, 10);
    }

    const result = await this.prisma.$transaction(async (prisma) => {
      // 1. 更新用户基本信息
      const passwordHashUpdate = password !== undefined ? await hashPassword(password) : undefined;
      const sysUser = await prisma.sysUser.update({
        where: {
          id,
          deletedAt: null,
        },
        data: {
          ...updateData,
          ...(passwordHashUpdate ? { passwordHash: passwordHashUpdate } : {}),
        },
      });

      if (deptIds !== undefined) {
        const existingDeptLinks = await prisma.sysUserDept.findMany({
          where: { userId: id },
          select: { deptId: true },
        });
        const existingDeptIds = existingDeptLinks.map((link) => link.deptId);

        const deptsToCreate = deptIds.filter((deptId) => !existingDeptIds.includes(deptId));
        const deptsToDelete = existingDeptIds.filter((deptId) => !deptIds.includes(deptId));

        if (deptsToCreate.length > 0) {
          await prisma.sysUserDept.createMany({
            data: deptsToCreate.map((deptId) => ({
              userId: id,
              deptId,
            })),
          });
        }
        if (deptsToDelete.length > 0) {
          await prisma.sysUserDept.deleteMany({
            where: { userId: id, deptId: { in: deptsToDelete } },
          });
        }
      }

      if (roleIds !== undefined) {
        const existingRoleLinks = await prisma.sysUserRole.findMany({
          where: { userId: id },
          select: { roleId: true },
        });
        const existingRoleIds = existingRoleLinks.map((link) => link.roleId);

        const rolesToCreate = roleIds.filter((roleId) => !existingRoleIds.includes(roleId));
        const rolesToDelete = existingRoleIds.filter((roleId) => !roleIds.includes(roleId));

        if (rolesToCreate.length > 0) {
          await prisma.sysUserRole.createMany({
            data: rolesToCreate.map((roleId) => ({
              userId: id,
              roleId,
            })),
          });
        }
        if (rolesToDelete.length > 0) {
          await prisma.sysUserRole.deleteMany({
            where: { userId: id, roleId: { in: rolesToDelete } },
          });
        }
      }

      return sysUser;
    });

    const finalUser = await this.prisma.sysUser.findUniqueOrThrow({
      where: { id: result.id },
      include: {
        creator: { select: { username: true } },
        updater: { select: { username: true } },
        userDepts: { select: { deptId: true } },
        userRoles: { select: { roleId: true } },
      },
    });

    return this.mapToResp(finalUser);
  }
}
