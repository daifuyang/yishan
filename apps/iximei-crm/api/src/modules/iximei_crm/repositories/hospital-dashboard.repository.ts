/**
 * 医院后台数据看板 repository。
 *
 * 三条核心 SQL：
 * 1. getStats(hospitalIds, startDate?, endDate?)
 *    — 单条 SELECT 聚合 4 个时间桶 + 2 个查看指标；hospitalIds 是数组：
 *      [单一医院] = 单院；[全院 ids] = 全院汇总（避免 N+1）。
 * 2. getUnviewedCount(hospitalIds) — 同上结构。
 * 3. getTrend(hospitalIds, days, startDate?, endDate?)
 *    — 日期分布 + viewed/unviewed 总览。
 *
 * 时间桶按 Asia/Shanghai 时区划分：
 * - todayStart: 当日 00:00
 * - monthStart: 当月 1 日 00:00
 * - yearStart:  当年 1 月 1 日 00:00
 * - (可选) startDate/endDate: 用户筛选窗口，闭区间 [startDate 0:00, endDate+1 0:00)
 *
 * 注 2：hospitalIds 入参由 service 层负责校验（hospitalAccount 越权检查）。
 */

import { and, count, desc, eq, gte, isNull, lt, sql } from 'drizzle-orm'
import { drizzleDb } from '@yishan/core-system-api/database'
import { dateUtils } from '@/modules/iximei_crm/utils/date'
import {
  crmCustomer,
  crmDispatch,
  crmDispatchStatus,
  crmDispatchViewLog,
  crmHospital,
} from '../db/schema.js'

const active = (t: any) => isNull(t.deletedAt)

// 视为「已完成 / 已处理」的派单状态 name 集合。
// 当前 crm_dispatch_status 种子里的 6 个状态（待回复 / 已联系 / 已到院 / 已成交 / 未成交 / 重单）
// 都不匹配下面的 name，因此本过滤在现有种子下是 no-op；后续若运维调整状态字典、加入
// 「已完成」类状态，未查看派单数会自动排除这些状态。
const COMPLETED_STATUS_NAMES = new Set(['已完成', '已处理', '完成', '已完结'])

let completedStatusIdsCache: number[] | null = null
let completedStatusIdsCacheAt = 0
const COMPLETED_STATUS_CACHE_TTL_MS = 60_000

/** 查 crm_dispatch_status 中视为「已完成 / 已处理」的 status id 列表，带 60s 缓存。 */
async function getCompletedStatusIds(): Promise<number[]> {
  const now = Date.now()
  if (completedStatusIdsCache && now - completedStatusIdsCacheAt < COMPLETED_STATUS_CACHE_TTL_MS) {
    return completedStatusIdsCache
  }
  const rows = await drizzleDb
    .select({ id: crmDispatchStatus.id, name: crmDispatchStatus.name })
    .from(crmDispatchStatus)
  const ids = rows
    .filter((r) => COMPLETED_STATUS_NAMES.has(String(r.name)))
    .map((r) => Number(r.id))
  completedStatusIdsCache = ids
  completedStatusIdsCacheAt = now
  return ids
}

/** 若有已完成 status id，构造 `crm_dispatch.status_id NOT IN (...)` SQL 片段；否则返回 undefined。 */
function notInCompletedStatusSql(completedIds: number[]) {
  if (completedIds.length === 0) return undefined
  return sql`${crmDispatch.statusId} NOT IN (${sql.join(
    completedIds.map((id) => sql`${id}`),
    sql`, `,
  )})`
}

function getTimeBucketStarts(now: Date = new Date()): { todayStart: Date; monthStart: Date; yearStart: Date } {
  return {
    todayStart: dateUtils.shanghaiDayStart(now),
    monthStart: dateUtils.shanghaiMonthStart(now),
    yearStart: dateUtils.shanghaiYearStart(now),
  }
}

/** YYYY-MM-DD → Asia/Shanghai 当天 00:00。非法字符串返回 null。 */
function parseDateOpt(s: unknown): Date | null {
  if (typeof s !== 'string' || !s.trim()) return null
  return dateUtils.parseShanghaiDate(s)
}

export class HospitalDashboardRepository {
  /**
   * 单条 SQL 聚合 4 个时间桶（today/month/year/total）+ 2 个查看指标（viewed/unviewed）。
   * 用 LEFT JOIN + SUM(CASE WHEN ...) 一次拿全，避免 N+1。
   *
   * viewed/unviewed 的语义：派单是否被**任一**医院账号首次访问过。
   * view_log 表 schema 在 repo 早期是按 hospital_id 分行（per-dispatch, per-hospital, per-user），
   * 所以要把 view_log 关联回原 dispatch 时 LEFT JOIN 用 dispatch_id 单条件；
   * 多个 hospitalId 的情况下，view_log 依然来自 VIEW 用户表，含义保持。
   *
   * startDate / endDate 是可选日期窗口，闭区间 [startDate 0:00, endDate+1 0:00)。
   */
  static async getStats(hospitalIds: number[], startDate?: string, endDate?: string) {
    if (hospitalIds.length === 0) {
      return {
        todayCount: 0,
        monthCount: 0,
        yearCount: 0,
        totalCount: 0,
        viewedCount: 0,
        unviewedCount: 0,
      }
    }
    const { todayStart, monthStart, yearStart } = getTimeBucketStarts()
    const sd = parseDateOpt(startDate)
    const ed = parseDateOpt(endDate)
    const completedIds = await getCompletedStatusIds()
    const notInCompleted = notInCompletedStatusSql(completedIds)

    const dateFilter =
      ed !== null
        ? and(gte(crmDispatch.createdAt, sd ?? todayStart), lt(crmDispatch.createdAt, dateUtils.shanghaiNextDayStart(ed)))
        : sd !== null
          ? gte(crmDispatch.createdAt, sd)
          : undefined

    // unviewedCount 的语义：派单未被查看 **且** 状态不属于"已完成/已处理"。
    // 当 COMPLETED_STATUS_NAMES 在当前状态字典里没有命中时（空数组），不附加 NOT IN，过滤等价于
    // 只看 `view_log.id IS NULL`；若未来状态字典加了"已完成"，会自动排除。
    const unviewedCase = completedIds.length > 0
      ? sql`SUM(CASE WHEN ${crmDispatchViewLog.id} IS NULL AND ${notInCompleted} THEN 1 ELSE 0 END)`
      : sql`SUM(CASE WHEN ${crmDispatchViewLog.id} IS NULL THEN 1 ELSE 0 END)`

    const [row] = await drizzleDb
      .select({
        todayCount: sql<number>`SUM(CASE WHEN ${crmDispatch.createdAt} >= ${todayStart} THEN 1 ELSE 0 END)`,
        monthCount: sql<number>`SUM(CASE WHEN ${crmDispatch.createdAt} >= ${monthStart} THEN 1 ELSE 0 END)`,
        yearCount: sql<number>`SUM(CASE WHEN ${crmDispatch.createdAt} >= ${yearStart} THEN 1 ELSE 0 END)`,
        totalCount: count(),
        viewedCount: sql<number>`SUM(CASE WHEN ${crmDispatchViewLog.id} IS NOT NULL THEN 1 ELSE 0 END)`,
        unviewedCount: unviewedCase,
      })
      .from(crmDispatch)
      .leftJoin(
        crmDispatchViewLog,
        eq(crmDispatchViewLog.dispatchId, crmDispatch.id),
      )
      .where(
        and(
          // 多医院: hospitalIds 是数组，Drizzle `in()` 走 SQL 'IN (?, ?, ?)'
          sql`${crmDispatch.hospitalId} IN (${sql.join(hospitalIds.map((h) => sql`${h}`), sql`, `)})`,
          active(crmDispatch),
          dateFilter,
        ),
      )

    return {
      todayCount: Number(row?.todayCount ?? 0),
      monthCount: Number(row?.monthCount ?? 0),
      yearCount: Number(row?.yearCount ?? 0),
      totalCount: Number(row?.totalCount ?? 0),
      viewedCount: Number(row?.viewedCount ?? 0),
      unviewedCount: Number(row?.unviewedCount ?? 0),
    }
  }

  /**
   * 该（些）医院未查看派单数。菜单 Badge 用，性能敏感 — 走单条 SQL。
   *
   * 用 LEFT JOIN crmDispatchViewLog + view_log.id IS NULL
   * 比 NOT EXISTS 更直观，Drizzle 也支持。
   */
  static async getUnviewedCount(hospitalIds: number[]) {
    if (hospitalIds.length === 0) return 0
    const completedIds = await getCompletedStatusIds()
    const notInCompleted = notInCompletedStatusSql(completedIds)
    const conditions: any[] = [
      sql`${crmDispatch.hospitalId} IN (${sql.join(hospitalIds.map((h) => sql`${h}`), sql`, `)})`,
      active(crmDispatch),
      sql`${crmDispatchViewLog.id} IS NULL`,
    ]
    if (notInCompleted) conditions.push(notInCompleted)
    const [row] = await drizzleDb
      .select({ count: count() })
      .from(crmDispatch)
      .leftJoin(
        crmDispatchViewLog,
        eq(crmDispatchViewLog.dispatchId, crmDispatch.id),
      )
      .where(and(...conditions))
    return Number(row?.count ?? 0)
  }

  /**
   * 近 days 天每天的派单量趋势 + 该（些）医院派单的 viewed/unviewed 总览。
   *
   * daily：按 DATE(createdAt) 分组聚合，缺失日补 0；
   * statusBreakdown：复用 getStats 的 LEFT JOIN view_log 模式，
   * 一次拿全 viewed/unviewed 计数，避免 N+1。
   *
   * startDate / endDate 优先级高于 days：当两个都给时忽略 days，用具体区间。
   */
  static async getTrend(
    hospitalIds: number[],
    days = 30,
    startDate?: string,
    endDate?: string,
  ): Promise<{
    daily: Array<{ date: string; count: number }>
    statusBreakdown: { viewed: number; unviewed: number }
  }> {
    if (hospitalIds.length === 0) {
      return {
        daily: [],
        statusBreakdown: { viewed: 0, unviewed: 0 },
      }
    }

    // 1) 生成日期序列（YYYY-MM-DD，Asia/Shanghai 日历日）
    const dates: string[] = []
    let periodStart: Date
    let periodEndExclusive: Date
    const fillDays = (start: Date, endExclusive: Date) => {
      for (let t = start.getTime(); t < endExclusive.getTime(); t += 86400000) {
        dates.push(dateUtils.formatShanghaiYmd(new Date(t)))
      }
    }
    if (startDate && endDate) {
      const sd = parseDateOpt(startDate)
      const ed = parseDateOpt(endDate)
      if (sd && ed && ed >= sd) {
        periodStart = sd
        periodEndExclusive = dateUtils.shanghaiNextDayStart(ed)
        fillDays(periodStart, periodEndExclusive)
      } else {
        const today = dateUtils.shanghaiDayStart()
        periodStart = new Date(today.getTime() - (days - 1) * 86400000)
        periodEndExclusive = dateUtils.shanghaiNextDayStart(today)
        fillDays(periodStart, periodEndExclusive)
      }
    } else {
      const today = dateUtils.shanghaiDayStart()
      periodStart = new Date(today.getTime() - (days - 1) * 86400000)
      periodEndExclusive = dateUtils.shanghaiNextDayStart(today)
      fillDays(periodStart, periodEndExclusive)
    }

    // 2) 一次 SQL 聚合：按 DATE(createdAt) 分组
    const rawDaily = await drizzleDb
      .select({
        date: sql<string>`DATE(${crmDispatch.createdAt})`,
        count: sql<number>`COUNT(*)`,
      })
      .from(crmDispatch)
      .where(
        and(
          sql`${crmDispatch.hospitalId} IN (${sql.join(hospitalIds.map((h) => sql`${h}`), sql`, `)})`,
          active(crmDispatch),
          gte(crmDispatch.createdAt, periodStart),
          lt(crmDispatch.createdAt, periodEndExclusive),
        ),
      )
      .groupBy(sql`DATE(${crmDispatch.createdAt})`)

    // 3) 缺失日补 0
    const dailyMap = new Map(rawDaily.map((r) => [String(r.date), Number(r.count)]))
    const daily = dates.map((d) => ({ date: d, count: dailyMap.get(d) ?? 0 }))

    // 4) statusBreakdown 复用 LEFT JOIN view_log 模式
    //    与 daily 保持同一日期窗口（periodStart..periodEndExclusive），
    //    否则日期筛选下饼图会显示全量而折线是窗口内，两者不一致。
    //
    // unviewed 同 getStats：派单未被查看 **且** 状态不属于"已完成/已处理"。
    const completedIds = await getCompletedStatusIds()
    const notInCompleted = notInCompletedStatusSql(completedIds)
    const unviewedCase = completedIds.length > 0
      ? sql`SUM(CASE WHEN ${crmDispatchViewLog.id} IS NULL AND ${notInCompleted} THEN 1 ELSE 0 END)`
      : sql`SUM(CASE WHEN ${crmDispatchViewLog.id} IS NULL THEN 1 ELSE 0 END)`

    const [row] = await drizzleDb
      .select({
        viewed: sql<number>`SUM(CASE WHEN ${crmDispatchViewLog.id} IS NOT NULL THEN 1 ELSE 0 END)`,
        unviewed: unviewedCase,
      })
      .from(crmDispatch)
      .leftJoin(
        crmDispatchViewLog,
        eq(crmDispatchViewLog.dispatchId, crmDispatch.id),
      )
      .where(
        and(
          sql`${crmDispatch.hospitalId} IN (${sql.join(hospitalIds.map((h) => sql`${h}`), sql`, `)})`,
          active(crmDispatch),
          gte(crmDispatch.createdAt, periodStart),
          lt(crmDispatch.createdAt, periodEndExclusive),
        ),
      )

    return {
      daily,
      statusBreakdown: {
        viewed: Number(row?.viewed ?? 0),
        unviewed: Number(row?.unviewed ?? 0),
      },
    }
  }

  /**
   * 「我最近查看的派单」列表 — 医院后台首页足迹卡片（任务 4）。
   *
   * 数据来源：crm_dispatch_view_log
   * - 过滤条件：viewer_user_id = 当前登录用户（hospital_account / super_admin 都按本人）
   * - 关联维度：派单所属医院 (hospitalIds) — hospital_account 限定本院、super_admin 限定全院
   * - 关联维度：派单客户名 (LEFT JOIN crm_customer)、派单所属医院名 (LEFT JOIN crm_hospital)
   *
   * 唯一索引 (dispatch_id, hospital_id, viewer_user_id) 保证每个用户对每个派单只有 1 条日志，
   * 所以无需再聚合取首次。这里直接用 view_log.created_at 作为"首次查看时间"。
   *
   * 返回结构：
   *   [{ dispatchId, customerName, hospitalName, firstViewedAt }]
   * 按 firstViewedAt DESC, LIMIT N。
   */
  static async getMyRecentViews(
    hospitalIds: number[],
    viewerUserId: number,
    limit: number,
  ): Promise<
    Array<{
      dispatchId: number
      customerName: string
      hospitalName: string
      firstViewedAt: Date
    }>
  > {
    if (hospitalIds.length === 0) return [];
    const rows = await drizzleDb
      .select({
        dispatchId: crmDispatch.id,
        customerName: crmCustomer.name,
        hospitalName: crmHospital.hospitalName,
        firstViewedAt: crmDispatchViewLog.createdAt,
      })
      .from(crmDispatchViewLog)
      .innerJoin(crmDispatch, eq(crmDispatch.id, crmDispatchViewLog.dispatchId))
      .leftJoin(crmCustomer, eq(crmCustomer.id, crmDispatch.customerId))
      .leftJoin(crmHospital, eq(crmHospital.id, crmDispatch.hospitalId))
      .where(
        and(
          eq(crmDispatchViewLog.viewerUserId, viewerUserId),
          sql`${crmDispatch.hospitalId} IN (${sql.join(
            hospitalIds.map((h) => sql`${h}`),
            sql`, `,
          )})`,
          active(crmDispatch),
        ),
      )
      .orderBy(desc(crmDispatchViewLog.createdAt))
      .limit(limit);
    return rows.map((r) => ({
      dispatchId: r.dispatchId,
      customerName: r.customerName ?? '-',
      hospitalName: r.hospitalName ?? '-',
      firstViewedAt: r.firstViewedAt,
    }));
  }
}