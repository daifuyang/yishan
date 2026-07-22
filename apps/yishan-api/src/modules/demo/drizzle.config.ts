import 'dotenv/config'
import { defineConfig } from 'drizzle-kit'

/**
 * demo 模块专属的 drizzle-kit 配置。
 *
 * 每个 module 自带一份该文件，指向自己目录下的 db/schema.ts 与 drizzle/ 输出。
 *
 * 跑迁移（手工）：
 *   npx drizzle-kit --config=apps/yishan-api/src/modules/demo/drizzle.config.ts generate
 *   npx drizzle-kit --config=apps/yishan-api/src/modules/demo/drizzle.config.ts migrate
 *
 * 程序从不自动调用这些命令。模块的 module.ts 也不会执行 SQL 迁移。
 */
const url =
  process.env.DATABASE_URL ??
  `mysql://${process.env.DATABASE_USER ?? 'root'}:${process.env.DATABASE_PASSWORD ?? ''}@${
    process.env.DATABASE_HOST ?? 'localhost'
  }:${process.env.DATABASE_PORT ?? '3306'}/${process.env.DATABASE_NAME ?? 'yishan'}`

export default defineConfig({
  dialect: 'mysql',
  schema: './db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url,
  },
})
