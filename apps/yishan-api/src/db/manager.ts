import { sql } from 'drizzle-orm'
import { drizzleDb, pool } from './client.js'

type TransactionClient = Parameters<typeof drizzleDb.transaction>[0] extends (
  tx: infer Client,
  ...args: never[]
) => unknown
  ? Client
  : never

/**
 * Lifecycle and health-check wrapper around the Drizzle client.
 *
 * The singleton is intentionally minimal: callers either invoke methods on
 * this object (health check, transaction) or use the exported `drizzleDb`
 * from `@/db` directly for query building.
 */
class DbManager {
  private isConnected = false
  private readonly startedAt = Date.now()

  /**
   * Eagerly acquire a connection to verify the pool is alive. Subsequent
   * calls to `drizzleDb` are still lazy — this is purely a liveness probe.
   */
  async connect(): Promise<void> {
    const conn = await pool.getConnection()
    conn.release()
    this.isConnected = true
  }

  async disconnect(): Promise<void> {
    if ('end' in pool) await pool.end()
    this.isConnected = false
  }

  async healthCheck(): Promise<boolean> {
    try {
      await drizzleDb.execute(sql`SELECT 1`)
      return true
    } catch (error) {
      console.error('Database health check failed:', error)
      return false
    }
  }

  getConnectionStatus(): { connected: boolean; stats: { queryCount: number; uptime: number } } {
    return {
      connected: this.isConnected,
      stats: { queryCount: 0, uptime: Date.now() - this.startedAt },
    }
  }

  /**
   * Run `fn` inside a Drizzle transaction. The callback receives the
   * transaction-bound Drizzle client (a transactional view over the same
   * schema). Both the query builder and the relational query API work.
   */
  async transaction<T>(fn: (tx: TransactionClient) => Promise<T>): Promise<T> {
    return drizzleDb.transaction(fn)
  }
}

export const dbManager = new DbManager()
export default dbManager
