import { and, count, desc, eq, gte, inArray, isNull, lt, sql } from 'drizzle-orm'
import { drizzleDb, type AppQueryDb } from '@yishan/core-system-api/database'
import { dateUtils } from '@/modules/iximei_crm/utils/date'
import {
  crmCustomer,
  crmDispatch,
  crmDispatchViewLog,
  crmHospital,
} from '../db/schema.js'

const active = (t: any) => isNull(t.deletedAt)

const monthStart = (date = new Date()) => dateUtils.shanghaiMonthStart(date)
const weekStart = (date = new Date()) => dateUtils.shanghaiWeekStart(date)
const dayStart = (date = new Date()) => dateUtils.shanghaiDayStart(date)
const exclusiveEnd = (date: Date) => dateUtils.shanghaiNextDayStart(date)

export interface DateRange {
  startDate: Date
  endDate: Date
}

type WhereExtra = (table: any) => any[]

export type HospitalOverviewCategory = 'oral' | 'plastic' | 'unknown'

export interface HospitalOverviewFilters {
  startDate?: Date
  endDate?: Date
  category?: HospitalOverviewCategory
  provinceCode?: number | 'missing'
  cityCode?: number | 'missing'
  hospitalScope?: 'period-new'
  status?: number
}

export interface HospitalOverviewDetailsQuery extends HospitalOverviewFilters {
  page: number
  pageSize: number
}

const overviewCategories: HospitalOverviewCategory[] = ['oral', 'plastic', 'unknown']

function overviewCategory(value: unknown): HospitalOverviewCategory {
  return value === 'oral' || value === 'plastic' ? value : 'unknown'
}

function endOfOverviewDate(endDate: Date) {
  return dateUtils.shanghaiNextDayStart(endDate)
}

function overviewCategoryExpression(categoryAvailable: boolean) {
  return categoryAvailable
    ? sql`CASE WHEN h.category IN ('oral', 'plastic') THEN h.category ELSE 'unknown' END`
    : sql`'unknown'`
}

function overviewWhere(
  filters: HospitalOverviewFilters,
  includeCreatedDate = false,
  categoryAvailable = true,
) {
  const conditions: any[] = [sql`h.deleted_at IS NULL`]
  if (filters.category) {
    conditions.push(sql`${overviewCategoryExpression(categoryAvailable)} = ${filters.category}`)
  }
  if (filters.provinceCode !== undefined) conditions.push(filters.provinceCode === 'missing' ? sql`h.province_id IS NULL` : sql`h.province_id = ${filters.provinceCode}`)
  if (filters.cityCode !== undefined) conditions.push(filters.cityCode === 'missing' ? sql`h.city_id IS NULL` : sql`h.city_id = ${filters.cityCode}`)
  if (filters.status !== undefined) conditions.push(sql`h.status = ${filters.status}`)
  if ((includeCreatedDate || filters.hospitalScope === 'period-new') && filters.startDate && filters.endDate) {
    conditions.push(sql`h.created_at >= ${filters.startDate}`)
    conditions.push(sql`h.created_at < ${endOfOverviewDate(filters.endDate)}`)
  }
  return sql.join(conditions, sql` AND `)
}

function isMissingCategoryColumn(error: any) {
  const cause = error?.cause ?? error
  const code = cause?.code ?? error?.code ?? error?.errno
  const message = String(cause?.sqlMessage ?? error?.sqlMessage ?? error?.message ?? '')
  return code === 'ER_BAD_FIELD_ERROR' || code === 1054 || /Unknown column.*category/i.test(message)
}

export class DashboardRepository {
  /**
   * 从 drizzleDb.execute(sql\`...\`) 的返回值里提取 row 数组。
   *
   * drizzle 的 execute 在 mysql2 driver 下返回 `Promise<[rows, fields]>`
   * 形态（mysql2 原生 tuple）；少数情况下（Drizzle 包装层 + prepared
   * statement）也可能返回 `{ rows: [...] }`。本 helper 兼容两种形态：
   * - tuple `[rows, fields]` —— rows 是数组
   * - `{ rows: [...] }` —— 用 .rows
   * - 其它 —— 回退到空数组
   */
  private static extractRows(result: any): any[] {
    if (Array.isArray(result)) {
      // 形态 1: [rows, fields] —— rows 是 result[0]
      if (Array.isArray(result[0])) return result[0]
      // 形态 2: 直接 rows 数组（部分 Drizzle 配置下）
      return result
    }
    if (result && typeof result === 'object' && Array.isArray(result.rows)) {
      return result.rows
    }
    return []
  }

  /**
   * 客服名下所有客户 ID（派单/客户范围过滤用）。
   *
   * 原先是 dashboard.service 里的裸 drizzleDb 查询。挪进 Repository 以符合
   * 「service 不直连数据库客户端」的分层约定。
   */
  static async ownedCustomerIds(userId: number, db: AppQueryDb = drizzleDb): Promise<number[]> {
    const rows = await db
      .select({ id: crmCustomer.id })
      .from(crmCustomer)
      .where(eq(crmCustomer.ownerUserId, userId))
    return rows.map(r => r.id)
  }

  /** 关联到给定医院的客户 ID（hospital_account 的范围过滤用）。 */
  static async customerIdsByHospitalIds(hospitalIds: number[], db: AppQueryDb = drizzleDb): Promise<number[]> {
    if (hospitalIds.length === 0) return [-1]
    const rows = await db
      .selectDistinct({ customerId: crmDispatch.customerId })
      .from(crmDispatch)
      .where(inArray(crmDispatch.hospitalId, hospitalIds))
    return rows.map(r => r.customerId)
  }

  /** 总数（不含软删除）。始终返回全量总数，不受 dateRange 影响。 */
  static async total(
    table: any,
    whereExtra?: WhereExtra,
    _dateRange?: DateRange,
    db: AppQueryDb = drizzleDb,
  ) {
    const c: any[] = [active(table)]
    if (whereExtra) c.push(...whereExtra(table))
    const [r] = await db
      .select({ total: count() })
      .from(table)
      .where(and(...c))
    return Number(r?.total ?? 0)
  }

  /**
   * 统计周期内新增。
   * 半开区间 [startDate, endDate+1day)：包含结束日全天记录。
   */
  static async periodNew(
    table: any,
    whereExtra?: WhereExtra,
    dateRange?: DateRange,
    db: AppQueryDb = drizzleDb,
  ) {
    const start = dateRange?.startDate ?? monthStart()
    const end = dateRange?.endDate ?? new Date()
    // 半开区间：< Asia/Shanghai 次日 00:00:00
    const endUpper = exclusiveEnd(end)
    const c: any[] = [
      active(table),
      gte(table.createdAt, start),
      lt(table.createdAt, endUpper),
    ]
    if (whereExtra) c.push(...whereExtra(table))
    const [r] = await db
      .select({ total: count() })
      .from(table)
      .where(and(...c))
    return Number(r?.total ?? 0)
  }

  /** @deprecated 使用 periodNew 替代 */
  static async monthNew(
    table: any,
    whereExtra?: WhereExtra,
    dateRange?: DateRange,
    db: AppQueryDb = drizzleDb,
  ) {
    return DashboardRepository.periodNew(table, whereExtra, dateRange, db)
  }

  /** @deprecated 使用 periodNew 替代 */
  static async weekNew(
    table: any,
    whereExtra?: WhereExtra,
    dateRange?: DateRange,
    db: AppQueryDb = drizzleDb,
  ) {
    if (dateRange) return DashboardRepository.periodNew(table, whereExtra, dateRange, db)
    const c: any[] = [active(table), gte(table.createdAt, weekStart())]
    if (whereExtra) c.push(...whereExtra(table))
    const [r] = await db
      .select({ total: count() })
      .from(table)
      .where(and(...c))
    return Number(r?.total ?? 0)
  }

  /** @deprecated 使用 periodNew 替代 */
  static async dayNew(
    table: any,
    whereExtra?: WhereExtra,
    dateRange?: DateRange,
    db: AppQueryDb = drizzleDb,
  ) {
    if (dateRange) return DashboardRepository.periodNew(table, whereExtra, dateRange, db)
    const c: any[] = [active(table), gte(table.createdAt, dayStart())]
    if (whereExtra) c.push(...whereExtra(table))
    const [r] = await db
      .select({ total: count() })
      .from(table)
      .where(and(...c))
    return Number(r?.total ?? 0)
  }

  /**
   * 统计周期内完成数（派单专用：finishedAt 在范围内）。
   * 半开区间 [startDate, endDate+1day)：包含结束日全天完成记录。
   */
  static async periodCompleted(
    table: any,
    whereExtra?: WhereExtra,
    dateRange?: DateRange,
    db: AppQueryDb = drizzleDb,
  ) {
    const start = dateRange?.startDate ?? monthStart()
    const end = dateRange?.endDate ?? new Date()
    const endUpper = exclusiveEnd(end)
    const c: any[] = [
      active(table),
      gte(table.finishedAt, start),
      lt(table.finishedAt, endUpper),
    ]
    if (whereExtra) c.push(...whereExtra(table))
    const [r] = await db
      .select({ total: count() })
      .from(table)
      .where(and(...c))
    return Number(r?.total ?? 0)
  }

  /** @deprecated 使用 periodCompleted 替代 */
  static async monthCompleted(
    table: any,
    whereExtra?: WhereExtra,
    dateRange?: DateRange,
    db: AppQueryDb = drizzleDb,
  ) {
    return DashboardRepository.periodCompleted(table, whereExtra, dateRange, db)
  }

  /**
   * 按类型统计（状态分布）。
   * 若提供 dateRange 则仅统计该时间范围内创建的记录（半开区间）。
   */
  static async byStatus(
    table: any,
    statusTable: any,
    statusNameField: any,
    fkColumn: any,
    whereExtra?: WhereExtra,
    dateRange?: DateRange,
    db: AppQueryDb = drizzleDb,
  ) {
    const c: any[] = [active(table)]
    if (dateRange) {
      c.push(gte(table.createdAt, dateRange.startDate))
      c.push(lt(table.createdAt, exclusiveEnd(dateRange.endDate)))
    }
    if (whereExtra) c.push(...whereExtra(table))
    const rows = await db
      .select({
        name: statusNameField,
        count: count(),
      })
      .from(table)
      .innerJoin(statusTable, eq(fkColumn, statusTable.id))
      .where(and(...c))
      .groupBy(statusTable.id)
      .orderBy(statusTable.sortOrder)
    return rows.map((r) => ({
      name: r.name,
      count: Number(r.count),
    }))
  }

  /** 月度趋势。若提供 dateRange，按自然月拆分该范围；否则回退到近 N 个月。半开区间 upper bound。 */
  static async monthlyTrend(
    table: any,
    months = 12,
    whereExtra?: WhereExtra,
    dateRange?: DateRange,
    db: AppQueryDb = drizzleDb,
  ) {
    const now = new Date()
    const rangeStart = dateRange?.startDate
      ?? dateUtils.shanghaiAddMonths(dateUtils.shanghaiMonthStart(now), -(months - 1))
    const rangeEnd = dateRange?.endDate ?? now
    const endUpper = exclusiveEnd(rangeEnd)

    const c: any[] = [active(table), gte(table.createdAt, rangeStart), lt(table.createdAt, endUpper)]
    if (whereExtra) c.push(...whereExtra(table))

    const rows = await db
      .select({
        year: sql`YEAR(${table.createdAt})`,
        month: sql`MONTH(${table.createdAt})`,
        count: count(),
      })
      .from(table)
      .where(and(...c))
      .groupBy(sql`YEAR(${table.createdAt})`, sql`MONTH(${table.createdAt})`)
      .orderBy(sql`YEAR(${table.createdAt}) ASC, MONTH(${table.createdAt}) ASC`)

    // 填充空白月份
    const map = new Map<string, number>()
    for (const r of rows) {
      const key = `${String(r.year).padStart(4, '0')}-${String(r.month).padStart(2, '0')}`
      map.set(key, Number(r.count))
    }

    const startParts = dateUtils.formatShanghaiYmd(rangeStart).slice(0, 7)
    const endParts = dateUtils.formatShanghaiYmd(rangeEnd).slice(0, 7)
    const [sy, sm] = startParts.split('-').map(Number)
    const [ey, em] = endParts.split('-').map(Number)
    const trendMonths = dateRange
      ? (ey - sy) * 12 + (em - sm) + 1
      : months

    const result: { month: string; count: number }[] = []
    for (let i = trendMonths - 1; i >= 0; i--) {
      const d = dateUtils.shanghaiAddMonths(dateUtils.shanghaiMonthStart(rangeEnd), -i)
      const key = dateUtils.formatShanghaiYmd(d).slice(0, 7)
      result.push({
        month: key,
        count: map.get(key) ?? 0,
      })
    }
    return result
  }

  /** 客户启用数量（status=1）。若提供 dateRange 则仅统计该时间范围内创建的记录（半开区间）。 */
  static async activeHospitals(
    whereExtra?: WhereExtra,
    dateRange?: DateRange,
    db: AppQueryDb = drizzleDb,
  ) {
    const c: any[] = [active(crmHospital), eq(crmHospital.status, 1)]
    if (dateRange) {
      c.push(gte(crmHospital.createdAt, dateRange.startDate))
      c.push(lt(crmHospital.createdAt, exclusiveEnd(dateRange.endDate)))
    }
    if (whereExtra) c.push(...whereExtra(crmHospital))
    const [r] = await db
      .select({ total: count() })
      .from(crmHospital)
      .where(and(...c))
    return Number(r?.total ?? 0)
  }

  /**
   * 医院效率榜。
   *
   * 按医院聚合：
   * - dispatchCount：未软删除派单数
   * - viewedCount：crm_dispatch_view_log 中该医院被查看过的派单数（distinct dispatch）
   *   用 SUM(CASE WHEN view_log.id IS NOT NULL) 在 LEFT JOIN 后统计
   * - replyCount：该医院所有派单对应的回复数（子查询）
   * - firstViewedAt：该医院最早一次查看时间（MIN）
   *
   * 派生字段：
   * - unviewedCount = max(0, dispatchCount - viewedCount)
   * - viewedRate = (viewedCount / dispatchCount) * 100，保留 1 位小数
   *
   * 排序：dispatchCount DESC；limit 默认 10。
   *
   * 注：本方法不应用角色数据范围过滤 —— 排行榜数据维度由调用方（service 层）
   * 决定如何约束访问范围。当前任务（T1）仅实现基础聚合。
   */
  static async getHospitalRankings(limit = 10) {
    const rows = await drizzleDb
      .select({
        hospitalId: crmHospital.id,
        hospitalName: crmHospital.hospitalName,
        dispatchCount: count(crmDispatch.id),
        viewedCount: sql<number>`SUM(CASE WHEN ${crmDispatchViewLog.id} IS NOT NULL THEN 1 ELSE 0 END)`,
        replyCount: sql<number>`(SELECT COUNT(*) FROM crm_dispatch_reply r WHERE r.dispatch_id IN (SELECT id FROM crm_dispatch WHERE hospital_id = ${crmHospital.id} AND deleted_at IS NULL))`,
        firstViewedAt: sql<Date | null>`MIN(${crmDispatchViewLog.createdAt})`,
      })
      .from(crmHospital)
      .leftJoin(
        crmDispatch,
        and(eq(crmDispatch.hospitalId, crmHospital.id), active(crmDispatch)),
      )
      .leftJoin(crmDispatchViewLog, eq(crmDispatchViewLog.hospitalId, crmHospital.id))
      .where(active(crmHospital))
      .groupBy(crmHospital.id, crmHospital.hospitalName)
      .orderBy(desc(count(crmDispatch.id)))
      .limit(limit)

    return rows.map((r: any) => {
      const dispatchCount = Number(r.dispatchCount ?? 0)
      const viewedCount = Number(r.viewedCount ?? 0)
      return {
        hospitalId: Number(r.hospitalId),
        hospitalName: r.hospitalName,
        dispatchCount,
        viewedCount,
        unviewedCount: Math.max(0, dispatchCount - viewedCount),
        replyCount: Number(r.replyCount ?? 0),
        firstViewedAt:
          r.firstViewedAt instanceof Date ? r.firstViewedAt.toISOString() : null,
        viewedRate:
          dispatchCount > 0
            ? Number(((viewedCount / dispatchCount) * 100).toFixed(1))
            : 0,
      }
    })
  }

  /**
   * 按城市分组的医院分类分布（口腔 / 整形）。
   *
   * 聚合维度：province.code / province.name / city.code / city.name。
   * - oralCount   = category = 'oral' 的医院数
   * - plasticCount = category = 'plastic' 的医院数
   * - total       = 该城市所有未软删除医院数（含 category = NULL 的"未分类"医院）
   *
   * 排序：total DESC。
   *
   * sys_region 是 Core 表。用 `sql` 模板拼 cross-table join
   * （drizzle-orm/mysql-core 的跨 schema join 较繁琐），并对 city/province
   * 别名做字段重投影，保持调用方类型稳定。
   *
   * **重要**：本方法走纯 raw SQL（`drizzleDb.execute(sql\`...\`)`），**不**通过
   * Drizzle column 引用 crmHospital.category —— 因为 crmHospital 在 db/schema.ts
   * 里**没有**声明 category 字段（避免所有 crmHospital 查询触发 Unknown column）。
   * category 物理列由 drizzle 0003 迁移添加；等运维 db:migrate 后再把 schema 字段
   * 加回来即可让本 raw SQL 命中分类数据。
   *
   * 兼容策略：
   * - 若 crm_hospital.category 不存在（运维未跑 0003），降级 SQL 改用
   *   `0 AS oral_count, 0 AS plastic_count, COUNT(*) AS total`，
   *   让接口仍然返回城市分布但分类计数全 0，前端 Empty 占位。
   */
  static async getHospitalDistributionByCity(): Promise<Array<{
    provinceCode: number
    provinceName: string
    cityCode: number
    cityName: string
    oralCount: number
    plasticCount: number
    total: number
  }>> {
    // 主 SQL：引用 category 列
    const primarySql = sql`
      SELECT
        province.code AS province_code,
        province.name AS province_name,
        city.code AS city_code,
        city.name AS city_name,
        SUM(CASE WHEN h.category = 'oral' THEN 1 ELSE 0 END) AS oral_count,
        SUM(CASE WHEN h.category = 'plastic' THEN 1 ELSE 0 END) AS plastic_count,
        COUNT(*) AS total
      FROM crm_hospital h
      LEFT JOIN sys_region city ON city.code = h.city_id
      LEFT JOIN sys_region province ON province.code = h.province_id
      WHERE h.deleted_at IS NULL
      GROUP BY city.code, city.name, province.code, province.name
      ORDER BY COUNT(*) DESC
    `

    // 降级 SQL：category 不存在时不引用它，全部分类计数为 0
    const fallbackSql = sql`
      SELECT
        province.code AS province_code,
        province.name AS province_name,
        city.code AS city_code,
        city.name AS city_name,
        0 AS oral_count,
        0 AS plastic_count,
        COUNT(*) AS total
      FROM crm_hospital h
      LEFT JOIN sys_region city ON city.code = h.city_id
      LEFT JOIN sys_region province ON province.code = h.province_id
      WHERE h.deleted_at IS NULL
      GROUP BY city.code, city.name, province.code, province.name
      ORDER BY COUNT(*) DESC
    `

    let rows: any[]
    try {
      const result: any = await drizzleDb.execute(primarySql)
      rows = DashboardRepository.extractRows(result)
    } catch (err: any) {
      // ER_BAD_FIELD_ERROR 1054 = Unknown column 'h.category' in 'field list'
      // drizzle 0003 还没跑时降级。MySQL 错误码在 err.cause.code 里（Drizzle
      // 把 mysql2 抛出的原始错误包装了一层）。
      const cause = err?.cause ?? err
      const code = cause?.code ?? err?.code ?? err?.errno
      const sqlMsg = String(cause?.sqlMessage ?? err?.sqlMessage ?? err?.message ?? '')
      const isUnknownColumn = code === 'ER_BAD_FIELD_ERROR' ||
        code === 1054 ||
        /Unknown column.*category/i.test(sqlMsg) ||
        /Failed query.*category/i.test(sqlMsg)
      if (isUnknownColumn) {
        const result: any = await drizzleDb.execute(fallbackSql)
        rows = DashboardRepository.extractRows(result)
      } else {
        throw err
      }
    }

    return (rows as any[]).map((r) => ({
      provinceCode: Number(r.province_code ?? 0),
      provinceName: String(r.province_name ?? ''),
      cityCode: Number(r.city_code ?? 0),
      cityName: String(r.city_name ?? ''),
      oralCount: Number(r.oral_count ?? 0),
      plasticCount: Number(r.plastic_count ?? 0),
      total: Number(r.total ?? 0),
    }))
  }

  static async getHospitalOverview(
    filters: HospitalOverviewFilters,
    db: { execute: (query: any) => Promise<any> } = drizzleDb,
  ) {
    try {
      return await DashboardRepository.queryHospitalOverview(filters, db, true)
    } catch (error) {
      if (!isMissingCategoryColumn(error)) throw error
      return DashboardRepository.queryHospitalOverview(filters, db, false)
    }
  }

  static async getHospitalOverviewDetails(
    query: HospitalOverviewDetailsQuery,
    db: { execute: (query: any) => Promise<any> } = drizzleDb,
  ) {
    try {
      return await DashboardRepository.queryHospitalOverviewDetails(query, db, true)
    } catch (error) {
      if (!isMissingCategoryColumn(error)) throw error
      return DashboardRepository.queryHospitalOverviewDetails(query, db, false)
    }
  }

  private static async queryHospitalOverviewDetails(
    query: HospitalOverviewDetailsQuery,
    db: { execute: (query: any) => Promise<any> },
    categoryAvailable: boolean,
  ) {
    const categoryExpression = overviewCategoryExpression(categoryAvailable)
    const hospitalWhere = overviewWhere(query, false, categoryAvailable)
    const dispatchDateFilter = query.startDate && query.endDate
      ? sql` AND d.created_at >= ${query.startDate} AND d.created_at < ${endOfOverviewDate(query.endDate)}`
      : sql``
    const offset = (query.page - 1) * query.pageSize
    const [rowsResult, totalResult] = await Promise.all([
      db.execute(sql`
        SELECT h.id, h.hospital_name, ${categoryExpression} AS category,
          COALESCE(province.name, '') AS province_name, COALESCE(city.name, '') AS city_name, h.status,
          COUNT(d.id) AS dispatch_count,
          SUM(CASE WHEN d.status_id = 3 THEN 1 ELSE 0 END) AS arrived_count,
          SUM(CASE WHEN d.status_id = 4 THEN 1 ELSE 0 END) AS deal_count,
          MAX(d.created_at) AS latest_dispatch_at
        FROM crm_hospital h
        LEFT JOIN sys_region province ON province.code = h.province_id
        LEFT JOIN sys_region city ON city.code = h.city_id
        LEFT JOIN crm_dispatch d ON d.hospital_id = h.id AND d.deleted_at IS NULL${dispatchDateFilter}
        WHERE ${hospitalWhere}
        GROUP BY h.id, h.hospital_name, ${categoryExpression}, province.name, city.name, h.status
        ORDER BY h.id DESC
        LIMIT ${query.pageSize} OFFSET ${offset}
      `),
      db.execute(sql`SELECT COUNT(*) AS total FROM crm_hospital h WHERE ${hospitalWhere}`),
    ])

    return {
      list: DashboardRepository.extractRows(rowsResult).map((row) => ({
        id: Number(row.id),
        hospitalName: String(row.hospital_name ?? ''),
        category: overviewCategory(row.category),
        provinceName: String(row.province_name ?? ''),
        cityName: String(row.city_name ?? ''),
        status: Number(row.status ?? 0),
        dispatchCount: Number(row.dispatch_count ?? 0),
        arrivedCount: Number(row.arrived_count ?? 0),
        dealCount: Number(row.deal_count ?? 0),
        latestDispatchAt: row.latest_dispatch_at ? new Date(row.latest_dispatch_at).toISOString() : null,
      })),
      total: Number(DashboardRepository.extractRows(totalResult)[0]?.total ?? 0),
    }
  }

  private static async queryHospitalOverview(
    filters: HospitalOverviewFilters,
    db: { execute: (query: any) => Promise<any> },
    categoryAvailable: boolean,
  ) {
    const categoryExpression = overviewCategoryExpression(categoryAvailable)
    const hospitalWhere = overviewWhere(filters, false, categoryAvailable)
    const periodWhere = overviewWhere(filters, true, categoryAvailable)
    const dispatchDateFilter = filters.startDate && filters.endDate
      ? sql` AND d.created_at >= ${filters.startDate} AND d.created_at < ${endOfOverviewDate(filters.endDate)}`
      : sql``

    const [summaryResult, categoryResult, provinceResult, cityResult, businessResult] = await Promise.all([
      db.execute(sql`
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN ${categoryExpression} = 'oral' THEN 1 ELSE 0 END) AS oral_count,
          SUM(CASE WHEN ${categoryExpression} = 'plastic' THEN 1 ELSE 0 END) AS plastic_count,
          SUM(CASE WHEN ${categoryExpression} = 'unknown' THEN 1 ELSE 0 END) AS unknown_count,
          (SELECT COUNT(*) FROM crm_hospital h WHERE ${periodWhere}) AS period_new
        FROM crm_hospital h
        WHERE ${hospitalWhere}
      `),
      db.execute(sql`
        SELECT
          ${categoryExpression} AS category,
          COUNT(*) AS hospital_count
        FROM crm_hospital h
        WHERE ${hospitalWhere}
        GROUP BY ${categoryExpression}
      `),
      db.execute(sql`
        SELECT
          h.province_id AS province_code,
          COALESCE(province.name, '') AS province_name,
          COUNT(*) AS hospital_count
        FROM crm_hospital h
        LEFT JOIN sys_region province ON province.code = h.province_id
        WHERE ${hospitalWhere}
        GROUP BY h.province_id, province.name
        ORDER BY hospital_count DESC, h.province_id ASC
      `),
      db.execute(sql`
        SELECT
          h.province_id AS province_code,
          COALESCE(province.name, '') AS province_name,
          h.city_id AS city_code,
          COALESCE(city.name, '') AS city_name,
          COUNT(*) AS hospital_count
        FROM crm_hospital h
        LEFT JOIN sys_region province ON province.code = h.province_id
        LEFT JOIN sys_region city ON city.code = h.city_id
        WHERE ${hospitalWhere}
        GROUP BY h.province_id, province.name, h.city_id, city.name
        ORDER BY hospital_count DESC, h.province_id ASC, h.city_id ASC
      `),
      db.execute(sql`
        SELECT
          ${categoryExpression} AS category,
          COUNT(d.id) AS dispatch_count,
          SUM(CASE WHEN d.status_id = 3 THEN 1 ELSE 0 END) AS arrived_count,
          SUM(CASE WHEN d.status_id = 4 THEN 1 ELSE 0 END) AS deal_count
        FROM crm_hospital h
        LEFT JOIN crm_dispatch d ON d.hospital_id = h.id AND d.deleted_at IS NULL${dispatchDateFilter}
        WHERE ${hospitalWhere}
        GROUP BY ${categoryExpression}
      `),
    ])

    const summaryRow = DashboardRepository.extractRows(summaryResult)[0] ?? {}
    const categoryCounts = new Map<HospitalOverviewCategory, number>()
    for (const row of DashboardRepository.extractRows(categoryResult)) {
      categoryCounts.set(overviewCategory(row.category), Number(row.hospital_count ?? 0))
    }
    const businessRows = new Map<HospitalOverviewCategory, any>()
    for (const row of DashboardRepository.extractRows(businessResult)) {
      businessRows.set(overviewCategory(row.category), row)
    }

    return {
      summary: {
        total: Number(summaryRow.total ?? 0),
        oral: Number(summaryRow.oral_count ?? 0),
        plastic: Number(summaryRow.plastic_count ?? 0),
        unknown: Number(summaryRow.unknown_count ?? 0),
        periodNew: Number(summaryRow.period_new ?? 0),
      },
      byCategory: overviewCategories.map((category) => ({
        category,
        hospitalCount: categoryCounts.get(category) ?? 0,
      })),
      byProvince: DashboardRepository.extractRows(provinceResult).map((row) => ({
        provinceCode: row.province_code == null ? 'missing' as const : Number(row.province_code),
        provinceName: String(row.province_name || (row.province_code == null ? '未填写省份' : `省份 ${row.province_code}`)),
        hospitalCount: Number(row.hospital_count ?? 0),
      })),
      byCity: DashboardRepository.extractRows(cityResult).map((row) => ({
        provinceCode: row.province_code == null ? 'missing' as const : Number(row.province_code),
        provinceName: String(row.province_name || (row.province_code == null ? '未填写省份' : `省份 ${row.province_code}`)),
        cityCode: row.city_code == null ? 'missing' as const : Number(row.city_code),
        cityName: String(row.city_name || (row.city_code == null ? '未填写城市' : `城市 ${row.city_code}`)),
        hospitalCount: Number(row.hospital_count ?? 0),
      })),
      businessByCategory: overviewCategories.map((category) => {
        const row = businessRows.get(category) ?? {}
        const dispatchCount = Number(row.dispatch_count ?? 0)
        const arrivedCount = Number(row.arrived_count ?? 0)
        const dealCount = Number(row.deal_count ?? 0)
        return {
          category,
          dispatchCount,
          arrivedCount,
          dealCount,
          arrivedRate: dispatchCount > 0 ? Number(((arrivedCount / dispatchCount) * 100).toFixed(1)) : 0,
          dealRate: dispatchCount > 0 ? Number(((dealCount / dispatchCount) * 100).toFixed(1)) : 0,
        }
      }),
    }
  }
}
