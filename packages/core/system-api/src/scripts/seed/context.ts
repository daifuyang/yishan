
import { drizzleDb } from '@/db';

/**
 * The common surface shared by the root Drizzle client and a transaction.
 * Seed modules receive this explicitly so the full bootstrap is atomic.
 */
export type SeedDb = typeof drizzleDb;
