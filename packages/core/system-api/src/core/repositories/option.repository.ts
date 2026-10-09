/**
 * 系统配置数据访问 Repository
 */

import { and, eq, getTableColumns, isNull } from "drizzle-orm";
import { drizzleDb, type AppQueryDb } from "@/db";
import { sysOption } from "@/db/schema";
import { dateUtils } from "../../utils/date.js";

// ============================================================================
// Public Columns (getTableColumns)
// ============================================================================

const { deletedAt, ...optionPublicColumns } = getTableColumns(sysOption);

// ============================================================================
// Internal Helpers
// ============================================================================

async function fetchOptionByKey(key: string, db: AppQueryDb = drizzleDb) {
  const [row] = await db
    .select(optionPublicColumns)
    .from(sysOption)
    .where(and(eq(sysOption.key, key), isNull(sysOption.deletedAt)))
    .limit(1);
  return row ?? null;
}

// ============================================================================
// Repository
// ============================================================================

export class OptionRepository {
  static async getOptionValue(key: string, db: AppQueryDb = drizzleDb): Promise<string | null> {
    const opt = await fetchOptionByKey(key, db);
    const v = opt?.value;
    return v == null ? null : String(v);
  }

  static async setOptionValue(
    key: string,
    value: string,
    userId?: number,
    db: AppQueryDb = drizzleDb
  ): Promise<string> {
    const existed = await fetchOptionByKey(key, db);
    const now = dateUtils.now();

    if (existed) {
      await db
        .update(sysOption)
        .set({ value, updaterId: userId ?? null, updatedAt: now })
        .where(eq(sysOption.id, existed.id));
      return value;
    }
    await db.insert(sysOption).values({
      key,
      value,
      status: 1,
      creatorId: userId ?? null,
      updaterId: userId ?? null,
      createdAt: now,
      updatedAt: now,
    });
    return value;
  }
}
