import 'dotenv/config'
import { resolve } from 'node:path'
import { defineConfig } from 'drizzle-kit'

// 业务模块的表由模块自己拥有，这里只生成 iximei-crm 模块的 schema。
const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is required for migration generation')
export default defineConfig({
  dialect: 'mysql',
  schema: resolve(__dirname, 'src/modules/iximei_crm/db/schema.ts'),
  out: resolve(__dirname, 'src/modules/iximei_crm/drizzle'),
  dbCredentials: { url },
})
