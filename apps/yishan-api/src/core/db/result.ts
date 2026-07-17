/**
 * 共享的 Drizzle / mysql2 raw query 结果类型与访问工具
 *
 * Drizzle 的 `db.update(...)` / `db.delete(...)` 在 mysql2 adapter 下返回
 * `MySqlRawQueryResult = [ResultSetHeader, FieldPacket[]]`。
 * 直接对返回结果做 `as any` 是为了取 `[0].affectedRows`，但这样会丢失类型推断。
 * 这里集中提供具名别名与安全访问函数。
 */

import type { ResultSetHeader, FieldPacket } from "mysql2/promise";

/** Tuple returned by Drizzle's mysql2 `update`/`delete` operations. */
export type AppRawQueryResult = [ResultSetHeader, FieldPacket[]];

/** Safe accessor for `affectedRows` from a Drizzle mysql2 update/delete result. */
export function affectedRows(result: AppRawQueryResult): number {
  return result[0]?.affectedRows ?? 0;
}

/** Wrap an update/delete result as `{ count }` — matches the existing repo return shape. */
export function toAffectedCount(result: AppRawQueryResult): { count: number } {
  return { count: affectedRows(result) };
}