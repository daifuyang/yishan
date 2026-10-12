import { sql } from 'drizzle-orm'
import { drizzle, type MySql2Database } from 'drizzle-orm/mysql2'
import { createPool, type Pool, type PoolOptions } from 'mysql2/promise'

export interface DatabaseOptions<TSchema extends Record<string, unknown>> {
  connection: string | PoolOptions
  schema: TSchema
}

export interface ConnectionStatus {
  connected: boolean
  stats: { queryCount: number; uptime: number }
}

export interface Database<TSchema extends Record<string, unknown>> {
  pool: Pool
  db: MySql2Database<TSchema> & { $client: Pool }
  connect(): Promise<void>
  close(): Promise<void>
  healthCheck(): Promise<boolean>
  transaction: MySql2Database<TSchema>['transaction']
  getConnectionStatus(): ConnectionStatus
}

export function createDatabase<TSchema extends Record<string, unknown>>(
  options: DatabaseOptions<TSchema>,
): Database<TSchema> {
  const pool = typeof options.connection === 'string' ? createPool(options.connection) : createPool(options.connection)
  const db = drizzle(pool, { schema: options.schema, mode: 'default' })
  const startedAt = Date.now()
  let connected = false
  let closePromise: Promise<void> | undefined

  return {
    pool,
    db,
    async connect() {
      if (closePromise) throw new Error('Database is closed')
      const connection = await pool.getConnection()
      connection.release()
      if (closePromise) throw new Error('Database is closed')
      connected = true
    },
    close() {
      if (!closePromise) {
        connected = false
        closePromise = pool.end()
      }
      return closePromise
    },
    async healthCheck() {
      if (closePromise) return false
      try {
        await db.execute(sql`SELECT 1`)
        return true
      } catch {
        return false
      }
    },
    transaction: db.transaction.bind(db),
    getConnectionStatus() {
      return { connected, stats: { queryCount: 0, uptime: Date.now() - startedAt } }
    },
  }
}
