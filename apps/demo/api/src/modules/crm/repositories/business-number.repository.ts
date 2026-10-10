import { sql } from 'drizzle-orm'
import { drizzleDb, type AppQueryDb } from '@yishan/core-system-api/database'
import { crmBusinessNumber } from '../db/schema.js'

/**
 * Allocates the next sequence value for a business-number prefix.
 * The insert/update and the locked read must run in the caller's transaction.
 */
export class BusinessNumberRepository {
  static async next(prefix: string, db: AppQueryDb = drizzleDb): Promise<number> {
    await db.insert(crmBusinessNumber).values({ prefix, nextValue: 2 }).onDuplicateKeyUpdate({
      set: { nextValue: sql`${crmBusinessNumber.nextValue} + 1` },
    })
    const result = await db.execute(sql`SELECT next_value FROM ${crmBusinessNumber} WHERE prefix = ${prefix} FOR UPDATE`)
    const row = (result as unknown as Array<Record<string, unknown>>)[0]
    const nextValue = Number(row?.next_value ?? row?.nextValue)
    if (!Number.isInteger(nextValue) || nextValue < 2) throw new Error(`Invalid business number counter for ${prefix}`)
    return nextValue - 1
  }
}
