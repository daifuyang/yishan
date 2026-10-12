/**
 * 首页常用应用数据访问：用户固定的入口与使用计数
 */

import { asc, eq, sql } from "drizzle-orm";
import { drizzleDb, type AppQueryDb } from "@/db";
import { sysUserWorkbenchPin, sysUserWorkbenchUsage } from "@/db/schema";
import { dateUtils } from "../../utils/date.js";

export interface WorkbenchUsageRow {
  workbenchMenuId: number;
  openCount: number;
  lastOpenedAt: Date;
}

export class AppHomeRepository {
  /** 用户固定的入口 id，按用户排序 */
  static async listPinnedIds(userId: number, db: AppQueryDb = drizzleDb): Promise<number[]> {
    const rows = await db
      .select({ id: sysUserWorkbenchPin.workbenchMenuId })
      .from(sysUserWorkbenchPin)
      .where(eq(sysUserWorkbenchPin.userId, userId))
      .orderBy(asc(sysUserWorkbenchPin.sortOrder), asc(sysUserWorkbenchPin.id));
    return rows.map((row) => row.id);
  }

  /** 整体覆盖：数组下标即 sort_order。调用方负责放进事务 */
  static async replacePins(userId: number, menuIds: readonly number[], db: AppQueryDb = drizzleDb): Promise<void> {
    await db.delete(sysUserWorkbenchPin).where(eq(sysUserWorkbenchPin.userId, userId));
    if (menuIds.length === 0) return;
    const now = dateUtils.now();
    await db.insert(sysUserWorkbenchPin).values(
      menuIds.map((workbenchMenuId, sortOrder) => ({ userId, workbenchMenuId, sortOrder, createdAt: now, updatedAt: now })),
    );
  }

  static async listUsage(userId: number, db: AppQueryDb = drizzleDb): Promise<WorkbenchUsageRow[]> {
    return db
      .select({
        workbenchMenuId: sysUserWorkbenchUsage.workbenchMenuId,
        openCount: sysUserWorkbenchUsage.openCount,
        lastOpenedAt: sysUserWorkbenchUsage.lastOpenedAt,
      })
      .from(sysUserWorkbenchUsage)
      .where(eq(sysUserWorkbenchUsage.userId, userId));
  }

  static async incrementUsage(userId: number, menuId: number, db: AppQueryDb = drizzleDb): Promise<void> {
    const now = dateUtils.now();
    await db
      .insert(sysUserWorkbenchUsage)
      .values({ userId, workbenchMenuId: menuId, openCount: 1, lastOpenedAt: now, createdAt: now, updatedAt: now })
      .onDuplicateKeyUpdate({
        set: { openCount: sql`${sysUserWorkbenchUsage.openCount} + 1`, lastOpenedAt: now, updatedAt: now },
      });
  }
}
