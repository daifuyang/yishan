import 'dotenv/config'
import { defineConfig } from 'drizzle-kit'
const url = process.env.DATABASE_URL ?? `mysql://${process.env.DATABASE_USER ?? 'root'}:${process.env.DATABASE_PASSWORD ?? ''}@${process.env.DATABASE_HOST ?? 'localhost'}:${process.env.DATABASE_PORT ?? '3306'}/${process.env.DATABASE_NAME ?? 'yishan'}`
export default defineConfig({ dialect: 'mysql', schema: './db/schema.ts', out: './drizzle', dbCredentials: { url } })
