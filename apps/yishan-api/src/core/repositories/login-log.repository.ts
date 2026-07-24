/**
 * 登录日志数据访问 Repository
 */

import { and, asc, desc, eq, getTableColumns, gte, isNotNull, isNull, like, lte, or, sql, type SQL } from "drizzle-orm";
import { drizzleDb, type AppQueryDb } from "@/db";
import { sysLoginLog } from "@/db/schema";
import { dateUtils } from "../../utils/date.js";
import type { LoginLogListRow, LoginLogDetailRow } from "../mappers/login-log.mapper.js";

// ============================================================================
// Internal Input Types
// ============================================================================

export type CreateLoginLogData = {
  userId?: number | null;
  username: string;
  realName?: string | null;
  status: 0 | 1;
  message?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

// ============================================================================
// Public Columns (getTableColumns)
// ============================================================================

const { deletedAt, ...loginLogPublicColumns } = getTableColumns(sysLoginLog);

// ============================================================================
// Internal Helpers
// ============================================================================

async function fetchLoginLogDetail(id: number, db: AppQueryDb = drizzleDb): Promise<LoginLogDetailRow | null> {
  const [row] = await db
    .select(loginLogPublicColumns)
    .from(sysLoginLog)
    .where(and(eq(sysLoginLog.id, id), isNull(sysLoginLog.deletedAt)))
    .limit(1);
  return row ?? null;
}

function buildLoginLogWhere(opts: {
  keyword?: string;
  status?: number;
  startTime?: Date;
  endTime?: Date;
}): SQL | undefined {
  const conds: SQL[] = [isNull(sysLoginLog.deletedAt)];
  if (opts.keyword) {
    const like_ = `%${opts.keyword}%`;
    conds.push(
      or(
        like(sysLoginLog.username, like_),
        like(sysLoginLog.realName, like_),
        like(sysLoginLog.ipAddress, like_),
        like(sysLoginLog.message, like_),
      )!,
    );
  }
  if (opts.status !== undefined) conds.push(eq(sysLoginLog.status, opts.status));
  if (opts.startTime) conds.push(gte(sysLoginLog.createdAt, opts.startTime));
  if (opts.endTime) conds.push(lte(sysLoginLog.createdAt, opts.endTime));
  return and(...conds);
}

// Whitelist of allowed sortBy values mapped to actual Drizzle column
// references. Single source of truth; unknown sortBy values fall back to
// the default column. Passing the column reference (not a string) into
// asc()/desc() is the Drizzle-recommended pattern and avoids SQL injection.
const LOGIN_LOG_ORDER_COLUMNS = {
  createdAt: sysLoginLog.createdAt,
} as const;
type LoginLogOrderBy = keyof typeof LOGIN_LOG_ORDER_COLUMNS;
const DEFAULT_LOGIN_LOG_ORDER_BY: LoginLogOrderBy = "createdAt";
function resolveLoginLogOrderColumn(sortBy: string | undefined) {
  if (sortBy && sortBy in LOGIN_LOG_ORDER_COLUMNS) {
    return LOGIN_LOG_ORDER_COLUMNS[sortBy as LoginLogOrderBy];
  }
  return LOGIN_LOG_ORDER_COLUMNS[DEFAULT_LOGIN_LOG_ORDER_BY];
}

// ============================================================================
// Repository
// ============================================================================

export class LoginLogRepository {
  // --------------------------------------------------------------------------
  // Public: Standard Methods
  // --------------------------------------------------------------------------

  static async list(query: {
    page?: number;
    pageSize?: number;
    keyword?: string;
    status?: number;
    startTime?: Date;
    endTime?: Date;
    sortBy?: string;
    sortOrder?: string;
  } = {}): Promise<LoginLogListRow[]> {
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

    const where = buildLoginLogWhere({ keyword, status, startTime, endTime });

    const dir = sortOrder === "asc" ? asc : desc;
    const orderCol = resolveLoginLogOrderColumn(sortBy);

    const baseQuery = drizzleDb.select(loginLogPublicColumns).from(sysLoginLog).where(where).orderBy(dir(orderCol));
    const rows = pageSize > 0
      ? await baseQuery.limit(pageSize).offset((page - 1) * pageSize)
      : await baseQuery;

    return rows;
  }

  static async count(query: {
    keyword?: string;
    status?: number;
    startTime?: Date;
    endTime?: Date;
  } = {}): Promise<number> {
    const where = buildLoginLogWhere(query);
    const [row] = await drizzleDb
      .select({ c: sql<number>`count(*)` })
      .from(sysLoginLog)
      .where(where);
    return Number(row?.c ?? 0);
  }

  static async findById(id: number): Promise<LoginLogDetailRow | null> {
    return fetchLoginLogDetail(id);
  }

  /**
   * List login logs scoped to a single user, newest first.
   * Used by "my login logs" endpoints where keyword/status filters are not exposed.
   */
  static async listByUserId(
    userId: number,
    query: { page?: number; pageSize?: number } = {},
    db: AppQueryDb = drizzleDb,
  ): Promise<LoginLogListRow[]> {
    const { page = 1, pageSize = 10 } = query;
    const where = and(isNull(sysLoginLog.deletedAt), eq(sysLoginLog.userId, userId));
    const baseQuery = db
      .select(loginLogPublicColumns)
      .from(sysLoginLog)
      .where(where)
      .orderBy(desc(sysLoginLog.createdAt));

    return pageSize > 0
      ? await baseQuery.limit(pageSize).offset((page - 1) * pageSize)
      : await baseQuery;
  }

  /** Count login logs for a single user. */
  static async countByUserId(userId: number, db: AppQueryDb = drizzleDb): Promise<number> {
    const where = and(isNull(sysLoginLog.deletedAt), eq(sysLoginLog.userId, userId));
    const [row] = await db
      .select({ c: sql<number>`count(*)` })
      .from(sysLoginLog)
      .where(where);
    return Number(row?.c ?? 0);
  }

  static async create(data: CreateLoginLogData, db: AppQueryDb = drizzleDb): Promise<LoginLogDetailRow> {
    const now = dateUtils.now();
    const [inserted] = await db
      .insert(sysLoginLog)
      .values({
        userId: data.userId ?? null,
        username: data.username,
        realName: data.realName ?? null,
        status: data.status,
        message: data.message ?? null,
        ipAddress: data.ipAddress ?? null,
        userAgent: data.userAgent ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .$returningId();

    const row = await fetchLoginLogDetail(inserted.id, db);
    if (!row) throw new Error("Failed to read back created login log");
    return row;
  }

  /**
   * Count distinct non-null `userId` values in login logs created at or
   * after `since` (and not soft-deleted). Used by the dashboard to derive
   * the "online" user count without pulling the full list.
   */
  static async countDistinctUsersInWindow(since: Date, db: AppQueryDb = drizzleDb): Promise<number> {
    const [row] = await db
      .select({ c: sql<number>`count(distinct ${sysLoginLog.userId})` })
      .from(sysLoginLog)
      .where(
        and(
          gte(sysLoginLog.createdAt, since),
          isNotNull(sysLoginLog.userId),
          isNull(sysLoginLog.deletedAt),
        ),
      );
    return Number(row?.c ?? 0);
  }

  /**
   * 登录失败次数（按 username），用于应用层 brute-force 防护。
   * "失败"指 status=0（"用户名或密码错误" / "用户不存在" / "账号被禁用"等）。
   * 不区分 userId 是否为 null——对不存在的用户名暴力穷举也计入。
   */
  static async countFailuresForUsernameSince(
    username: string,
    since: Date,
    db: AppQueryDb = drizzleDb,
  ): Promise<number> {
    const [row] = await db
      .select({ c: sql<number>`count(*)` })
      .from(sysLoginLog)
      .where(
        and(
          eq(sysLoginLog.username, username),
          eq(sysLoginLog.status, 0),
          gte(sysLoginLog.createdAt, since),
          isNull(sysLoginLog.deletedAt),
        ),
      );
    return Number(row?.c ?? 0);
  }
}
