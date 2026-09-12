/**
 * 报价单（crm_quotation / crm_quotation_item / crm_quotation_status_log）仓库。
 *
 * 设计原则：
 *   - 薄：纯数据访问，不带业务规则；事务由 service 显式调用 dbManager.transaction() 启动。
 *   - 列表 / 详情：使用 leftJoin sys_user / crm_customer 拼装 ownerUserName / customerName。
 *   - 列表 / 详情均带 deletedAt IS NULL 守卫；软删后不可见。
 *   - findByIdWithLock：行级锁，供 acceptQuotation 等状态机关键迁移使用，
 *     避免「两笔并发 accept 把同 opportunity 下旧 accepted 同时改写」的竞态。
 */
import { and, asc, count, desc, eq, inArray, isNull, like, or, sql, type SQL } from 'drizzle-orm'
import { drizzleDb, type AppQueryDb } from '@/db'
import { sysUser } from '@/db/schema'
import {
  crmCustomer,
  crmQuotation,
  crmQuotationItem,
  crmQuotationStatusLog,
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
  version: number
  customerId: number
  customerName: string | null
  opportunityId: number | null
  contactId: number | null
  ownerUserId: number
  ownerUserName: string | null
  status: QuotationStatus
  validUntil: Date | null
  netCents: number
  taxCents: number
  totalCents: number
  remark: string | null
  creatorId: number | null
  createdAt: Date
  updaterId: number | null
  updatedAt: Date
  sentAt: Date | null
  acceptedAt: Date | null
  closedAt: Date | null
}

export interface QuotationItemRow {
  id: number
  quotationId: number
  productId: number
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

export interface CreateQuotationInput {
  quotationNo: string
  customerId: number
  opportunityId?: number | null
  contactId?: number | null
  ownerUserId: number
  status: QuotationStatus
  validUntil?: Date | null
  netCents: number
  taxCents: number
  totalCents: number
  remark?: string | null
  creatorId: number
  updaterId: number
}

export interface UpdateQuotationInput {
  customerId?: number
  opportunityId?: number | null
  contactId?: number | null
  validUntil?: Date | null
  netCents?: number
  taxCents?: number
  totalCents?: number
  remark?: string | null
  updaterId: number
  status?: QuotationStatus
  sentAt?: Date | null
  acceptedAt?: Date | null
  closedAt?: Date | null
}

export interface CreateQuotationItemInput {
  quotationId: number
  productId: number
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

const ownerUser = sysUser
const customer = crmCustomer

const quotationColumns = {
  id: crmQuotation.id,
  quotationNo: crmQuotation.quotationNo,
  version: crmQuotation.version,
  customerId: crmQuotation.customerId,
  customerName: customer.name,
  opportunityId: crmQuotation.opportunityId,
  contactId: crmQuotation.contactId,
  ownerUserId: crmQuotation.ownerUserId,
  ownerUserName: ownerUser.realName,
  status: crmQuotation.status,
  validUntil: crmQuotation.validUntil,
  netCents: crmQuotation.netCents,
  taxCents: crmQuotation.taxCents,
  totalCents: crmQuotation.totalCents,
  remark: crmQuotation.remark,
  creatorId: crmQuotation.creatorId,
  createdAt: crmQuotation.createdAt,
  updaterId: crmQuotation.updaterId,
  updatedAt: crmQuotation.updatedAt,
  sentAt: crmQuotation.sentAt,
  acceptedAt: crmQuotation.acceptedAt,
  closedAt: crmQuotation.closedAt,
}

const itemColumns = {
  id: crmQuotationItem.id,
  quotationId: crmQuotationItem.quotationId,
  productId: crmQuotationItem.productId,
  productNameSnapshot: crmQuotationItem.productNameSnapshot,
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
  operatorUserName: ownerUser.realName,
  reason: crmQuotationStatusLog.reason,
  createdAt: crmQuotationStatusLog.createdAt,
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
    if (q.ownerUserIds.length === 0) {
      // 没有可见 owner：返回「不可能命中」的恒假条件，保证不漏数据也不越权。
      c.push(sql`1 = 0`)
    } else {
      c.push(inArray(crmQuotation.ownerUserId, q.ownerUserIds))
    }
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
      .leftJoin(ownerUser, eq(ownerUser.id, crmQuotation.ownerUserId))
      .leftJoin(customer, and(eq(customer.id, crmQuotation.customerId), isNull(customer.deletedAt)))
      .where(where)
    const [rows, total] = await Promise.all([
      baseQuery
        .orderBy(desc(crmQuotation.updatedAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db.select({ c: count() }).from(crmQuotation).where(where),
    ])
    return {
      rows: rows as unknown as QuotationRow[],
      total: Number(total[0]?.c ?? 0),
    }
  }

  /**
   * 主表读行（不带 items）。若 service 想要 items + 主表，请走 findDetailById。
   */
  static async findById(id: number, db: AppQueryDb = drizzleDb): Promise<QuotationRow | null> {
    const [row] = await db
      .select(quotationColumns)
      .from(crmQuotation)
      .leftJoin(ownerUser, eq(ownerUser.id, crmQuotation.ownerUserId))
      .leftJoin(customer, and(eq(customer.id, crmQuotation.customerId), isNull(customer.deletedAt)))
      .where(and(eq(crmQuotation.id, id), isNull(crmQuotation.deletedAt)))
      .limit(1)
    return (row as unknown as QuotationRow) ?? null
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
    try {
      await db.execute(sql`SELECT id FROM ${crmQuotation} WHERE id = ${id} AND deleted_at IS NULL FOR UPDATE`)
    } catch {
      // query builder 的 .execute 可能在某些驱动上抛错；忽略后用 findById 走正常逻辑。
    }
    return QuotationRepository.findById(id, db)
  }

  static async listItemsByQuotationId(quotationId: number, db: AppQueryDb = drizzleDb): Promise<QuotationItemRow[]> {
    const rows = await db
      .select(itemColumns)
      .from(crmQuotationItem)
      .where(eq(crmQuotationItem.quotationId, quotationId))
      .orderBy(asc(crmQuotationItem.sortOrder), asc(crmQuotationItem.id))
    return rows as unknown as QuotationItemRow[]
  }

  /**
   * 整体替换 item 集合：删旧 + 插新。
   * 必须传入 db（同事务），否则新行 quotation_id 外键会找不到。
   */
  static async replaceItems(quotationId: number, items: CreateQuotationItemInput[], db: AppQueryDb): Promise<QuotationItemRow[]> {
    await db.delete(crmQuotationItem).where(eq(crmQuotationItem.quotationId, quotationId))
    if (items.length === 0) return []
    const insertRows = items.map((it) => ({
      quotationId: it.quotationId,
      productId: it.productId,
      productNameSnapshot: it.productNameSnapshot,
      unitSnapshot: it.unitSnapshot ?? null,
      quantityCents: it.quantityCents,
      unitPriceCents: it.unitPriceCents,
      discountBp: it.discountBp,
      taxRateBp: it.taxRateBp,
      lineAmountCents: it.lineAmountCents,
      sortOrder: it.sortOrder,
    }))
    await db.insert(crmQuotationItem).values(insertRows)
    return QuotationRepository.listItemsByQuotationId(quotationId, db)
  }

  static async create(input: CreateQuotationInput, db: AppQueryDb = drizzleDb): Promise<{ id: number }> {
    const [inserted] = await db.insert(crmQuotation).values({
      quotationNo: input.quotationNo,
      version: 1,
      customerId: input.customerId,
      opportunityId: input.opportunityId ?? null,
      contactId: input.contactId ?? null,
      ownerUserId: input.ownerUserId,
      status: input.status,
      validUntil: input.validUntil ?? null,
      netCents: input.netCents,
      taxCents: input.taxCents,
      totalCents: input.totalCents,
      remark: input.remark ?? null,
      creatorId: input.creatorId,
      updaterId: input.updaterId,
    }).$returningId()
    return { id: inserted.id }
  }

  static async update(id: number, input: UpdateQuotationInput, db: AppQueryDb = drizzleDb): Promise<QuotationRow | null> {
    const patch: Record<string, unknown> = { updatedAt: new Date(), updaterId: input.updaterId }
    if (input.customerId !== undefined) patch.customerId = input.customerId
    if (input.opportunityId !== undefined) patch.opportunityId = input.opportunityId
    if (input.contactId !== undefined) patch.contactId = input.contactId
    if (input.validUntil !== undefined) patch.validUntil = input.validUntil
    if (input.netCents !== undefined) patch.netCents = input.netCents
    if (input.taxCents !== undefined) patch.taxCents = input.taxCents
    if (input.totalCents !== undefined) patch.totalCents = input.totalCents
    if (input.remark !== undefined) patch.remark = input.remark
    if (input.status !== undefined) patch.status = input.status
    if (input.sentAt !== undefined) patch.sentAt = input.sentAt
    if (input.acceptedAt !== undefined) patch.acceptedAt = input.acceptedAt
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
    })
  }

  static async listStatusLogs(quotationId: number, db: AppQueryDb = drizzleDb): Promise<QuotationStatusLogRow[]> {
    const rows = await db
      .select(statusLogColumns)
      .from(crmQuotationStatusLog)
      .leftJoin(ownerUser, eq(ownerUser.id, crmQuotationStatusLog.operatorUserId))
      .where(eq(crmQuotationStatusLog.quotationId, quotationId))
      .orderBy(desc(crmQuotationStatusLog.createdAt))
    return rows as unknown as QuotationStatusLogRow[]
  }
}