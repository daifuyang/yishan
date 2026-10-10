import { and, count, desc, eq, gte, isNull, lte, type SQL } from 'drizzle-orm'
import { drizzleDb, type AppQueryDb } from '@yishan/core-system-api/database'
import { userDirectory } from '@yishan/core-system-api'
import { crmActivity, crmCustomer } from '../db/schema.js'
import { getCustomerStatusLabel } from '../domain/statuses.js'

/**
 * dashboard Repository。
 *
 * 只负责按条件 count() 与"待跟进"客户列表 / 最近动态查询。
 * 业务语义由 dashboard.service 负责拼装。
 */

export interface DashboardCounters {
  myCustomers: number
  pendingFollowUp: number
  overdueFollowUp: number
  todayNew: number
  publicPool: number
  weekFollowUps: number
  monthNew: number
}

export class DashboardRepository {
  static async countActivitiesSince(since: Date, db: AppQueryDb = drizzleDb): Promise<number> {
    const [row] = await db.select({ c: count() }).from(crmActivity).where(gte(crmActivity.occurredAt, since))
    return Number(row?.c ?? 0)
  }
  static async countWhere(conds: SQL[], db: AppQueryDb = drizzleDb): Promise<number> {
    const all = [...conds, isNull(crmCustomer.deletedAt)]
    const [row] = await db.select({ c: count() }).from(crmCustomer).where(and(...all))
    return Number(row?.c ?? 0)
  }

  static async findPendingFollowUps(
    userId: number,
    limit = 10,
    db: AppQueryDb = drizzleDb,
  ): Promise<
    Array<{
      id: number
      name: string
      ownerUserName: string | null
      nextFollowUpAt: Date | null
      statusName: string | null
    }>
  > {
    const rows = await db
      .select({
        id: crmCustomer.id,
        name: crmCustomer.name,
        ownerUserId: crmCustomer.ownerUserId,
        nextFollowUpAt: crmCustomer.nextFollowUpAt,
        statusCode: crmCustomer.statusCode,
      })
      .from(crmCustomer)
      .where(
        and(
          eq(crmCustomer.ownerUserId, userId),
          isNull(crmCustomer.deletedAt),
        ),
      )
      .orderBy(crmCustomer.nextFollowUpAt)
      .limit(limit)
    const users = await userDirectory.findByIds(rows.map((row) => row.ownerUserId).filter((id): id is number => id !== null), { includeDeleted: true })
    return rows.map(({ ownerUserId, ...row }) => ({
      ...row,
      ownerUserName: ownerUserId === null ? null : users.get(ownerUserId)?.username ?? null,
      statusName: getCustomerStatusLabel(row.statusCode),
    }))
  }

  static async findRecentActivities(
    limit = 10,
    db: AppQueryDb = drizzleDb,
  ): Promise<
    Array<{
      id: number
      type: string
      operatorUserName: string | null
      customerId: number
      customerName: string
      occurredAt: Date
      summary: string
    }>
  > {
    const rows = await db
      .select({
        id: crmActivity.id,
        type: crmActivity.type,
        customerId: crmCustomer.id,
        customerName: crmCustomer.name,
        occurredAt: crmActivity.occurredAt,
        content: crmActivity.content,
        operatorUserId: crmActivity.operatorUserId,
      })
      .from(crmActivity)
      .innerJoin(crmCustomer, eq(crmCustomer.id, crmActivity.customerId))
      .orderBy(desc(crmActivity.occurredAt))
      .limit(limit)
    const users = await userDirectory.findByIds(rows.map((row) => row.operatorUserId), { includeDeleted: true })
    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      operatorUserName: users.get(r.operatorUserId)?.username ?? null,
      customerId: r.customerId,
      customerName: r.customerName,
      occurredAt: r.occurredAt,
      summary: r.content.slice(0, 60),
    }))
  }

  static async findMyActivities(
    userId: number,
    limit = 10,
    db: AppQueryDb = drizzleDb,
  ): Promise<
    Array<{
      id: number
      type: string
      operatorUserName: string | null
      customerId: number
      customerName: string
      occurredAt: Date
      summary: string
    }>
  > {
    const rows = await db
      .select({
        id: crmActivity.id,
        type: crmActivity.type,
        customerId: crmCustomer.id,
        customerName: crmCustomer.name,
        occurredAt: crmActivity.occurredAt,
        content: crmActivity.content,
        operatorUserId: crmActivity.operatorUserId,
      })
      .from(crmActivity)
      .innerJoin(crmCustomer, eq(crmCustomer.id, crmActivity.customerId))
      .where(eq(crmActivity.operatorUserId, userId))
      .orderBy(desc(crmActivity.occurredAt))
      .limit(limit)
    const users = await userDirectory.findByIds(rows.map((row) => row.operatorUserId), { includeDeleted: true })
    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      operatorUserName: users.get(r.operatorUserId)?.username ?? null,
      customerId: r.customerId,
      customerName: r.customerName,
      occurredAt: r.occurredAt,
      summary: r.content.slice(0, 60),
    }))
  }
}

void gte
void lte
