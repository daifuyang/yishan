import 'dotenv/config'
import { resolve } from 'node:path'
import { defineConfig } from 'drizzle-kit'

// This entry generates the System-owned schema only. Business owners have their own config.
const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is required for migration generation')
export default defineConfig({
  dialect: 'mysql',
  schema: resolve(__dirname, '../../../packages/core/system-api/src/db/schema/index.ts'),
  out: resolve(__dirname, '../../../packages/core/system-api/drizzle'),
  dbCredentials: { url },
})
