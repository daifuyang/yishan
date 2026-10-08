import 'dotenv/config'
import { defineConfig } from 'drizzle-kit'
import { LOCAL_DEV_DATABASE_URL, resolveDatabaseUrl } from '../../db/database-url'
import { moduleMigrationsTable } from '../../db/migrations-table'

/**
 * demo 模块专属的 drizzle-kit 配置。
 *
 * 每个 module 自带一份该文件，指向自己目录下的 db/schema.ts 与 drizzle/ 输出，
 * 并使用独立的迁移历史表 `demo_drizzle_migrations`（不与 Core 或其他模块共享，见 P0 R-01）。
 *
 * 生成迁移（开发期）：
 *   cd src/modules/demo && npx drizzle-kit generate --config=./drizzle.config.ts
 * 执行迁移（推荐，含表结构校验与 sys_module_migration 记账）：
 *   pnpm --filter yishan-api db:migrate:modules demo
 *
 * 程序启动时从不自动执行迁移。
 */
export default defineConfig({
  dialect: 'mysql',
  schema: './db/schema.ts',
  out: './drizzle',
  migrations: { table: moduleMigrationsTable('demo') },
  dbCredentials: {
    url: resolveDatabaseUrl() ?? LOCAL_DEV_DATABASE_URL,
  },
})
