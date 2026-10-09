/**
 * 报价单（crm_quotation / crm_quotation_item / crm_quotation_status_log）仓库。
 *
 * 设计原则：
 *   - 薄：纯数据访问，不带业务规则；事务由 service 显式调用 dbManager.transaction() 启动。
 *   - 列表 / 详情：通过公开用户目录补全 ownerUserName，关联 CRM 表取得 customerName。
 *   - 列表 / 详情均带 deletedAt IS NULL 守卫；软删后不可见。
 *   - findByIdWithLock：行级锁，供 acceptQuotation 等状态机关键迁移使用，
 *     避免「两笔并发 accept 把同 opportunity 下旧 accepted 同时改写」的竞态。
 */
import { and, asc, count, desc, eq, inArray, isNull, like, max, or, sql, type SQL } from 'drizzle-orm'
import { drizzleDb, type AppQueryDb } from '@yishan/core-system-api/database'
import { userDirectory } from '@yishan/core-system-api'
import {
  crmCustomer,
  crmOpportunity,
  crmContact,
  crmQuotation,
  crmQuotationItem,
  crmQuotationStatusLog,
  crmQuotationShare,
} from '../db/schema.js'
import type {
  QuotationStatus,
} from '../schemas/quotation.schema.js'

/**
 * 仓库内部 Row 类型：日期字段为 Date（DB 实际类型）。
 * 路由层在序列化为 JSON 时由 fast-json-stringify 转成 date-time 字符串。
 */
export interface QuotationRow {
  id: number
  quotationNo: string
  seriesId?: string
  seriesNo?: string
  name: string
  version: number
  rootQuoteId: number | null
  sourceQuoteId: number | null
  customerId: number
  customerName: string | null
  opportunityId: number | null
  contactId: number | null
  ownerUserId: number
  ownerUserName: string | null
  ownerDepartmentId: number | null
  status: QuotationStatus
  quoteDate: Date | null
  opportunityName: string | null
  contactName: string | null
  validUntil: Date | null
  netCents: number
  taxCents: number
  totalCents: number
  discountAmountCents: number
  publicDiscountDescription?: string | null
  internalDiscountReason?: string | null
  remark: string | null
  creatorId: number | null
  createdAt: Date
  updaterId: number | null
  updatedAt: Date
  sentAt: Date | null
  acceptedAt: Date | null
  acceptedBy?: number | null
  contractId?: number | null
  closedAt: Date | null
  shareFirstViewedAt?: Date | null
  shareViewCount?: number
  hasShare?: boolean
}

export interface QuotationItemRow {
  id: number
  quotationId: number
  productId: number | null
  description: string | null
  productNameSnapshot: string
  unitSnapshot: string | null
  quantityCents: number
  unitPriceCents: number
  discountBp: number
  taxRateBp: number
  lineAmountCents: number
  sortOrder: number
  createdAt: Date
  updatedAt: Date
}

export interface QuotationStatusLogRow {
  id: number
  quotationId: number
  fromStatus: QuotationStatus
  toStatus: QuotationStatus
  operatorUserId: number
  operatorUserName: string | null
  reason: string | null
  createdAt: Date
}

export type QuotationShareStatus = 'active' | 'revoked'

export interface QuotationShareRow {
  id: number
  quotationId: number
  tokenHash: string
  status: QuotationShareStatus
  expiresAt: Date
  durationDays: number | null
  followQuoteValidUntil: number
  createdAt: Date
  createdBy: number
  sentAt: Date | null
  firstViewedAt: Date | null
  lastViewedAt: Date | null
  viewCount: number
  revokedAt: Date | null
  updatedAt: Date
}

export interface QuotationListQuery {
  page?: number
  pageSize?: number
  keyword?: string
  status?: QuotationStatus
  customerId?: number
  opportunityId?: number
  ownerUserId?: number
  ownerUserIds?: number[] | null
  ownerDepartmentIds?: number[] | null
}

export interface QuoteSeriesSummary {
  seriesId: string
  seriesNo: string
  title: string
  customerId: number
  customerName: string | null
  opportunityId: number | null
  opportunityName: string | null
  opportunityNo: string | null
  currentQuoteId: number
  currentVersion: number
  versionCount: number
  currentStatus: QuotationStatus
  currentAmount: number
  quoteDate: Date | null
  validUntil: Date | null
  customerViewStatus: 'viewed' | 'unviewed'
  lastViewedAt: Date | null
  viewCount: number
  ownerUserId: number
  ownerUserName: string | null
  hasActiveShare: boolean
}

export interface CreateQuotationInput {
  version?: number
  rootQuoteId?: number | null
  sourceQuoteId?: number | null
  quotationNo: string
  seriesId?: string
  seriesNo?: string
  name: string
  customerId: number
  opportunityId?: number | null
  contactId?: number | null
  ownerUserId: number
  status: QuotationStatus
  quoteDate?: Date | null
  validUntil?: Date | null
  netCents: number
  taxCents: number
  totalCents: number
  discountAmountCents: number
  publicDiscountDescription?: string | null
  internalDiscountReason?: string | null
  remark?: string | null
  creatorId: number
  updaterId: number
}

export interface UpdateQuotationInput {
  customerId?: number
  opportunityId?: number | null
  contactId?: number | null
  quoteDate?: Date | null
  validUntil?: Date | null
  name?: string
  netCents?: number
  taxCents?: number
  totalCents?: number
  discountAmountCents?: number
  publicDiscountDescription?: string | null
  internalDiscountReason?: string | null
  remark?: string | null
  updaterId: number
  status?: QuotationStatus
  sentAt?: Date | null
  acceptedAt?: Date | null
  acceptedBy?: number | null
  closedAt?: Date | null
}

export interface CreateQuotationItemInput {
  quotationId: number
  productId: number | null
  description: string | null
  productNameSnapshot: string
  unitSnapshot?: string | null
  quantityCents: number
  unitPriceCents: number
  discountBp: number
  taxRateBp: number
  lineAmountCents: number
  sortOrder: number
}

export interface CreateQuotationStatusLogInput {
  quotationId: number
  fromStatus: QuotationStatus
  toStatus: QuotationStatus
  operatorUserId: number
  reason?: string | null
}

const customer = crmCustomer

async function withOwnerNames(rows: Omit<QuotationRow, 'ownerUserName'>[]): Promise<QuotationRow[]> {
  const users = await userDirectory.findByIds(rows.map((row) => row.ownerUserId), { includeDeleted: true })
  return rows.map((row) => ({ ...row, ownerUserName: users.get(row.ownerUserId)?.realName ?? null }))
}

const quotationColumns = {
  id: crmQuotation.id,
  quotationNo: crmQuotation.quotationNo,
  name: crmQuotation.name,
  version: crmQuotation.version,
  rootQuoteId: crmQuotation.rootQuoteId,
  sourceQuoteId: crmQuotation.sourceQuoteId,
  customerId: crmQuotation.customerId,
  customerName: customer.name,
  opportunityId: crmQuotation.opportunityId,
  contactId: crmQuotation.contactId,
  opportunityName: crmOpportunity.name,
  contactName: crmContact.name,
  quoteDate: crmQuotation.quoteDate,
  ownerUserId: crmQuotation.ownerUserId,
  ownerDepartmentId: crmOpportunity.ownerDepartmentId,
  status: crmQuotation.status,
  validUntil: crmQuotation.validUntil,
  netCents: crmQuotation.netCents,
  taxCents: crmQuotation.taxCents,
  totalCents: crmQuotation.totalCents,
  discountAmountCents: crmQuotation.discountAmountCents,
  publicDiscountDescription: crmQuotation.publicDiscountDescription,
  internalDiscountReason: crmQuotation.internalDiscountReason,
  remark: crmQuotation.remark,
  creatorId: crmQuotation.creatorId,
  createdAt: crmQuotation.createdAt,
  updaterId: crmQuotation.updaterId,
  updatedAt: crmQuotation.updatedAt,
  sentAt: crmQuotation.sentAt,
  acceptedAt: crmQuotation.acceptedAt,
  acceptedBy: crmQuotation.acceptedBy,
  closedAt: crmQuotation.closedAt,
  shareFirstViewedAt: sql<Date | null>`(SELECT first_viewed_at FROM crm_quotation_share WHERE quotation_id = ${crmQuotation.id} ORDER BY created_at DESC LIMIT 1)`.mapWith(crmQuotationShare.firstViewedAt),
  shareViewCount: sql<number>`COALESCE((SELECT view_count FROM crm_quotation_share WHERE quotation_id = ${crmQuotation.id} ORDER BY created_at DESC LIMIT 1), 0)`,
  hasShare: sql<boolean>`EXISTS(SELECT 1 FROM crm_quotation_share WHERE quotation_id = ${crmQuotation.id})`.mapWith(Boolean),
  seriesId: crmQuotation.seriesId,
  seriesNo: crmQuotation.seriesNo,
}

const itemColumns = {
  id: crmQuotationItem.id,
  quotationId: crmQuotationItem.quotationId,
  productId: crmQuotationItem.productId,
  productNameSnapshot: crmQuotationItem.productNameSnapshot,
  description: crmQuotationItem.description,
  unitSnapshot: crmQuotationItem.unitSnapshot,
  quantityCents: crmQuotationItem.quantityCents,
  unitPriceCents: crmQuotationItem.unitPriceCents,
  discountBp: crmQuotationItem.discountBp,
  taxRateBp: crmQuotationItem.taxRateBp,
  lineAmountCents: crmQuotationItem.lineAmountCents,
  sortOrder: crmQuotationItem.sortOrder,
  createdAt: crmQuotationItem.createdAt,
  updatedAt: crmQuotationItem.updatedAt,
}

const statusLogColumns = {
  id: crmQuotationStatusLog.id,
  quotationId: crmQuotationStatusLog.quotationId,
  fromStatus: crmQuotationStatusLog.fromStatus,
  toStatus: crmQuotationStatusLog.toStatus,
  operatorUserId: crmQuotationStatusLog.operatorUserId,
  reason: crmQuotationStatusLog.reason,
  createdAt: crmQuotationStatusLog.createdAt,
}

const shareColumns = {
  id: crmQuotationShare.id,
  quotationId: crmQuotationShare.quotationId,
  tokenHash: crmQuotationShare.tokenHash,
  status: crmQuotationShare.status,
  expiresAt: crmQuotationShare.expiresAt,
  durationDays: crmQuotationShare.durationDays,
  followQuoteValidUntil: crmQuotationShare.followQuoteValidUntil,
  createdAt: crmQuotationShare.createdAt,
  createdBy: crmQuotationShare.createdBy,
  sentAt: crmQuotationShare.sentAt,
  firstViewedAt: crmQuotationShare.firstViewedAt,
  lastViewedAt: crmQuotationShare.lastViewedAt,
  viewCount: crmQuotationShare.viewCount,
  revokedAt: crmQuotationShare.revokedAt,
  updatedAt: crmQuotationShare.updatedAt,
}

export function buildQuotationListWhere(q: QuotationListQuery): SQL | undefined {
  const c: SQL[] = [isNull(crmQuotation.deletedAt)]
  if (q.keyword) {
    const v = `%${q.keyword}%`
    c.push(or(like(crmQuotation.quotationNo, v), like(customer.name, v))!)
  }
  if (q.status) c.push(eq(crmQuotation.status, q.status))
  if (q.customerId !== undefined) c.push(eq(crmQuotation.customerId, q.customerId))
  if (q.opportunityId !== undefined) c.push(eq(crmQuotation.opportunityId, q.opportunityId))
  if (q.ownerUserId !== undefined) c.push(eq(crmQuotation.ownerUserId, q.ownerUserId))
  if (q.ownerUserIds !== null && q.ownerUserIds !== undefined) {
    const visible: SQL[] = []
    if (q.ownerUserIds.length) visible.push(inArray(crmQuotation.ownerUserId, q.ownerUserIds))
    if (q.ownerDepartmentIds?.length) visible.push(inArray(crmOpportunity.ownerDepartmentId, q.ownerDepartmentIds))
    c.push(visible.length ? or(...visible)! : sql`1 = 0`)

  }
  return and(...c)
}

export function buildQuotationSeriesWhere(q: QuotationListQuery): SQL | undefined {
  const c: SQL[] = [isNull(crmQuotation.deletedAt)]
  if (q.status) c.push(eq(crmQuotation.status, q.status))
  if (q.customerId !== undefined) c.push(eq(crmQuotation.customerId, q.customerId))
  if (q.opportunityId !== undefined) c.push(eq(crmQuotation.opportunityId, q.opportunityId))
  if (q.ownerUserId !== undefined) c.push(eq(crmQuotation.ownerUserId, q.ownerUserId))
  if (q.ownerUserIds !== null && q.ownerUserIds !== undefined) {
    const visible: SQL[] = []
    if (q.ownerUserIds.length) visible.push(inArray(crmQuotation.ownerUserId, q.ownerUserIds))
    if (q.ownerDepartmentIds?.length) visible.push(inArray(crmOpportunity.ownerDepartmentId, q.ownerDepartmentIds))
    c.push(visible.length ? or(...visible)! : sql`1 = 0`)
  }
  if (q.keyword) {
    const v = `%${q.keyword}%`
    c.push(or(
      like(crmQuotation.seriesNo, v),
      like(crmQuotation.quotationNo, v),
      like(crmQuotation.name, v),
      like(customer.name, v),
      like(crmOpportunity.name, v),
      like(crmOpportunity.opportunityNo, v),
      sql`EXISTS (SELECT 1 FROM crm_quotation history WHERE history.series_id = ${crmQuotation.seriesId} AND history.quotation_no LIKE ${v})`,
    )!)
  }
  return and(...c)
}

export class QuotationRepository {
  /**
   * 列表：返回主表基础字段 + 关联 owner/customer 名称。
   * 不带 items[] —— items 单独走 detail；列表关注筛选 / 排序。
   */
  static async list(q: QuotationListQuery, db: AppQueryDb = drizzleDb): Promise<{ rows: QuotationRow[]; total: number }> {
    const page = q.page ?? 1
    const pageSize = q.pageSize ?? 10
    const where = buildQuotationListWhere(q)
    const baseQuery = db
      .select(quotationColumns)
      .from(crmQuotation)
      .leftJoin(crmOpportunity, eq(crmOpportunity.id, crmQuotation.opportunityId))
      .leftJoin(crmContact, eq(crmContact.id, crmQuotation.contactId))
      .leftJoin(customer, and(eq(customer.id, crmQuotation.customerId), isNull(customer.deletedAt)))
      .where(where)
    const [rows, total] = await Promise.all([
      baseQuery
        .orderBy(desc(crmQuotation.updatedAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db.select({ c: count() }).from(crmQuotation).leftJoin(customer, eq(customer.id, crmQuotation.customerId)).leftJoin(crmOpportunity, eq(crmOpportunity.id, crmQuotation.opportunityId)).where(where),
    ])
    return {
      rows: await withOwnerNames(rows as unknown as Omit<QuotationRow, 'ownerUserName'>[]),
      total: Number(total[0]?.c ?? 0),
    }
  }

  /** 一行一个报价系列；当前版本由 series.version 最大值决定。 */
  static async listSeries(q: QuotationListQuery, db: AppQueryDb = drizzleDb): Promise<{ rows: QuoteSeriesSummary[]; total: number }> {
    const page = q.page ?? 1
    const pageSize = q.pageSize ?? 10
    const latest = db.select({
      seriesId: crmQuotation.seriesId,
      currentVersion: max(crmQuotation.version).as('currentVersion'),
      versionCount: count(crmQuotation.id).as('versionCount'),
    }).from(crmQuotation).where(isNull(crmQuotation.deletedAt)).groupBy(crmQuotation.seriesId).as('quote_series_summary')
    const where = buildQuotationSeriesWhere(q)
    const rows = await db.select({
      seriesId: latest.seriesId,
      seriesNo: crmQuotation.seriesNo,
      title: crmQuotation.name,
      customerId: crmQuotation.customerId,
      customerName: customer.name,
      opportunityId: crmQuotation.opportunityId,
      opportunityName: crmOpportunity.name,
      opportunityNo: crmOpportunity.opportunityNo,
      currentQuoteId: crmQuotation.id,
      currentVersion: latest.currentVersion,
      versionCount: latest.versionCount,
      currentStatus: crmQuotation.status,
      currentAmount: crmQuotation.totalCents,
      quoteDate: crmQuotation.quoteDate,
      validUntil: crmQuotation.validUntil,
      lastViewedAt: sql<Date | null>`(SELECT last_viewed_at FROM crm_quotation_share WHERE quotation_id = ${crmQuotation.id} ORDER BY created_at DESC LIMIT 1)`.mapWith(crmQuotationShare.lastViewedAt),
      viewCount: sql<number>`COALESCE((SELECT view_count FROM crm_quotation_share WHERE quotation_id = ${crmQuotation.id} ORDER BY created_at DESC LIMIT 1), 0)`,
      hasActiveShare: sql<boolean>`EXISTS(SELECT 1 FROM crm_quotation_share WHERE quotation_id = ${crmQuotation.id} AND status = 'active')`,
      ownerUserId: crmQuotation.ownerUserId,
    }).from(latest)
      .innerJoin(crmQuotation, and(eq(crmQuotation.seriesId, latest.seriesId), eq(crmQuotation.version, latest.currentVersion), isNull(crmQuotation.deletedAt)))
      .leftJoin(crmOpportunity, eq(crmOpportunity.id, crmQuotation.opportunityId))
      .leftJoin(customer, and(eq(customer.id, crmQuotation.customerId), isNull(customer.deletedAt)))
      .where(where)
      .orderBy(desc(crmQuotation.updatedAt)).limit(pageSize).offset((page - 1) * pageSize)
    const totals = await db.select({ total: count() }).from(latest)
      .innerJoin(crmQuotation, and(eq(crmQuotation.seriesId, latest.seriesId), eq(crmQuotation.version, latest.currentVersion), isNull(crmQuotation.deletedAt)))
      .leftJoin(crmOpportunity, eq(crmOpportunity.id, crmQuotation.opportunityId))
      .leftJoin(customer, and(eq(customer.id, crmQuotation.customerId), isNull(customer.deletedAt)))
      .where(where)
    const users = await userDirectory.findByIds(rows.map((row) => row.ownerUserId), { includeDeleted: true })
    const mapped = (rows as unknown as Array<Omit<QuoteSeriesSummary, 'customerViewStatus' | 'ownerUserName'>>).map((row) => ({
      ...row,
      ownerUserName: users.get(row.ownerUserId)?.realName ?? null,
      currentVersion: Number(row.currentVersion),
      versionCount: Number(row.versionCount),
      customerViewStatus: (row.lastViewedAt ? 'viewed' : 'unviewed') as 'viewed' | 'unviewed',
      hasActiveShare: Boolean(row.hasActiveShare),
    }))
    return { rows: mapped, total: Number(totals[0]?.total ?? 0) }
  }

  /**
   * 主表读行（不带 items）。若 service 想要 items + 主表，请走 findDetailById。
   */
  static async findById(id: number, db: AppQueryDb = drizzleDb): Promise<QuotationRow | null> {
    const [row] = await db
      .select(quotationColumns)
      .from(crmQuotation)
      .leftJoin(crmOpportunity, eq(crmOpportunity.id, crmQuotation.opportunityId))
      .leftJoin(crmContact, eq(crmContact.id, crmQuotation.contactId))
      .leftJoin(customer, and(eq(customer.id, crmQuotation.customerId), isNull(customer.deletedAt)))
      .where(and(eq(crmQuotation.id, id), isNull(crmQuotation.deletedAt)))
      .limit(1)
    return row ? (await withOwnerNames([row as unknown as Omit<QuotationRow, 'ownerUserName'>]))[0] ?? null : null
  }

  /**
   * 详情：主表 + items[]（按 sortOrder 升序）。
   */
  static async findDetailById(id: number, db: AppQueryDb = drizzleDb): Promise<{ head: QuotationRow; items: QuotationItemRow[] } | null> {
    const head = await QuotationRepository.findById(id, db)
    if (!head) return null
    const items = await QuotationRepository.listItemsByQuotationId(id, db)
    return { head, items }
  }

  /**
   * 行锁 + 重新读：service 在 accept/send/void/reject 关键迁移路径上调用，
   * 避免与并发 update / softDelete 出现脏竞态。
   * 仍走 findById 拿最新字段，FOR UPDATE 只为锁住这一行。
   */
  static async findByIdWithLock(id: number, db: AppQueryDb): Promise<QuotationRow | null> {
    await db.execute(sql`SELECT id FROM ${crmQuotation} WHERE id = ${id} AND deleted_at IS NULL FOR UPDATE`)
    return QuotationRepository.findById(id, db)
  }

  /** 根行锁由 service 先取得；当前读包含已软删版本，避免重复或复用版本号。 */
  static async maxVersionWithLock(rootQuoteId: number, db: AppQueryDb): Promise<number> {
    const [row] = await db.select({ version: crmQuotation.version }).from(crmQuotation)
      .where(eq(crmQuotation.rootQuoteId, rootQuoteId))
      .orderBy(desc(crmQuotation.version)).limit(1).for('update')
    return row?.version ?? 0
  }

  static async maxVersionBySeriesWithLock(seriesId: string, db: AppQueryDb): Promise<number> {
    const [row] = await db.select({ version: crmQuotation.version }).from(crmQuotation)
      .where(eq(crmQuotation.seriesId, seriesId))
      .orderBy(desc(crmQuotation.version)).limit(1).for('update')
    return row?.version ?? 0
  }

  static async latestBySeriesWithLock(seriesId: string, db: AppQueryDb): Promise<QuotationRow | null> {
    const [row] = await db.select(quotationColumns)
      .from(crmQuotation)
      .leftJoin(crmOpportunity, eq(crmOpportunity.id, crmQuotation.opportunityId))
      .leftJoin(crmContact, eq(crmContact.id, crmQuotation.contactId))
      .leftJoin(customer, eq(customer.id, crmQuotation.customerId))
      .where(and(eq(crmQuotation.seriesId, seriesId), isNull(crmQuotation.deletedAt)))
      .orderBy(desc(crmQuotation.version))
      .limit(1)
      .for('update')
    return row ? (await withOwnerNames([row as unknown as Omit<QuotationRow, 'ownerUserName'>]))[0] ?? null : null
  }

  static async listItemsByQuotationId(quotationId: number, db: AppQueryDb = drizzleDb): Promise<QuotationItemRow[]> {
    const rows = await db
      .select(itemColumns)
      .from(crmQuotationItem)
      .where(eq(crmQuotationItem.quotationId, quotationId))
      .orderBy(asc(crmQuotationItem.sortOrder), asc(crmQuotationItem.id))
    return rows as unknown as QuotationItemRow[]
  }

  static async listVersions(seriesId: string, db: AppQueryDb = drizzleDb): Promise<QuotationRow[]> {
    const rows = await db.select(quotationColumns).from(crmQuotation)
      .leftJoin(crmOpportunity, eq(crmOpportunity.id, crmQuotation.opportunityId))
      .leftJoin(crmContact, eq(crmContact.id, crmQuotation.contactId))
      .leftJoin(customer, eq(customer.id, crmQuotation.customerId))
      .where(and(eq(crmQuotation.seriesId, seriesId), isNull(crmQuotation.deletedAt)))
      .orderBy(desc(crmQuotation.version))
    return withOwnerNames(rows as unknown as Omit<QuotationRow, 'ownerUserName'>[])
  }

  /**
   * 整体替换 item 集合：删旧 + 插新。
   * 必须传入 db（同事务），否则新行 quotation_id 外键会找不到。
   * productId 可为 null —— 自定义项不绑定 Product 主数据。
   */
  static async replaceItems(quotationId: number, items: CreateQuotationItemInput[], db: AppQueryDb): Promise<QuotationItemRow[]> {
    await db.delete(crmQuotationItem).where(eq(crmQuotationItem.quotationId, quotationId))
    if (items.length === 0) return []
    const insertRows = items.map((it) => ({
      quotationId: it.quotationId,
      productId: it.productId,
      productNameSnapshot: it.productNameSnapshot,
      description: it.description,
      unitSnapshot: it.unitSnapshot ?? null,
      quantityCents: it.quantityCents,
      unitPriceCents: it.unitPriceCents,
      discountBp: it.discountBp,
      taxRateBp: it.taxRateBp,
      lineAmountCents: it.lineAmountCents,
      sortOrder: it.sortOrder,
      createdAt: new Date(),
      updatedAt: new Date(),
    }))
    await db.insert(crmQuotationItem).values(insertRows)
    return QuotationRepository.listItemsByQuotationId(quotationId, db)
  }

  static async create(input: CreateQuotationInput, db: AppQueryDb = drizzleDb): Promise<{ id: number }> {
    const [inserted] = await db.insert(crmQuotation).values({
      quotationNo: input.quotationNo,
      seriesId: input.seriesId ?? `legacy-${input.quotationNo}`.slice(0, 36),
      seriesNo: input.seriesNo ?? input.quotationNo,
      name: input.name,
      version: input.version ?? 1,
      rootQuoteId: input.rootQuoteId ?? null,
      sourceQuoteId: input.sourceQuoteId ?? null,
      customerId: input.customerId,
      opportunityId: input.opportunityId ?? null,
      contactId: input.contactId ?? null,
      ownerUserId: input.ownerUserId,
      status: input.status,
      quoteDate: input.quoteDate ?? null,
      validUntil: input.validUntil ?? null,
      netCents: input.netCents,
      taxCents: input.taxCents,
      totalCents: input.totalCents,
      discountAmountCents: input.discountAmountCents,
      publicDiscountDescription: input.publicDiscountDescription ?? null,
      internalDiscountReason: input.internalDiscountReason ?? null,
      remark: input.remark ?? null,
      creatorId: input.creatorId,
      updaterId: input.updaterId,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).$returningId()
    if (input.rootQuoteId == null) {
      await db.update(crmQuotation).set({ rootQuoteId: inserted.id }).where(eq(crmQuotation.id, inserted.id))
    }
    return { id: inserted.id }
  }

  static async update(id: number, input: UpdateQuotationInput, db: AppQueryDb = drizzleDb): Promise<QuotationRow | null> {
    const patch: Record<string, unknown> = { updatedAt: new Date(), updaterId: input.updaterId }
    if (input.customerId !== undefined) patch.customerId = input.customerId
    if (input.opportunityId !== undefined) patch.opportunityId = input.opportunityId
    if (input.contactId !== undefined) patch.contactId = input.contactId
    if (input.quoteDate !== undefined) patch.quoteDate = input.quoteDate
    if (input.validUntil !== undefined) patch.validUntil = input.validUntil
    if (input.name !== undefined) patch.name = input.name
    if (input.netCents !== undefined) patch.netCents = input.netCents
    if (input.taxCents !== undefined) patch.taxCents = input.taxCents
    if (input.totalCents !== undefined) patch.totalCents = input.totalCents
    if (input.discountAmountCents !== undefined) patch.discountAmountCents = input.discountAmountCents
    if (input.publicDiscountDescription !== undefined) patch.publicDiscountDescription = input.publicDiscountDescription
    if (input.internalDiscountReason !== undefined) patch.internalDiscountReason = input.internalDiscountReason
    if (input.remark !== undefined) patch.remark = input.remark
    if (input.status !== undefined) patch.status = input.status
    if (input.sentAt !== undefined) patch.sentAt = input.sentAt
    if (input.acceptedAt !== undefined) patch.acceptedAt = input.acceptedAt
    if (input.acceptedBy !== undefined) patch.acceptedBy = input.acceptedBy
    if (input.closedAt !== undefined) patch.closedAt = input.closedAt
    await db.update(crmQuotation).set(patch).where(and(eq(crmQuotation.id, id), isNull(crmQuotation.deletedAt)))
    return QuotationRepository.findById(id, db)
  }

  /**
   * 软删除：返回受影响行数（0 = 不存在 / 已删除）。
   */
  static async softDelete(id: number, db: AppQueryDb = drizzleDb): Promise<number> {
    const result = await db.update(crmQuotation)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(crmQuotation.id, id), isNull(crmQuotation.deletedAt)))
    return ((result as unknown as [{ affectedRows?: number } | undefined])[0])?.affectedRows ?? 0
  }

  /**
   * 同 opportunity 下、状态为 accepted 的所有报价 id（供 acceptQuotation 置 superseded 用）。
   */
  static async findAcceptedIdsByOpportunity(opportunityId: number, exceptId: number, db: AppQueryDb): Promise<number[]> {
    const rows = await db.select({ id: crmQuotation.id })
      .from(crmQuotation)
      .where(and(
        eq(crmQuotation.opportunityId, opportunityId),
        eq(crmQuotation.status, 'accepted'),
        isNull(crmQuotation.deletedAt),
      ))
    return rows.map((r) => r.id).filter((id) => id !== exceptId)
  }

  /**
   * 取当前 quotationNo 的最大值（按序号部分），用于生成新单号。
   * 不依赖 sequence：基于 yyyyMMdd + 自增 4 位后缀生成。
   * 不在数据库层面保证唯一性：crm_quotation.quotation_no 上有 uniq index；
   * 重复时由 service 抛 NOT_FOUND（实际是 unique constraint 触发，统一翻译为 NOT_FOUND）。
   */
  static async countTodayByNoPrefix(prefix: string, db: AppQueryDb = drizzleDb): Promise<number> {
    const v = `${prefix}%`
    const [row] = await db.select({ c: count() }).from(crmQuotation).where(like(crmQuotation.quotationNo, v))
    return Number(row?.c ?? 0)
  }

  static async countSeriesTodayByNoPrefix(prefix: string, db: AppQueryDb = drizzleDb): Promise<number> {
    const [row] = await db.select({ c: sql<number>`COUNT(DISTINCT ${crmQuotation.seriesNo})` }).from(crmQuotation).where(like(crmQuotation.seriesNo, `${prefix}%`))
    return Number(row?.c ?? 0)
  }

  /**
   * 状态日志写入。
   */
  static async createStatusLog(input: CreateQuotationStatusLogInput, db: AppQueryDb = drizzleDb): Promise<void> {
    await db.insert(crmQuotationStatusLog).values({
      quotationId: input.quotationId,
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      operatorUserId: input.operatorUserId,
      reason: input.reason ?? null,
      createdAt: new Date(),
    })
  }

  static async listStatusLogs(quotationId: number, db: AppQueryDb = drizzleDb): Promise<QuotationStatusLogRow[]> {
    const rows = await db
      .select(statusLogColumns)
      .from(crmQuotationStatusLog)
      .where(eq(crmQuotationStatusLog.quotationId, quotationId))
      .orderBy(desc(crmQuotationStatusLog.createdAt))
    const users = await userDirectory.findByIds(rows.map((row) => row.operatorUserId), { includeDeleted: true })
    return rows.map((row) => ({ ...row, operatorUserName: users.get(row.operatorUserId)?.realName ?? null })) as QuotationStatusLogRow[]
  }

  static async createShare(input: {
    quotationId: number
    tokenHash: string
    expiresAt: Date
    durationDays?: number | null
    followQuoteValidUntil?: boolean
    createdBy: number
  }, db: AppQueryDb = drizzleDb): Promise<QuotationShareRow> {
    const [inserted] = await db.insert(crmQuotationShare).values({
      quotationId: input.quotationId,
      tokenHash: input.tokenHash,
      status: 'active',
      expiresAt: input.expiresAt,
      durationDays: input.durationDays ?? null,
      followQuoteValidUntil: input.followQuoteValidUntil ? 1 : 0,
      createdAt: new Date(),
      createdBy: input.createdBy,
      viewCount: 0,
      updatedAt: new Date(),
    }).$returningId()
    const row = await QuotationRepository.findShareById(inserted.id, db)
    if (!row) throw new Error('报价分享创建失败')
    return row
  }

  static async findShareById(id: number, db: AppQueryDb = drizzleDb): Promise<QuotationShareRow | null> {
    const [row] = await db.select(shareColumns).from(crmQuotationShare).where(eq(crmQuotationShare.id, id)).limit(1)
    return (row as unknown as QuotationShareRow) ?? null
  }

  static async findShareByTokenHash(tokenHash: string, db: AppQueryDb = drizzleDb): Promise<QuotationShareRow | null> {
    const [row] = await db.select(shareColumns).from(crmQuotationShare).where(eq(crmQuotationShare.tokenHash, tokenHash)).limit(1)
    return (row as unknown as QuotationShareRow) ?? null
  }

  static async findLatestShare(quotationId: number, db: AppQueryDb = drizzleDb): Promise<QuotationShareRow | null> {
    const [row] = await db.select(shareColumns).from(crmQuotationShare)
      .where(eq(crmQuotationShare.quotationId, quotationId))
      .orderBy(desc(crmQuotationShare.createdAt), desc(crmQuotationShare.id)).limit(1)
    return (row as unknown as QuotationShareRow) ?? null
  }

  static async updateShare(id: number, patch: {
    expiresAt?: Date
    sentAt?: Date | null
    status?: QuotationShareStatus
    revokedAt?: Date | null
    firstViewedAt?: Date | null
    lastViewedAt?: Date | null
    viewCount?: number
  }, db: AppQueryDb = drizzleDb): Promise<QuotationShareRow | null> {
    await db.update(crmQuotationShare).set({ ...patch, updatedAt: new Date() }).where(eq(crmQuotationShare.id, id))
    return QuotationRepository.findShareById(id, db)
  }
}
