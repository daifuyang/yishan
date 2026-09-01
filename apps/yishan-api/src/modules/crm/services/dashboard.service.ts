import { eq, gte, sql } from 'drizzle-orm'
import type { AppQueryDb } from '@/db'
import type { DataScopeUser } from '../schemas/data-scope.js'
import { computeDataScope } from '../schemas/data-scope.js'
import { DashboardRepository, type DashboardCounters } from '../repositories/dashboard.repository.js'
import { crmActivity, crmCustomer } from '../db/schema.js'

/**
 * DashboardService —— 工作台业务编排。
 *
 * 第一版只暴露计数器 + 待跟进客户 + 最近动态，不做复杂 BI。
 */

export interface DashboardData {
  counters: DashboardCounters
  pendingFollowUps: Array<{
    id: number
    name: string
    ownerUserName: string | null
    nextFollowUpAt: Date | null
    statusName: string | null
  }>
  recentActivities: Array<{
    id: number
    type: string
    operatorUserName: string | null
    customerId: number
    customerName: string
    occurredAt: Date
    summary: string
  }>
}

export class DashboardService {
  constructor(private readonly deps: { db?: AppQueryDb } = {}) {}

  async get(currentUser: DataScopeUser): Promise<DashboardData> {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekStart = new Date(todayStart)
    weekStart.setDate(weekStart.getDate() - 7)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    const counters = await this.computeCounters(currentUser, todayStart, weekStart, monthStart)
    const [pending, activities] = await Promise.all([
      DashboardRepository.findPendingFollowUps(currentUser.id, 10, this.deps.db),
      DashboardRepository.findRecentActivities(15, this.deps.db),
    ])

    return {
      counters,
      pendingFollowUps: pending.map((p) => ({
        ...p,
        nextFollowUpAt: p.nextFollowUpAt,
      })),
      recentActivities: activities,
    }
  }

  private async computeCounters(
    user: DataScopeUser,
    todayStart: Date,
    weekStart: Date,
    monthStart: Date,
  ): Promise<DashboardCounters> {
    const scope = computeDataScope(user)
    const isSuper = scope.ownerUserIds === null
    void isSuper

    const [myCustomers, pendingFollowUp, todayNew, publicPool, weekFollowUps, monthNew] = await Promise.all([
      // 我的客户（owner_user_id = me 且 owned）
      DashboardRepository.countWhere(
        [eq(crmCustomer.poolStatus, 'owned'), eq(crmCustomer.ownerUserId, user.id)],
        this.deps.db,
      ),
      // 待跟进：owner = me 且 next_follow_up_at 非空
      DashboardRepository.countWhere(
        [eq(crmCustomer.ownerUserId, user.id), sql`${crmCustomer.nextFollowUpAt} IS NOT NULL`],
        this.deps.db,
      ),
      // 今日新增：created_at >= today
      DashboardRepository.countWhere([gte(crmCustomer.createdAt, todayStart)], this.deps.db),
      // 公海客户
      DashboardRepository.countWhere([eq(crmCustomer.poolStatus, 'public')], this.deps.db),
      // 本周跟进：activity in last 7 days
      this.countActivitiesSince(weekStart),
      // 本月新增
      DashboardRepository.countWhere([gte(crmCustomer.createdAt, monthStart)], this.deps.db),
    ])

    return {
      myCustomers,
      pendingFollowUp,
      todayNew,
      publicPool,
      weekFollowUps,
      monthNew,
    }
  }

  private async countActivitiesSince(since: Date): Promise<number> {
    const db = this.deps.db ?? (await import('@/db/index.js')).drizzleDb
    const [row] = await db
      .select({ c: sql<number>`count(*)` })
      .from(crmActivity)
      .where(gte(crmActivity.occurredAt, since))
    return Number(row?.c ?? 0)
  }
}
