import { and, count, desc, eq, type SQL } from 'drizzle-orm'
import { drizzleDb, type AppQueryDb } from '@/db'
import { sysUser } from '@/db/schema'
import { crmActivity } from '../db/schema.js'

/**
 * crm_activity Repository。
 *
 * 整个 CRM 模块内**唯一**允许访问 crmActivity 表的层。
 */

export interface ActivityRow {
  id: number
  customerId: number
  contactId: number | null
  type: string
  content: string
  occurredAt: Date
  nextFollowUpAt: Date | null
  operatorUserId: number
  createdAt: Date
  updatedAt: Date
}

export interface ActivityRowWithOperator extends ActivityRow {
  operatorUserName: string | null
}

export interface CreateActivityInput {
  customerId: number
  contactId?: number | null
  type: string
  content: string
  occurredAt?: Date
  nextFollowUpAt?: Date | null
  operatorUserId: number
}

export interface ActivityListQuery {
  customerId?: number
  operatorUserId?: number
  limit?: number
}

const activityPublicColumns = {
  id: crmActivity.id,
  customerId: crmActivity.customerId,
  contactId: crmActivity.contactId,
  type: crmActivity.type,
  content: crmActivity.content,
  occurredAt: crmActivity.occurredAt,
  nextFollowUpAt: crmActivity.nextFollowUpAt,
  operatorUserId: crmActivity.operatorUserId,
  createdAt: crmActivity.createdAt,
  updatedAt: crmActivity.updatedAt,
}

export class ActivityRepository {
  static async listByCustomerId(
    customerId: number,
    opts: { limit?: number } = {},
    db: AppQueryDb = drizzleDb,
  ): Promise<ActivityRowWithOperator[]> {
    const limit = opts.limit ?? 50
    const rows = await db
      .select({
        ...activityPublicColumns,
        operatorUserName: sysUser.username,
      })
      .from(crmActivity)
      .leftJoin(sysUser, eq(sysUser.id, crmActivity.operatorUserId))
      .where(eq(crmActivity.customerId, customerId))
      .orderBy(desc(crmActivity.occurredAt))
      .limit(limit)
    return rows as ActivityRowWithOperator[]
  }

  static async list(
    query: ActivityListQuery,
    db: AppQueryDb = drizzleDb,
  ): Promise<{ rows: ActivityRowWithOperator[]; total: number }> {
    const conds: SQL[] = []
    if (query.customerId !== undefined) conds.push(eq(crmActivity.customerId, query.customerId))
    if (query.operatorUserId !== undefined)
      conds.push(eq(crmActivity.operatorUserId, query.operatorUserId))
    const where = conds.length > 0 ? and(...conds) : undefined
    const limit = query.limit ?? 50

    const [rows, totalRow] = await Promise.all([
      db
        .select({
          ...activityPublicColumns,
          operatorUserName: sysUser.username,
        })
        .from(crmActivity)
        .leftJoin(sysUser, eq(sysUser.id, crmActivity.operatorUserId))
        .where(where)
        .orderBy(desc(crmActivity.occurredAt))
        .limit(limit),
      db.select({ c: count() }).from(crmActivity).where(where),
    ])

    return { rows: rows as ActivityRowWithOperator[], total: Number(totalRow[0]?.c ?? 0) }
  }

  static async create(
    input: CreateActivityInput,
    db: AppQueryDb = drizzleDb,
  ): Promise<ActivityRow> {
    const [inserted] = await db
      .insert(crmActivity)
      .values({
        customerId: input.customerId,
        contactId: input.contactId ?? null,
        type: input.type,
        content: input.content,
        occurredAt: input.occurredAt ?? new Date(),
        nextFollowUpAt: input.nextFollowUpAt ?? null,
        operatorUserId: input.operatorUserId,
      })
      .$returningId()
    const [row] = await db
      .select(activityPublicColumns)
      .from(crmActivity)
      .where(eq(crmActivity.id, inserted.id))
      .limit(1)
    if (!row) throw new Error('Failed to read back created crm activity')
    return row as ActivityRow
  }
}
