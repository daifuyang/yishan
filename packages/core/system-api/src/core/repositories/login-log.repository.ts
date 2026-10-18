/**
 * 登录日志数据访问 Repository
 */

import { and, asc, desc, eq, getTableColumns, gte, isNotNull, isNull, like, lte, or, sql, type SQL } from "drizzle-orm";
import { drizzleDb, type AppQueryDb } from "@/db";
import { sysLoginLog } from "@/db/schema";
import { currentDataScope, isDataScopeBypassed, resolveDataScope, userIdInScopeCondition } from "@/core/auth/data-scope";
import { dateUtils } from "../../utils/date.js";
import { clampOffset } from "./_pagination.js";
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

/**
 * Single detail-query helper shared by the admin lookup and the user-scoped
 * "my login log" lookup. `userId` pins to one user; `dataScope` applies the
 * caller's row-level range. Both are optional but a caller that omits *both*
 * is an unconstrained read — `findById` refuses that and always supplies the
 * range, so a detail lookup can't be used to walk around the list filter.
 */
async function fetchLoginLogDetail(
  id: number,
  db: AppQueryDb = drizzleDb,
  userId?: number,
  dataScope?: SQL,
): Promise<LoginLogDetailRow | null> {
  const conds: SQL[] = [eq(sysLoginLog.id, id), isNull(sysLoginLog.deletedAt)];
  if (userId !== undefined) conds.push(eq(sysLoginLog.userId, userId));
  if (dataScope) conds.push(dataScope);
  const [row] = await db
    .select(loginLogPublicColumns)
    .from(sysLoginLog)
    .where(and(...conds))
    .limit(1);
  return row ?? null;
}

function buildLoginLogWhere(opts: {
  keyword?: string;
  status?: number;
  startTime?: Date;
  endTime?: Date;
  dataScope?: SQL;
}): SQL | undefined {
  const conds: SQL[] = [isNull(sysLoginLog.deletedAt)];
  // 行级数据范围：登录日志以 user_id 关联到用户，按「范围内用户」收敛。
  // user_id 为空的行（用户名不存在导致的失败登录）天然被 IN 排除。
  if (opts.dataScope) {
    conds.push(opts.dataScope);
  }
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

    const where = buildLoginLogWhere({
      keyword,
      status,
      startTime,
      endTime,
      dataScope: await LoginLogRepository.dataScopeCondition(),
    });

    const dir = sortOrder === "asc" ? asc : desc;
    const orderCol = resolveLoginLogOrderColumn(sortBy);

    const baseQuery = drizzleDb.select(loginLogPublicColumns).from(sysLoginLog).where(where).orderBy(dir(orderCol));
    const rows = pageSize > 0
      ? await baseQuery.limit(pageSize).offset(clampOffset(page, pageSize))
      : await baseQuery;

    return rows;
  }

  /**
   * 登录日志的行级范围条件。
   *
   * 与列表共用同一解析结果：登录日志本身就是「谁登录了什么」，
   * 一个部门管理员看到本部门之外谁的登录记录，没有业务上的道理。
   *
   * 用 `user_id in (select ...)` 而不是把子查询塞进 `=`：范围内的用户是多行时，
   * 标量比较在 MySQL 下会直接报 `Operand should contain 1 column`。
   */
  static async dataScopeCondition(): Promise<SQL | undefined> {
    const subject = currentDataScope()
    if (!subject && !isDataScopeBypassed()) {
      // 缺上下文的业务查询 fail closed，而不是静默放开。
      return sql`1 = 0`
    }
    if (!subject) return undefined
    return userIdInScopeCondition(await resolveDataScope(subject), sysLoginLog.userId)
  }

  static async count(query: {
    keyword?: string;
    status?: number;
    startTime?: Date;
    endTime?: Date;
  } = {}): Promise<number> {
    const where = buildLoginLogWhere({
      ...query,
      dataScope: await LoginLogRepository.dataScopeCondition(),
    });
    const [row] = await drizzleDb
      .select({ c: sql<number>`count(*)` })
      .from(sysLoginLog)
      .where(where);
    return Number(row?.c ?? 0);
  }

  /** 管理端详情。与列表同一行级范围：范围外的记录返回 null（不区分「不存在」与「不是你的」）。 */
  static async findById(id: number): Promise<LoginLogDetailRow | null> {
    return fetchLoginLogDetail(id, drizzleDb, undefined, await LoginLogRepository.dataScopeCondition());
  }

  /**
   * Detail lookup constrained to a single user. Returns `null` when the row
   * exists but belongs to someone else, so callers cannot distinguish
   * "not found" from "not yours".
   */
  static async findByIdForUser(id: number, userId: number): Promise<LoginLogDetailRow | null> {
    return fetchLoginLogDetail(id, drizzleDb, userId);
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
      ? await baseQuery.limit(pageSize).offset(clampOffset(page, pageSize))
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
          await LoginLogRepository.dataScopeCondition(),
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
