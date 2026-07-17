/**
 * 集成测试共享装置（Section 5）。
 *
 * 行为约定：
 *   - 如果 YISHAN_RUN_INTEGRATION != '1'，则 setupIntegration() 返回 { skip: true }，
 *     测试应当 `test.skip()` 跳过。
 *   - 否则根据 YISHAN_TEST_MYSQL_URL 连接 MySQL，建库 / drop / 跑迁移，
 *     构造独立 drizzle client，并把它通过 vi.doMock 替换全局 @/db 模块，
 *     确保 PermissionService 等通过 @/db 导入 drizzleDb 的代码也走测试库。
 *   - 提供 closeDb() 释放连接池。
 *
 * DB 隔离原理：
 *   test/setup.ts 在所有测试启动时把 @/db 替换为 mock；
 *   这里用 vi.unmock + vi.resetModules 取消全局 mock，再通过
 *   vi.doMock('@/db', () => ({ drizzleDb: testDb, pool: testPool, schema, dbManager }))
 *   注入真实连接；之后通过 vi.resetModules + 动态 import 重新加载 PermissionService
 *   与相关仓库，使它们拿到 testDb。
 */

import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { vi } from "vitest";

export interface IntegrationContext {
  skip: boolean;
  pool?: mysql.Pool;
  /** Reset schema before each test */
  resetSchema?: () => Promise<void>;
  closeDb?: () => Promise<void>;
}

const SQL_DIR = join(process.cwd(), "drizzle");
const SKIP_FLAG = "YISHAN_RUN_INTEGRATION";

/**
 * Run all Drizzle SQL migrations under `drizzle/*.sql` against the test database.
 */
async function runMigrations(pool: mysql.Pool): Promise<void> {
  const files = readdirSync(SQL_DIR).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    const raw = readFileSync(join(SQL_DIR, file), "utf8");
    // drizzle-kit emits `--> statement-breakpoint` markers between statements;
    // some (hand-maintained) files just use `;` at end of statement. Split on
    // whichever is present so the file becomes a sequence of statements.
    const hasBreakpoint = /-->\s*statement-breakpoint/.test(raw);
    const rawStatements = hasBreakpoint
      ? raw.split(/-->\s*statement-breakpoint/)
      : raw.split(";");
    const statements = rawStatements
      .map((s) => s.replace(/--[^\n]*/g, "").trim())
      .filter(Boolean);
    for (const stmt of statements) {
      // Skip pure comments left after stripping
      if (/^--/.test(stmt)) continue;
      try {
        await pool.query(stmt);
      } catch (err) {
        // 表已存在等已知错误可以容忍
        const msg = (err as Error).message ?? "";
        if (/already exists/i.test(msg)) continue;
        // 重抛以便排查
        throw err;
      }
    }
  }
}

export async function setupIntegration(): Promise<IntegrationContext> {
  const skip = process.env[SKIP_FLAG] !== "1";
  if (skip) {
    return { skip: true };
  }
  const url = process.env.YISHAN_TEST_MYSQL_URL;
  if (!url) {
    throw new Error(
      "YISHAN_TEST_MYSQL_URL is not set. Set it to a MySQL connection string for integration tests.",
    );
  }
  const pool = mysql.createPool({
    uri: url,
    connectionLimit: 4,
    waitForConnections: true,
    queueLimit: 0,
    multipleStatements: true,
    charset: "utf8mb4",
  });

  // 取消全局 mock，避免与 test/setup.ts 注入的 fake drizzle 冲突。
  // 注意：test/setup.ts 的 mock 只覆盖那些走 @/db 的模块；这里我们直接构造真实
  // drizzle client 并替换全局模块缓存，使后续 import @/db 拿到测试库。
  vi.doUnmock("@/db");
  vi.doUnmock("@/db/index.js");
  vi.doUnmock("@/db/manager.js");
  vi.doUnmock("@/db/client.js");
  vi.resetModules();

  const testDb = drizzle(pool);
  const schemaModule = await import("@/db/schema");
  vi.doMock("@/db", () => ({
    drizzleDb: testDb,
    pool,
    schema: schemaModule,
    dbManager: { transaction: (fn: any) => testDb.transaction(fn) },
  }));
  vi.doMock("@/db/index.js", () => ({
    drizzleDb: testDb,
    pool,
    schema: schemaModule,
    dbManager: { transaction: (fn: any) => testDb.transaction(fn) },
  }));
  vi.doMock("@/db/client.js", () => ({
    drizzleDb: testDb,
    pool,
  }));
  vi.doMock("@/db/manager.js", () => ({
    dbManager: { transaction: (fn: any) => testDb.transaction(fn) },
  }));

  // 跑迁移
  await pool.query("SET FOREIGN_KEY_CHECKS = 0");
  await runMigrations(pool);
  await pool.query("SET FOREIGN_KEY_CHECKS = 1");

  return {
    skip: false,
    pool,
    async resetSchema() {
      await pool.query("SET FOREIGN_KEY_CHECKS = 0");
      const tables = ["sys_role_menu", "sys_user_role", "sys_user_dept", "sys_role", "sys_user_token", "sys_login_log", "sys_user_token", "sys_api_token", "sys_menu", "sys_user", "sys_dict_data", "sys_dict_type", "sys_attachment", "sys_attachment_folder", "sys_option"];
      // Drop only the app tables; do not blow away the schema itself.
      // This is best-effort; integration tests should only be run in dev.
      for (const t of tables) {
        await pool.query(`DROP TABLE IF EXISTS \`${t}\``).catch(() => undefined);
      }
      await pool.query("SET FOREIGN_KEY_CHECKS = 1");
      await runMigrations(pool);
    },
    async closeDb() {
      await pool.end();
    },
  };
}