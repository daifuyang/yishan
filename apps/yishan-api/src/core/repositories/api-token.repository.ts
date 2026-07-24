/**
 * API令牌数据访问 Repository
 */

import { randomBytes, createHash } from "node:crypto";
import { and, desc, eq, getTableColumns, gt, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { drizzleDb, type AppQueryDb } from "@/db";
import { sysApiToken } from "@/db/schema";
import { dateUtils } from "../../utils/date.js";

// ============================================================================
// Public Columns (getTableColumns)
// ============================================================================

const { deletedAt, ...apiTokenPublicColumns } = getTableColumns(sysApiToken);

// ============================================================================
// Internal Input Types
// ============================================================================

export interface CreateApiTokenInput {
  userId: number;
  name: string;
  expiresAt?: Date | null;
  /**
   * 授权范围，Section 2 (PAT) 强制约束：不能默认继承用户全部权限。
   * - undefined/null → 空 scopes 集合（保守默认，无任何资源授权）；
   * - `[]` 同样视为空集合；
   * - 列表由 `system:*:read` / `shop:product:update` 等 permission code 构成。
   */
  scopes?: string[] | null;
}

export interface ApiTokenRecord {
  id: number;
  name: string;
  scopes: string[];
  userId: number;
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  lastUsedIp: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiTokenWithRaw extends ApiTokenRecord {
  /** Plaintext token shown exactly once at creation time. */
  raw: string;
}

// ============================================================================
// Internal Helpers
// ============================================================================

const TOKEN_PREFIX = "yishan_pat_";

function generateRawToken(): string {
  // 32 bytes -> base64url -> ~43 chars
  return TOKEN_PREFIX + randomBytes(32).toString("base64url");
}

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

async function fetchApiTokenDetail(id: number, db: AppQueryDb = drizzleDb): Promise<ApiTokenRecord | null> {
  const [row] = await db
    .select(apiTokenPublicColumns)
    .from(sysApiToken)
    .where(and(eq(sysApiToken.id, id), isNull(sysApiToken.deletedAt)))
    .limit(1);
  return normalizeTokenRow(row);
}

/**
 * 把 db.select(...) 返回的 raw row（可能 scopes 为 unknown / string / 数组）规范化成
 * 公开的 ApiTokenRecord 类型。JSON 字段在 MySQL / Drizzle 上的类型会因驱动而异，
 * 这里把它收敛到 string[]。
 */
function normalizeTokenRow(
  row: Record<string, unknown> | undefined,
): ApiTokenRecord | null {
  if (!row) return null;
  const rawScopes = row.scopes;
  let scopes: string[] = [];
  if (Array.isArray(rawScopes)) {
    scopes = rawScopes.filter((s): s is string => typeof s === "string");
  } else if (typeof rawScopes === "string") {
    try {
      const parsed = JSON.parse(rawScopes);
      if (Array.isArray(parsed)) {
        scopes = parsed.filter((s): s is string => typeof s === "string");
      }
    } catch {
      scopes = [];
    }
  }
  return { ...(row as unknown as Omit<ApiTokenRecord, "scopes">), scopes };
}

// ============================================================================
// Repository
// ============================================================================

export class ApiTokenRepository {
  /**
   * Create a new API token. Returns the DB record + the raw token (one-time display).
   */
  static async create(input: CreateApiTokenInput, db: AppQueryDb = drizzleDb): Promise<ApiTokenWithRaw> {
    const raw = generateRawToken();
    const tokenHash = hashToken(raw);
    const now = dateUtils.now();
    const normalizedScopes = input.scopes ?? [];
    const [inserted] = await db
      .insert(sysApiToken)
      .values({
        name: input.name,
        // Drizzle/MySQL JSON 列接受 string[]，这里转 unknown 避免类型冲突
        scopes: normalizedScopes as unknown as null,
        tokenHash,
        userId: input.userId,
        expiresAt: input.expiresAt ?? null,
        lastUsedAt: null,
        lastUsedIp: null,
        createdAt: now,
        updatedAt: now,
        version: 1,
      })
      .$returningId();
    if (!inserted) throw new Error("Failed to create api token");

    const row = await fetchApiTokenDetail(inserted.id, db);
    if (!row) throw new Error("Failed to read back created api token");
    return { ...row, raw };
  }

  /**
   * Look up by raw token string. Returns null if not found, soft-deleted, or expired.
   */
  static async findByRawToken(raw: string, db: AppQueryDb = drizzleDb): Promise<ApiTokenRecord | null> {
    if (!raw.startsWith(TOKEN_PREFIX)) return null;
    const tokenHash = hashToken(raw);
    const now = dateUtils.now();
    // 条件：tokenHash 匹配 AND 未软删除 AND (无过期时间 OR 未过期)
    const tokenNotExpired = or(
      isNull(sysApiToken.expiresAt),
      gt(sysApiToken.expiresAt, now),
    );
    const [row] = await db
      .select(apiTokenPublicColumns)
      .from(sysApiToken)
      .where(and(
        eq(sysApiToken.tokenHash, tokenHash),
        isNull(sysApiToken.deletedAt),
        tokenNotExpired,
      ))
      .limit(1);
    return normalizeTokenRow(row);
  }

  /**
   * List all non-deleted tokens owned by a user. Does not return the hash in the public type.
   */
  static async listByUser(userId: number, db: AppQueryDb = drizzleDb): Promise<ApiTokenRecord[]> {
    const rows = await db
      .select(apiTokenPublicColumns)
      .from(sysApiToken)
      .where(and(eq(sysApiToken.userId, userId), isNull(sysApiToken.deletedAt)))
      .orderBy(desc(sysApiToken.createdAt));
    return rows.map((r) => normalizeTokenRow(r)).filter((r): r is ApiTokenRecord => r !== null);
  }

  /**
   * Find a token by id, scoped to a user. Returns null if not found, not owned by user, or deleted.
   */
  static async findByIdForUser(id: number, userId: number, db: AppQueryDb = drizzleDb): Promise<ApiTokenRecord | null> {
    const [row] = await db
      .select(apiTokenPublicColumns)
      .from(sysApiToken)
      .where(and(eq(sysApiToken.id, id), eq(sysApiToken.userId, userId), isNull(sysApiToken.deletedAt)))
      .limit(1);
    return normalizeTokenRow(row);
  }

  /**
   * Soft-delete (revoke) a token. Only the owner can revoke. Returns true on success.
   */
  static async revoke(id: number, userId: number, db: AppQueryDb = drizzleDb): Promise<boolean> {
    const [existing] = await db
      .select({ id: sysApiToken.id })
      .from(sysApiToken)
      .where(and(eq(sysApiToken.id, id), eq(sysApiToken.userId, userId), isNull(sysApiToken.deletedAt)))
      .limit(1);
    if (!existing) return false;

    const now = dateUtils.now();
    await db
      .update(sysApiToken)
      .set({ deletedAt: now, updatedAt: now })
      .where(eq(sysApiToken.id, id));
    return true;
  }

  /**
   * Best-effort touch (last_used_at, last_used_ip). Called from auth hook on each
   * successful API-token request. Errors are swallowed by the caller.
   */
  static async touch(id: number, ip: string | null, db: AppQueryDb = drizzleDb): Promise<void> {
    const now = dateUtils.now();
    await db
      .update(sysApiToken)
      .set({ lastUsedAt: now, lastUsedIp: ip, updatedAt: now })
      .where(eq(sysApiToken.id, id));
  }

  /**
   * 全局 API Token 统计（不限定 userId），用于 `/api/v1/system/token-stats`：
   *   - total:    未软删的所有 PAT 数
   *   - active:   未软删且未过期（expiresAt 为 NULL 或 > now）
   *   - expired:  未软删但已过期（expiresAt <= now）
   *   - revoked:  已被软删除（deletedAt IS NOT NULL）
   * 四个计数互斥地覆盖 total：active + expired + revoked = total。
   *
   * 与 UserTokenRepository.getGlobalTokenStats 口径一致，但底层表是 sys_api_token（PAT），
   * 不是 sys_user_token（JWT access token）。
   */
  static async getGlobalApiTokenStats(db: AppQueryDb = drizzleDb) {
    const now = dateUtils.now();
    const notDeletedCond = isNull(sysApiToken.deletedAt);

    const [totalRow] = await db
      .select({ c: sql<number>`count(*)` })
      .from(sysApiToken)
      .where(notDeletedCond);

    const [activeRow] = await db
      .select({ c: sql<number>`count(*)` })
      .from(sysApiToken)
      .where(
        and(
          notDeletedCond,
          or(isNull(sysApiToken.expiresAt), gt(sysApiToken.expiresAt, now))!,
        )!,
      );

    const [expiredRow] = await db
      .select({ c: sql<number>`count(*)` })
      .from(sysApiToken)
      .where(
        and(
          notDeletedCond,
          lt(sysApiToken.expiresAt, now),
        )!,
      );

    const [revokedRow] = await db
      .select({ c: sql<number>`count(*)` })
      .from(sysApiToken)
      .where(isNotNull(sysApiToken.deletedAt));

    return {
      total: Number(totalRow?.c ?? 0),
      active: Number(activeRow?.c ?? 0),
      expired: Number(expiredRow?.c ?? 0),
      revoked: Number(revokedRow?.c ?? 0),
    };
  }
}
