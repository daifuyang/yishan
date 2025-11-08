/**
 * 用户令牌模型 - 用于管理JWT令牌存储
 */

import { prisma } from "../utils/prisma.js";
import { dateUtils } from "../utils/date.js";

export interface CreateUserTokenData {
  userId: number;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
}

export interface UpdateUserTokenData {
  accessToken?: string;
  refreshToken?: string;
  accessTokenExpiresAt?: Date;
  refreshTokenExpiresAt?: Date;
  isRevoked?: boolean;
  revokedAt?: Date | null;
}

export class SysUserTokenModel {
  /**
   * 创建用户令牌记录
   */
  static async create(data: CreateUserTokenData) {
    return await prisma.sysUserToken.create({
      data: {
        userId: data.userId,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        accessTokenExpiresAt: data.accessTokenExpiresAt,
        refreshTokenExpiresAt: data.refreshTokenExpiresAt,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent
      }
    });
  }

  /**
   * 根据访问令牌查找记录
   */
  static async findByAccessToken(accessToken: string) {
    return await prisma.sysUserToken.findFirst({
      where: {
        accessToken,
        isRevoked: false,
        deletedAt: null,
        accessTokenExpiresAt: {
          gt: dateUtils.now()
        }
      },
      include: {
        user: true
      }
    });
  }

  /**
   * 根据刷新令牌查找记录
   */
  static async findByRefreshToken(refreshToken: string) {
    return await prisma.sysUserToken.findFirst({
      where: {
        refreshToken,
        isRevoked: false,
        deletedAt: null,
        refreshTokenExpiresAt: {
          gt: dateUtils.now()
        }
      },
      include: {
        user: true
      }
    });
  }

  /**
   * 根据用户ID获取活跃令牌
   */
  static async findActiveTokensByUserId(userId: number) {
    return await prisma.sysUserToken.findMany({
      where: {
        userId,
        isRevoked: false,
        deletedAt: null,
        accessTokenExpiresAt: {
          gt: dateUtils.now()
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  /**
   * 更新令牌记录
   */
  static async update(id: number, data: UpdateUserTokenData) {
    return await prisma.sysUserToken.update({
      where: { id },
      data: {
        ...data,
        updatedAt: dateUtils.now()
      }
    });
  }

  /**
   * 撤销令牌（软删除）
   */
  static async revoke(id: number) {
    return await prisma.sysUserToken.update({
      where: { id },
      data: {
        isRevoked: true,
        revokedAt: dateUtils.now(),
        updatedAt: dateUtils.now()
      }
    });
  }

  /**
   * 根据用户ID撤销所有活跃令牌
   */
  static async revokeAllByUserId(userId: number) {
    return await prisma.sysUserToken.updateMany({
      where: {
        userId,
        isRevoked: false,
        deletedAt: null
      },
      data: {
        isRevoked: true,
        revokedAt: dateUtils.now(),
        updatedAt: dateUtils.now()
      }
    });
  }

  /**
   * 清理过期令牌
   */
  static async cleanupExpiredTokens() {
    const now = dateUtils.now();
    return await prisma.sysUserToken.updateMany({
      where: {
        OR: [
          { accessTokenExpiresAt: { lt: now } },
          { refreshTokenExpiresAt: { lt: now } }
        ],
        isRevoked: false,
        deletedAt: null
      },
      data: {
        isRevoked: true,
        revokedAt: now,
        updatedAt: now
      }
    });
  }

  /**
   * 物理删除过期令牌（用于定时任务）
   */
  static async deleteExpiredTokens(daysToKeep = 30) {
    const cutoffDate = dateUtils.now();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    return await prisma.sysUserToken.deleteMany({
      where: {
        OR: [
          { accessTokenExpiresAt: { lt: cutoffDate } },
          { refreshTokenExpiresAt: { lt: cutoffDate } }
        ]
      }
    });
  }

  /**
   * 获取用户令牌统计
   */
  static async getUserTokenStats(userId: number) {
    const now = dateUtils.now();
    const [activeTokens, totalTokens] = await Promise.all([
      prisma.sysUserToken.count({
        where: {
          userId,
          isRevoked: false,
          deletedAt: null,
          accessTokenExpiresAt: { gt: now }
        }
      }),
      prisma.sysUserToken.count({
        where: {
          userId,
          deletedAt: null
        }
      })
    ]);

    return {
      activeTokens,
      totalTokens,
      expiredTokens: totalTokens - activeTokens
    };
  }
}