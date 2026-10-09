/**
 * 行政区划数据访问 Repository
 *
 * sys_region 没有 deletedAt 字段，所有方法直接以 status = 1 (启用) 作为
 * "active" 判定。该表是只读字典表，暂无写入需求。
 */

import { and, asc, eq, lte } from "drizzle-orm";
import { drizzleDb, type AppQueryDb } from "@/db";
import { sysRegion } from "@/db/schema";

export type RegionRow = typeof sysRegion.$inferSelect;

export class RegionRepository {
  /**
   * 列出指定父级 code 下、状态启用的直接子级，按 sortOrder / code 升序。
   */
  static async listActiveByParent(parentCode: number, db: AppQueryDb = drizzleDb): Promise<RegionRow[]> {
    return await db
      .select()
      .from(sysRegion)
      .where(and(eq(sysRegion.parentCode, Number(parentCode)), eq(sysRegion.status, 1)))
      .orderBy(asc(sysRegion.sortOrder), asc(sysRegion.code));
  }

  /**
   * 按 code 查找行政区划（不限定状态，便于详情接口展示禁用项）。
   */
  static async findByCode(code: number, db: AppQueryDb = drizzleDb): Promise<RegionRow | null> {
    const [row] = await db
      .select()
      .from(sysRegion)
      .where(eq(sysRegion.code, Number(code)))
      .limit(1);
    return row ?? null;
  }

  /**
   * 从给定 code 向上逐级取祖先，返回 [root, ..., code] 的有序数组。
   * 任一级找不到时停止；code 为 0 或找不到时返回空数组。
   */
  static async getAncestorPath(code: number, db: AppQueryDb = drizzleDb): Promise<RegionRow[]> {
    const path: RegionRow[] = [];
    let currentCode = Number(code);
    while (currentCode) {
      const row = await RegionRepository.findByCode(currentCode, db);
      if (!row) break;
      path.unshift(row);
      if (row.parentCode === 0) break;
      currentCode = row.parentCode;
    }
    return path;
  }

  /**
   * 列出所有 level <= maxLevel 且状态启用的行政区划，供前端组装树使用。
   * maxLevel 由调用方负责裁剪到合法区间。
   */
  static async listActiveByMaxLevel(maxLevel: number, db: AppQueryDb = drizzleDb): Promise<RegionRow[]> {
    return await db
      .select()
      .from(sysRegion)
      .where(and(eq(sysRegion.status, 1), lte(sysRegion.level, maxLevel)))
      .orderBy(asc(sysRegion.level), asc(sysRegion.sortOrder), asc(sysRegion.code));
  }
}