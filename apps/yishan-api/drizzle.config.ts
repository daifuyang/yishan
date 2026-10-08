import 'dotenv/config'
import { defineConfig } from 'drizzle-kit'
import { LOCAL_DEV_DATABASE_URL, resolveDatabaseUrl } from './src/db/database-url'
import { CORE_MIGRATIONS_TABLE } from './src/db/migrations-table'

/**
 * Core + System 的迁移流。历史表保持 drizzle 默认的 `__drizzle_migrations`（与已部署库兼容）；
 * 模块各自使用 `<id>_drizzle_migrations`，见 src/db/migrations-table.ts。
 */
export default defineConfig({
  dialect: 'mysql',
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  migrations: { table: CORE_MIGRATIONS_TABLE },
  dbCredentials: {
    url: resolveDatabaseUrl() ?? LOCAL_DEV_DATABASE_URL,
  },
})
