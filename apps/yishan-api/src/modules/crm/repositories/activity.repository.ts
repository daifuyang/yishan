import { and, count, desc, eq, isNotNull, isNull, type SQL } from 'drizzle-orm'
import { drizzleDb, type AppQueryDb } from '@/db'
import { sysUser } from '@/db/schema'
import { crmActivity } from '../db/schema.js'

/**
 * crm_activity Repository。
 *
 * 整个 CRM 模块内**唯一**允许访问 crmActivity 表的层。
 * 跟进记录走软删（deleted_at），所有读路径都必须带 `deleted_at IS NULL`。
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

export interface UpdateActivityInput {
  contactId?: number | null
  type?: string
  content?: string
  occurredAt?: Date
  nextFollowUpAt?: Date | null
}

export interface ActivityListQuery {
  customerId?: number
  operatorUserId?: number
  limit?: number
}

/** 客户跟进时间的重算结果，见 ActivityRepository.computeFollowUpState。 */
export interface CustomerFollowUpState {
  lastFollowUpAt: Date | null
  nextFollowUpAt: Date | null
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
      .where(and(eq(crmActivity.customerId, customerId), isNull(crmActivity.deletedAt)))
      .orderBy(desc(crmActivity.occurredAt), desc(crmActivity.id))
      .limit(limit)
    return rows as ActivityRowWithOperator[]
  }

  static async list(
    query: ActivityListQuery,
    db: AppQueryDb = drizzleDb,
  ): Promise<{ rows: ActivityRowWithOperator[]; total: number }> {
    const conds: SQL[] = [isNull(crmActivity.deletedAt)]
    if (query.customerId !== undefined) conds.push(eq(crmActivity.customerId, query.customerId))
    if (query.operatorUserId !== undefined)
      conds.push(eq(crmActivity.operatorUserId, query.operatorUserId))
    const where = and(...conds)
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
        .orderBy(desc(crmActivity.occurredAt), desc(crmActivity.id))
        .limit(limit),
      db.select({ c: count() }).from(crmActivity).where(where),
    ])

    return { rows: rows as ActivityRowWithOperator[], total: Number(totalRow[0]?.c ?? 0) }
  }

  static async findById(id: number, db: AppQueryDb = drizzleDb): Promise<ActivityRow | null> {
    const [row] = await db
      .select(activityPublicColumns)
      .from(crmActivity)
      .where(and(eq(crmActivity.id, id), isNull(crmActivity.deletedAt)))
      .limit(1)
    return (row as ActivityRow | undefined) ?? null
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
    const row = await ActivityRepository.findById(inserted.id, db)
    if (!row) throw new Error('Failed to read back created crm activity')
    return row
  }

  static async update(
    id: number,
    input: UpdateActivityInput,
    db: AppQueryDb = drizzleDb,
  ): Promise<ActivityRow | null> {
    const patch: Record<string, unknown> = { updatedAt: new Date() }
    if (input.contactId !== undefined) patch.contactId = input.contactId
    if (input.type !== undefined) patch.type = input.type
    if (input.content !== undefined) patch.content = input.content
    if (input.occurredAt !== undefined) patch.occurredAt = input.occurredAt
    if (input.nextFollowUpAt !== undefined) patch.nextFollowUpAt = input.nextFollowUpAt

    await db
      .update(crmActivity)
      .set(patch)
      .where(and(eq(crmActivity.id, id), isNull(crmActivity.deletedAt)))
    return ActivityRepository.findById(id, db)
  }

  static async softDelete(id: number, db: AppQueryDb = drizzleDb): Promise<void> {
    await db
      .update(crmActivity)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(crmActivity.id, id))
  }

  /**
   * 从**现存**跟进记录重算客户的跟进时间。
   *
   * 这是 create / update / delete 三条路径共用的唯一真相，因此不能假设
   * "最后一次操作的记录就是最新跟进"（见 README §7.3）：
   *
   *   - lastFollowUpAt = 所有未删除跟进里最大的 occurred_at。
   *     补录一条上周的跟进不会把"最近跟进"倒退回上周；删掉最新那条会正确回落到次新那条。
   *   - nextFollowUpAt = 按 occurred_at 倒序，**第一条填了下次跟进时间**的记录的值。
   *     所以"写一条没填下次跟进的跟进"不会清掉既有计划，而"补录一条旧跟进"也不会
   *     覆盖掉更近一次跟进定下的计划。都没填则为 null。
   */
  static async computeFollowUpState(
    customerId: number,
    db: AppQueryDb = drizzleDb,
  ): Promise<CustomerFollowUpState> {
    const base = and(eq(crmActivity.customerId, customerId), isNull(crmActivity.deletedAt))

    const [latest, latestWithNext] = await Promise.all([
      db
        .select({ occurredAt: crmActivity.occurredAt })
        .from(crmActivity)
        .where(base)
        .orderBy(desc(crmActivity.occurredAt), desc(crmActivity.id))
        .limit(1),
      db
        .select({ nextFollowUpAt: crmActivity.nextFollowUpAt })
        .from(crmActivity)
        .where(and(base, isNotNull(crmActivity.nextFollowUpAt)))
        .orderBy(desc(crmActivity.occurredAt), desc(crmActivity.id))
        .limit(1),
    ])

    return {
      lastFollowUpAt: latest[0]?.occurredAt ?? null,
      nextFollowUpAt: latestWithNext[0]?.nextFollowUpAt ?? null,
    }
  }
}
