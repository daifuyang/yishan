/**
 * 集成测试共享装置（Section 5）。
 *
 * 行为约定：
 *   - 如果 YISHAN_RUN_INTEGRATION != '1'，则 setupIntegration() 返回 { skip: true }，
 *     测试应当 `test.skip()` 跳过。
 *   - 否则根据 YISHAN_TEST_MYSQL_URL（只用于定位一个专用的临时 MySQL 实例）为**每个测试文件**
 *     新建一个随机命名的数据库（`<url 中的库名>_<随机后缀>`），按仓库记录的迁移历史建表
 *     （见 _migrations.ts），并在 closeDb() 时只删除这个由本装置创建的数据库。
 *     各文件互不共享数据库，vitest 并行执行时不会互相竞争。
 *   - 构造独立 drizzle client，并通过 vi.doMock 替换全局 @/db 模块，
 *     确保 PermissionService 等通过 @/db 导入 drizzleDb 的代码也走测试库。
 *
 * DB 隔离原理：
 *   test/setup.ts 在所有测试启动时把 @/db 替换为 mock；
 *   这里用 vi.unmock + vi.resetModules 取消全局 mock，再通过
 *   vi.doMock('@/db', () => ({ drizzleDb: testDb, pool: testPool, schema, dbManager }))
 *   注入真实连接；之后通过 vi.resetModules + 动态 import 重新加载 PermissionService
 *   与相关仓库，使它们拿到 testDb。
 */

import { randomBytes } from "node:crypto";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { vi } from "vitest";
import { applyMigrations, CORE_MIGRATIONS, resolveMigrationPlan } from "./_migrations";

export interface IntegrationContext {
  skip: boolean;
  pool?: mysql.Pool;
  /** Name of the database created for this test file. */
  database?: string;
  /** Connection URL of that database. */
  databaseUrl?: string;
  /** Drop and recreate this file's database, then re-apply the recorded core migrations. */
  resetSchema?: () => Promise<void>;
  closeDb?: () => Promise<void>;
}

const SKIP_FLAG = "YISHAN_RUN_INTEGRATION";

export interface TempDatabase {
  name: string;
  url: string;
  pool: mysql.Pool;
  recreate: () => Promise<void>;
  drop: () => Promise<void>;
}

/** 在 YISHAN_TEST_MYSQL_URL 指向的实例上新建一个随机命名的空库。 */
export async function createTempDatabase(): Promise<TempDatabase> {
  const raw = process.env.YISHAN_TEST_MYSQL_URL;
  if (!raw) {
    throw new Error("YISHAN_TEST_MYSQL_URL is not set. Point it at a disposable MySQL instance for integration tests.");
  }
  const base = new URL(raw);
  const prefix = (base.pathname.replace(/^\//, "") || "yishan_it").replace(/[^A-Za-z0-9_]/g, "_");
  const name = `${prefix}_${randomBytes(4).toString("hex")}`;
  const serverUrl = new URL(raw);
  serverUrl.pathname = "/";
  const admin = () => mysql.createConnection({ uri: serverUrl.toString() });
  const exec = async (sql: string) => {
    const conn = await admin();
    try {
      await conn.query(sql);
    } finally {
      await conn.end();
    }
  };
  await exec(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  const dbUrl = new URL(raw);
  dbUrl.pathname = `/${name}`;
  const pool = mysql.createPool({
    uri: dbUrl.toString(),
    connectionLimit: 4,
    waitForConnections: true,
    queueLimit: 0,
    charset: "utf8mb4",
  });
  return {
    name,
    url: dbUrl.toString(),
    pool,
    // 只清空本装置创建的库内的表；保留库本身，避免已建立的连接池失去默认 schema。
    async recreate() {
      const conn = await pool.getConnection();
      try {
        const [rows] = await conn.query("SELECT table_name AS t FROM information_schema.tables WHERE table_schema = DATABASE()");
        await conn.query("SET FOREIGN_KEY_CHECKS = 0");
        for (const { t } of rows as { t: string }[]) await conn.query(`DROP TABLE \`${t}\``);
        await conn.query("SET FOREIGN_KEY_CHECKS = 1");
      } finally {
        conn.release();
      }
    },
    async drop() {
      await pool.end();
      await exec(`DROP DATABASE IF EXISTS \`${name}\``);
    },
  };
}

export async function setupIntegration(): Promise<IntegrationContext> {
  const skip = process.env[SKIP_FLAG] !== "1";
  if (skip) {
    return { skip: true };
  }
  const temp = await createTempDatabase();
  const { pool } = temp;
  const plan = resolveMigrationPlan(CORE_MIGRATIONS);

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

  await applyMigrations(pool, plan);

  return {
    skip: false,
    pool,
    database: temp.name,
    databaseUrl: temp.url,
    async resetSchema() {
      await temp.recreate();
      await applyMigrations(pool, plan);
    },
    async closeDb() {
      await temp.drop();
    },
  };
}
