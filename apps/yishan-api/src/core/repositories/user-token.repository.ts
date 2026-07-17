/**
 * 用户令牌数据访问 Repository
 */

import { and, desc, eq, getTableColumns, gt, isNull, lt, or, sql } from "drizzle-orm";
import { drizzleDb, type AppQueryDb } from "@/db";
import { sysUser, sysUserToken } from "@/db/schema";
import { dateUtils } from "../../utils/date.js";
import { toAffectedCount } from "../db/result.js";

// ============================================================================
// Public Columns (getTableColumns)
// ============================================================================

const { deletedAt, ...userTokenPublicColumns } = getTableColumns(sysUserToken);

// ============================================================================
// Internal Input Types
// ============================================================================

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

// ============================================================================
// Internal Helpers
// ============================================================================

async function fetchUserTokenDetail(id: number, db: AppQueryDb = drizzleDb) {
  const [row] = await db
    .select(userTokenPublicColumns)
    .from(sysUserToken)
    .where(and(eq(sysUserToken.id, id), isNull(sysUserToken.deletedAt)))
    .limit(1);
  return row ?? null;
}

// ============================================================================
// Repository
// ============================================================================

export class UserTokenRepository {
  /**
   * 创建用户令牌记录
   */
  static async create(data: CreateUserTokenData, db: AppQueryDb = drizzleDb) {
    const now = dateUtils.now();
    const [inserted] = await db
      .insert(sysUserToken)
      .values({
        userId: data.userId,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        accessTokenExpiresAt: data.accessTokenExpiresAt,
        refreshTokenExpiresAt: data.refreshTokenExpiresAt,
        ipAddress: data.ipAddress ?? null,
        userAgent: data.userAgent ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .$returningId();

    const row = await fetchUserTokenDetail(inserted.id, db);
    if (!row) throw new Error("Failed to read back created user token");
    return row;
  }

  /**
   * 根据访问令牌查找记录(连同所属用户)
   */
  static async findByAccessToken(accessToken: string, db: AppQueryDb = drizzleDb) {
    const [token] = await db
      .select(userTokenPublicColumns)
      .from(sysUserToken)
      .where(
        and(
          eq(sysUserToken.accessToken, accessToken),
          eq(sysUserToken.isRevoked, false),
          isNull(sysUserToken.deletedAt),
          gt(sysUserToken.accessTokenExpiresAt, dateUtils.now()),
        ),
      )
      .limit(1);
    if (!token) return null;
    const [user] = await db.select().from(sysUser).where(eq(sysUser.id, token.userId)).limit(1);
    return { ...token, user: user ?? null };
  }

  /**
   * 根据刷新令牌查找记录(连同所属用户)
   */
  static async findByRefreshToken(refreshToken: string, db: AppQueryDb = drizzleDb) {
    const [token] = await db
      .select(userTokenPublicColumns)
      .from(sysUserToken)
      .where(
        and(
          eq(sysUserToken.refreshToken, refreshToken),
          eq(sysUserToken.isRevoked, false),
          isNull(sysUserToken.deletedAt),
          gt(sysUserToken.refreshTokenExpiresAt, dateUtils.now()),
        ),
      )
      .limit(1);
    if (!token) return null;
    const [user] = await db.select().from(sysUser).where(eq(sysUser.id, token.userId)).limit(1);
    return { ...token, user: user ?? null };
  }

  /**
   * 根据用户ID获取活跃令牌
   */
  static async findActiveTokensByUserId(userId: number, db: AppQueryDb = drizzleDb) {
    return await db
      .select(userTokenPublicColumns)
      .from(sysUserToken)
      .where(
        and(
          eq(sysUserToken.userId, userId),
          eq(sysUserToken.isRevoked, false),
          isNull(sysUserToken.deletedAt),
          gt(sysUserToken.accessTokenExpiresAt, dateUtils.now()),
        ),
      )
      .orderBy(desc(sysUserToken.createdAt));
  }

  /**
   * 更新令牌记录
   */
  static async update(id: number, data: UpdateUserTokenData, db: AppQueryDb = drizzleDb) {
    const now = dateUtils.now();
    await db
      .update(sysUserToken)
      .set({
        ...data,
        updatedAt: now,
      })
      .where(eq(sysUserToken.id, id));
  }

  /**
   * 撤销令牌(软删除)
   */
  static async revoke(id: number, db: AppQueryDb = drizzleDb) {
    const now = dateUtils.now();
    await db
      .update(sysUserToken)
      .set({ isRevoked: true, revokedAt: now, updatedAt: now })
      .where(eq(sysUserToken.id, id));
  }

  /**
   * 根据用户ID撤销所有活跃令牌
   */
  static async revokeAllByUserId(userId: number, db: AppQueryDb = drizzleDb) {
    const now = dateUtils.now();
    const result = await db
      .update(sysUserToken)
      .set({ isRevoked: true, revokedAt: now, updatedAt: now })
      .where(
        and(
          eq(sysUserToken.userId, userId),
          eq(sysUserToken.isRevoked, false),
          isNull(sysUserToken.deletedAt),
        ),
      );
    return toAffectedCount(result);
  }

  /**
   * 清理过期令牌
   */
  static async cleanupExpiredTokens(db: AppQueryDb = drizzleDb) {
    const now = dateUtils.now();
    const result = await db
      .update(sysUserToken)
      .set({ isRevoked: true, revokedAt: now, updatedAt: now })
      .where(
        and(
          or(
            lt(sysUserToken.accessTokenExpiresAt, now),
            lt(sysUserToken.refreshTokenExpiresAt, now),
          )!,
          eq(sysUserToken.isRevoked, false),
          isNull(sysUserToken.deletedAt),
        ),
      );
    return toAffectedCount(result);
  }

  /**
   * 物理删除过期令牌(用于定时任务)
   */
  static async deleteExpiredTokens(daysToKeep = 30, db: AppQueryDb = drizzleDb) {
    const cutoffDate = dateUtils.now();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const result = await db
      .delete(sysUserToken)
      .where(
        or(
          lt(sysUserToken.accessTokenExpiresAt, cutoffDate),
          lt(sysUserToken.refreshTokenExpiresAt, cutoffDate),
        )!,
      );
    return toAffectedCount(result);
  }

  /**
   * 获取用户令牌统计
   */
  static async getUserTokenStats(userId: number, db: AppQueryDb = drizzleDb) {
    const now = dateUtils.now();
    const [activeRow] = await db
      .select({ c: sql<number>`count(*)` })
      .from(sysUserToken)
      .where(
        and(
          eq(sysUserToken.userId, userId),
          eq(sysUserToken.isRevoked, false),
          isNull(sysUserToken.deletedAt),
          gt(sysUserToken.accessTokenExpiresAt, now),
        ),
      );
    const [totalRow] = await db
      .select({ c: sql<number>`count(*)` })
      .from(sysUserToken)
      .where(and(eq(sysUserToken.userId, userId), isNull(sysUserToken.deletedAt)));
    const activeTokens = Number(activeRow?.c ?? 0);
    const totalTokens = Number(totalRow?.c ?? 0);
    return {
      activeTokens,
      totalTokens,
      expiredTokens: totalTokens - activeTokens,
    };
  }

  /**
   * 全局令牌统计（不限定 userId），用于后台仪表盘 / 系统管理页：
   *   - totalTokens:    未软删的所有 token 数
   *   - activeTokens:   未撤销且未过期
   *   - expiredTokens:  未撤销但已过期
   *   - revokedTokens:  已被撤销
   * 四个计数互斥地覆盖 totalTokens：active + expired + revoked = total。
   */
  static async getGlobalTokenStats(db: AppQueryDb = drizzleDb) {
    const now = dateUtils.now();
    const baseCond = isNull(sysUserToken.deletedAt);
    const notRevokedCond = and(eq(sysUserToken.isRevoked, false), baseCond);

    const [totalRow] = await db
      .select({ c: sql<number>`count(*)` })
      .from(sysUserToken)
      .where(baseCond);

    const [activeRow] = await db
      .select({ c: sql<number>`count(*)` })
      .from(sysUserToken)
      .where(and(notRevokedCond, gt(sysUserToken.accessTokenExpiresAt, now))!);

    const [expiredRow] = await db
      .select({ c: sql<number>`count(*)` })
      .from(sysUserToken)
      .where(and(notRevokedCond, lt(sysUserToken.accessTokenExpiresAt, now))!);

    const [revokedRow] = await db
      .select({ c: sql<number>`count(*)` })
      .from(sysUserToken)
      .where(and(eq(sysUserToken.isRevoked, true), baseCond)!);

    return {
      totalTokens: Number(totalRow?.c ?? 0),
      activeTokens: Number(activeRow?.c ?? 0),
      expiredTokens: Number(expiredRow?.c ?? 0),
      revokedTokens: Number(revokedRow?.c ?? 0),
    };
  }
}
