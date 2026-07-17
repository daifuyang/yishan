import 'dotenv/config'
import { drizzle } from 'drizzle-orm/mysql2'
import { createPool, type Pool } from 'mysql2/promise'
import { schema } from './schema/index.js'

/**
 * Build a MySQL connection URL from the available env vars. Returns undefined
 * if neither DATABASE_URL nor DATABASE_HOST is configured (caller decides).
 */
function buildDatabaseUrl(): string | undefined {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  if (!process.env.DATABASE_HOST) return undefined
  const user = process.env.DATABASE_USER ?? 'root'
  const password = process.env.DATABASE_PASSWORD ?? ''
  const host = process.env.DATABASE_HOST
  const port = process.env.DATABASE_PORT ?? '3306'
  const database = process.env.DATABASE_NAME ?? ''
  return `mysql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`
}

/**
 * Shared mysql2 connection pool. The Drizzle client and the DbManager both
 * reference this single pool so that connection lifecycle is centralized.
 */
export const pool: Pool = (() => {
  const url = buildDatabaseUrl()
  if (url) return createPool(url)
  return createPool({
    host: process.env.DATABASE_HOST,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    port: process.env.DATABASE_PORT ? Number(process.env.DATABASE_PORT) : 3306,
    waitForConnections: true,
    connectionLimit: 5,
  })
})()

/**
 * The application-wide Drizzle client. Pass `{ schema }` so the relational
 * query API (`drizzleDb.query.X.findMany`) and the query builder can both
 * resolve table/relation references by name.
 */
export const drizzleDb = drizzle(pool, { schema, mode: 'default' })

export type AppDb = typeof drizzleDb
export type AppTx = Parameters<Parameters<AppDb['transaction']>[0]>[0]
export type AppQueryDb = AppDb | AppTx

export { schema }
