import { and, count, desc, eq, gte, isNull, lte, type SQL } from 'drizzle-orm'
import { drizzleDb, type AppQueryDb } from '@/db'
import { sysUser } from '@/db/schema'
import { crmActivity, crmCustomer, crmCustomerStatus } from '../db/schema.js'

/**
 * dashboard Repository。
 *
 * 只负责按条件 count() 与"待跟进"客户列表 / 最近动态查询。
 * 业务语义由 dashboard.service 负责拼装。
 */

export interface DashboardCounters {
  myCustomers: number
  pendingFollowUp: number
  todayNew: number
  publicPool: number
  weekFollowUps: number
  monthNew: number
}

export class DashboardRepository {
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
    const owner = sysUser
    const status = crmCustomerStatus
    const rows = await db
      .select({
        id: crmCustomer.id,
        name: crmCustomer.name,
        ownerUserName: owner.username,
        nextFollowUpAt: crmCustomer.nextFollowUpAt,
        statusName: status.name,
      })
      .from(crmCustomer)
      .leftJoin(owner, eq(owner.id, crmCustomer.ownerUserId))
      .leftJoin(status, eq(status.id, crmCustomer.statusId))
      .where(
        and(
          eq(crmCustomer.ownerUserId, userId),
          isNull(crmCustomer.deletedAt),
        ),
      )
      .orderBy(crmCustomer.nextFollowUpAt)
      .limit(limit)
    return rows
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
    const operator = sysUser
    const rows = await db
      .select({
        id: crmActivity.id,
        type: crmActivity.type,
        customerId: crmActivity.customerId,
        customerName: crmCustomer.name,
        occurredAt: crmActivity.occurredAt,
        content: crmActivity.content,
        operatorUserName: operator.username,
      })
      .from(crmActivity)
      .innerJoin(crmCustomer, eq(crmCustomer.id, crmActivity.customerId))
      .leftJoin(operator, eq(operator.id, crmActivity.operatorUserId))
      .orderBy(desc(crmActivity.occurredAt))
      .limit(limit)
    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      operatorUserName: r.operatorUserName,
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
    const operator = sysUser
    const rows = await db
      .select({
        id: crmActivity.id,
        type: crmActivity.type,
        customerId: crmActivity.customerId,
        customerName: crmCustomer.name,
        occurredAt: crmActivity.occurredAt,
        content: crmActivity.content,
        operatorUserName: operator.username,
      })
      .from(crmActivity)
      .innerJoin(crmCustomer, eq(crmCustomer.id, crmActivity.customerId))
      .leftJoin(operator, eq(operator.id, crmActivity.operatorUserId))
      .where(eq(crmActivity.operatorUserId, userId))
      .orderBy(desc(crmActivity.occurredAt))
      .limit(limit)
    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      operatorUserName: r.operatorUserName,
      customerId: r.customerId,
      customerName: r.customerName,
      occurredAt: r.occurredAt,
      summary: r.content.slice(0, 60),
    }))
  }
}

void gte
void lte

