/**
 * Public entry point for the database layer.
 *
 * Consumers should import:
 *   - `drizzleDb` for the Drizzle client (query builder + relational API)
 *   - `pool` only when they need direct mysql2 access (rare; mostly scripts)
 *   - `schema` only when they need to enumerate all tables/relations
 *   - `dbManager` for connection lifecycle, health checks, transactions
 *   - Individual table/relation objects from `@/db/schema` for typed queries
 *
 * The legacy Prisma-shaped proxy (`db.sysUser.findMany(...)`) is gone — use
 * `drizzleDb.select().from(sysUser).where(...)` or
 * `drizzleDb.query.sysUser.findMany({ with: {...}, where: {...} })`.
 */
export { drizzleDb, pool, schema } from './client.js'
export type { AppDb, AppTx, AppQueryDb } from './client.js'
export { dbManager, default as defaultDbManager } from './manager.js'
