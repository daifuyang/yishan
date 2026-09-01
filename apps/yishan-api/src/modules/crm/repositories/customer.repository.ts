import { and, asc, count, desc, eq, inArray, isNull, like, or, sql, type SQL } from 'drizzle-orm'
import { drizzleDb, type AppQueryDb } from '@/db'
import { sysUser } from '@/db/schema'
import {
  crmCustomer,
  crmCustomerSource,
  crmCustomerStatus,
  crmCustomerTag,
  crmContact,
} from '../db/schema.js'
import type { POOL_STATUS } from '../schemas/customer.schema.js'

/**
 * crm_customer Repository。
 *
 * 整个 CRM 模块内**唯一**允许访问 crmCustomer / crmCustomerTag 表的层。
 * 允许对 sysUser 做 LEFT JOIN 拿负责人名（sys_* 是 core 表，
 * 跨表 join 只在 Repository 层允许，Service / Route 不允许）。
 *
 * poolStatus / type 与 schema 中的字面量类型对齐，避免字符串拼写散落。
 */

export type CustomerPoolStatus = (typeof POOL_STATUS)[number]
export type CustomerType = 'enterprise' | 'individual'

export interface CustomerRow {
  id: number
  code: string | null
  name: string
  type: string
  statusId: number | null
  sourceId: number | null
  level: string | null
  industry: string | null
  phone: string | null
  website: string | null
  province: string | null
  city: string | null
  address: string | null
  ownerUserId: number | null
  ownerDepartmentId: number | null
  poolStatus: string
  lastFollowUpAt: Date | null
  nextFollowUpAt: Date | null
  remark: string | null
  creatorId: number | null
  createdAt: Date
  updaterId: number | null
  updatedAt: Date
}

export interface CustomerDetailRow extends CustomerRow {
  ownerUserName: string | null
  statusName: string | null
  sourceName: string | null
  primaryContactId: number | null
  primaryContactName: string | null
  tagIds: number[]
}

export interface CreateCustomerInput {
  name: string
  type: CustomerType
  statusId?: number | null
  sourceId?: number | null
  level?: string | null
  industry?: string | null
  phone?: string | null
  website?: string | null
  province?: string | null
  city?: string | null
  address?: string | null
  ownerUserId?: number | null
  ownerDepartmentId?: number | null
  poolStatus?: CustomerPoolStatus
  remark?: string | null
  creatorId: number
  updaterId: number
}

export interface UpdateCustomerInput {
  name?: string
  type?: CustomerType
  statusId?: number | null
  sourceId?: number | null
  level?: string | null
  industry?: string | null
  phone?: string | null
  website?: string | null
  province?: string | null
  city?: string | null
  address?: string | null
  ownerUserId?: number | null
  ownerDepartmentId?: number | null
  poolStatus?: CustomerPoolStatus
  lastFollowUpAt?: Date | null
  nextFollowUpAt?: Date | null
  remark?: string | null
  updaterId: number
}

export interface CustomerListQuery {
  page?: number
  pageSize?: number
  keyword?: string
  statusId?: number
  sourceId?: number
  level?: string
  type?: string
  ownerUserId?: number
  poolStatus?: CustomerPoolStatus
  /** 数据范围过滤条件：把"我能看到的客户"用 where 表达出来。 */
  ownerUserIds?: number[] | null
  ownerDepartmentIds?: number[] | null
}

const customerPublicColumns = {
  id: crmCustomer.id,
  code: crmCustomer.code,
  name: crmCustomer.name,
  type: crmCustomer.type,
  statusId: crmCustomer.statusId,
  sourceId: crmCustomer.sourceId,
  level: crmCustomer.level,
  industry: crmCustomer.industry,
  phone: crmCustomer.phone,
  website: crmCustomer.website,
  province: crmCustomer.province,
  city: crmCustomer.city,
  address: crmCustomer.address,
  ownerUserId: crmCustomer.ownerUserId,
  ownerDepartmentId: crmCustomer.ownerDepartmentId,
  poolStatus: crmCustomer.poolStatus,
  lastFollowUpAt: crmCustomer.lastFollowUpAt,
  nextFollowUpAt: crmCustomer.nextFollowUpAt,
  remark: crmCustomer.remark,
  creatorId: crmCustomer.creatorId,
  createdAt: crmCustomer.createdAt,
  updaterId: crmCustomer.updaterId,
  updatedAt: crmCustomer.updatedAt,
}

function buildListWhere(opts: CustomerListQuery): SQL | undefined {
  const conds: SQL[] = [isNull(crmCustomer.deletedAt)]
  if (opts.keyword) {
    const k = `%${opts.keyword}%`
    conds.push(
      or(like(crmCustomer.name, k), like(crmCustomer.phone, k), like(crmCustomer.code, k))!,
    )
  }
  if (opts.statusId !== undefined) conds.push(eq(crmCustomer.statusId, opts.statusId))
  if (opts.sourceId !== undefined) conds.push(eq(crmCustomer.sourceId, opts.sourceId))
  if (opts.level) conds.push(eq(crmCustomer.level, opts.level))
  if (opts.type) conds.push(eq(crmCustomer.type, opts.type))
  if (opts.ownerUserId !== undefined) conds.push(eq(crmCustomer.ownerUserId, opts.ownerUserId))
  if (opts.poolStatus) conds.push(eq(crmCustomer.poolStatus, opts.poolStatus))

  // 数据范围：在 SERVICE 层把 ownerUserIds / ownerDepartmentIds / poolStatus 算好后传入。
  // 这里只表达"我能看到的客户 = 我的 / 我部门的 / 公海的"这一组 IN/OR 条件。
  // null 表示"无限制"（super_admin）；不传 / undefined 表示"不套用数据范围"。
  if (opts.ownerUserIds !== undefined || opts.ownerDepartmentIds !== undefined) {
    const sub: SQL[] = []
    if (opts.ownerUserIds && opts.ownerUserIds.length > 0) {
      sub.push(inArray(crmCustomer.ownerUserId, opts.ownerUserIds))
    }
    if (opts.ownerDepartmentIds && opts.ownerDepartmentIds.length > 0) {
      sub.push(inArray(crmCustomer.ownerDepartmentId, opts.ownerDepartmentIds))
    }
    if (sub.length === 0) {
      // super_admin：不过滤
    } else {
      sub.push(eq(crmCustomer.poolStatus, 'public'))
      conds.push(or(...sub)!)
    }
  }

  return and(...conds)
}

export class CustomerRepository {
  /**
   * 查重：企业客户按 name 精确查重，phone 辅助查重；
   * 个人客户按 phone 查重；同名 / 同号即视为重复。
   *
   * excludeId：update 时跳过自己。
   */
  static async findDuplicate(
    input: { name: string; type: CustomerType; phone?: string | null },
    excludeId: number | undefined,
    db: AppQueryDb = drizzleDb,
  ): Promise<CustomerRow | null> {
    const conds: SQL[] = [isNull(crmCustomer.deletedAt)]
    if (input.type === 'enterprise') {
      conds.push(eq(crmCustomer.name, input.name))
      if (input.phone && input.phone.length > 0) {
        // 企业客户：phone 命中 + 排除完全同 id 也算重复
        conds.push(eq(crmCustomer.phone, input.phone))
      }
    } else {
      // 个人客户：按 phone 查重
      if (input.phone && input.phone.length > 0) {
        conds.push(eq(crmCustomer.phone, input.phone))
      } else {
        conds.push(eq(crmCustomer.name, input.name))
      }
    }
    if (excludeId !== undefined) {
      conds.push(sql`${crmCustomer.id} <> ${excludeId}`)
    }
    const [row] = await db
      .select(customerPublicColumns)
      .from(crmCustomer)
      .where(and(...conds))
      .limit(1)
    return (row as CustomerRow | undefined) ?? null
  }

  static async list(
    query: CustomerListQuery,
    db: AppQueryDb = drizzleDb,
  ): Promise<{ rows: CustomerRow[]; total: number }> {
    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 10
    const where = buildListWhere(query)

    const [rows, totalRow] = await Promise.all([
      db
        .select(customerPublicColumns)
        .from(crmCustomer)
        .where(where)
        .orderBy(desc(crmCustomer.updatedAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db.select({ c: count() }).from(crmCustomer).where(where),
    ])

    return { rows: rows as CustomerRow[], total: Number(totalRow[0]?.c ?? 0) }
  }

  static async findById(
    id: number,
    db: AppQueryDb = drizzleDb,
  ): Promise<CustomerRow | null> {
    const [row] = await db
      .select(customerPublicColumns)
      .from(crmCustomer)
      .where(and(eq(crmCustomer.id, id), isNull(crmCustomer.deletedAt)))
      .limit(1)
    return (row as CustomerRow | undefined) ?? null
  }

  /**
   * 详情：基础字段 + 负责人名 + 状态名 + 来源名 + 主要联系人 + tag ids。
   * 用 leftJoin sysUser + 多个独立查询（在应用层拼装）。
   * 不在 repository 内做跨模块 join 跨 sysUser 之外的 sys_* 表。
   */
  static async findDetailById(
    id: number,
    db: AppQueryDb = drizzleDb,
  ): Promise<CustomerDetailRow | null> {
    const [row] = await db
      .select(customerPublicColumns)
      .from(crmCustomer)
      .where(and(eq(crmCustomer.id, id), isNull(crmCustomer.deletedAt)))
      .limit(1)

    if (!row) return null
    const base = row as CustomerRow

    const [ownerRow, statusRow, sourceRow, primary, tagRows] = await Promise.all([
      base.ownerUserId
        ? db
            .select({ username: sysUser.username })
            .from(sysUser)
            .where(eq(sysUser.id, base.ownerUserId))
            .limit(1)
        : Promise.resolve([] as Array<{ username: string | null }>),
      base.statusId
        ? db
            .select({ name: crmCustomerStatus.name })
            .from(crmCustomerStatus)
            .where(
              and(eq(crmCustomerStatus.id, base.statusId), isNull(crmCustomerStatus.deletedAt)),
            )
            .limit(1)
        : Promise.resolve([] as Array<{ name: string | null }>),
      base.sourceId
        ? db
            .select({ name: crmCustomerSource.name })
            .from(crmCustomerSource)
            .where(
              and(eq(crmCustomerSource.id, base.sourceId), isNull(crmCustomerSource.deletedAt)),
            )
            .limit(1)
        : Promise.resolve([] as Array<{ name: string | null }>),
      CustomerRepository.findPrimaryContact(id, db),
      db
        .select({ tagId: crmCustomerTag.tagId })
        .from(crmCustomerTag)
        .where(eq(crmCustomerTag.customerId, id)),
    ])

    return {
      ...base,
      ownerUserName: ownerRow[0]?.username ?? null,
      statusName: statusRow[0]?.name ?? null,
      sourceName: sourceRow[0]?.name ?? null,
      primaryContactId: primary?.id ?? null,
      primaryContactName: primary?.name ?? null,
      tagIds: tagRows.map((r) => r.tagId),
    }
  }

  static async create(
    input: CreateCustomerInput,
    db: AppQueryDb = drizzleDb,
  ): Promise<CustomerRow> {
    const [inserted] = await db
      .insert(crmCustomer)
      .values({
        name: input.name,
        type: input.type,
        statusId: input.statusId ?? null,
        sourceId: input.sourceId ?? null,
        level: input.level ?? null,
        industry: input.industry ?? null,
        phone: input.phone ?? null,
        website: input.website ?? null,
        province: input.province ?? null,
        city: input.city ?? null,
        address: input.address ?? null,
        ownerUserId: input.ownerUserId ?? null,
        ownerDepartmentId: input.ownerDepartmentId ?? null,
        poolStatus: input.poolStatus ?? (input.ownerUserId ? 'owned' : 'public'),
        remark: input.remark ?? null,
        creatorId: input.creatorId,
        updaterId: input.updaterId,
      })
      .$returningId()
    const created = await CustomerRepository.findById(inserted.id, db)
    if (!created) throw new Error('Failed to read back created crm customer')
    return created
  }

  static async update(
    id: number,
    input: UpdateCustomerInput,
    db: AppQueryDb = drizzleDb,
  ): Promise<CustomerRow | null> {
    const patch: Record<string, unknown> = { updatedAt: new Date(), updaterId: input.updaterId }
    if (input.name !== undefined) patch.name = input.name
    if (input.type !== undefined) patch.type = input.type
    if (input.statusId !== undefined) patch.statusId = input.statusId
    if (input.sourceId !== undefined) patch.sourceId = input.sourceId
    if (input.level !== undefined) patch.level = input.level
    if (input.industry !== undefined) patch.industry = input.industry
    if (input.phone !== undefined) patch.phone = input.phone
    if (input.website !== undefined) patch.website = input.website
    if (input.province !== undefined) patch.province = input.province
    if (input.city !== undefined) patch.city = input.city
    if (input.address !== undefined) patch.address = input.address
    if (input.ownerUserId !== undefined) patch.ownerUserId = input.ownerUserId
    if (input.ownerDepartmentId !== undefined) patch.ownerDepartmentId = input.ownerDepartmentId
    if (input.poolStatus !== undefined) patch.poolStatus = input.poolStatus
    if (input.lastFollowUpAt !== undefined) patch.lastFollowUpAt = input.lastFollowUpAt
    if (input.nextFollowUpAt !== undefined) patch.nextFollowUpAt = input.nextFollowUpAt
    if (input.remark !== undefined) patch.remark = input.remark

    await db.update(crmCustomer).set(patch).where(eq(crmCustomer.id, id))
    return CustomerRepository.findById(id, db)
  }

  /**
   * 把指定客户"认领"到指定 owner。带 WHERE pool_status='public' 的 CAS（compare-and-set）
   * 守卫：只有原本在公海的客户才能被认领；并发情况下只有一个事务能 UPDATE 到行。
   *
   * 返回 updatedRowsCount：0 表示已被别人抢先认领。
   */
  static async claimInTx(
    id: number,
    ownerUserId: number,
    ownerDepartmentId: number | null,
    updaterId: number,
    db: AppQueryDb,
  ): Promise<number> {
    const result = await db
      .update(crmCustomer)
      .set({
        ownerUserId,
        ownerDepartmentId,
        poolStatus: 'owned',
        updaterId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(crmCustomer.id, id),
          isNull(crmCustomer.deletedAt),
          eq(crmCustomer.poolStatus, 'public'),
        ),
      )
    // drizzle/mysql2 返回的是 OkPacket 数组（[packet, fields]），affectedRows 在 [0]
    const ok = (result as unknown as [{ affectedRows?: number } | undefined, unknown])[0]
    return ok?.affectedRows ?? 0
  }

  static async softDelete(id: number, db: AppQueryDb = drizzleDb): Promise<void> {
    await db
      .update(crmCustomer)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(crmCustomer.id, id))
  }

  /* ─── 客户 ↔ 标签 桥接 ───────────────── */

  static async setCustomerTags(
    customerId: number,
    tagIds: number[],
    db: AppQueryDb,
  ): Promise<void> {
    await db.delete(crmCustomerTag).where(eq(crmCustomerTag.customerId, customerId))
    if (tagIds.length > 0) {
      await db
        .insert(crmCustomerTag)
        .values(tagIds.map((tagId) => ({ customerId, tagId })))
    }
  }

  static async getCustomerTagIds(
    customerId: number,
    db: AppQueryDb = drizzleDb,
  ): Promise<number[]> {
    const rows = await db
      .select({ tagId: crmCustomerTag.tagId })
      .from(crmCustomerTag)
      .where(eq(crmCustomerTag.customerId, customerId))
    return rows.map((r) => r.tagId)
  }

  /**
   * 概览 / 计数器：在 service 层组合多个 count() 调用。
   * 这里只暴露底层的 counter 函数，避免在 repository 内拼业务语义。
   */
  static async countWhere(conds: SQL[], db: AppQueryDb = drizzleDb): Promise<number> {
    const [row] = await db
      .select({ c: count() })
      .from(crmCustomer)
      .where(and(...conds, isNull(crmCustomer.deletedAt)))
    return Number(row?.c ?? 0)
  }

  /* ─── 列表 / 详情里需要的"主要联系人" ── */

  static async findPrimaryContact(
    customerId: number,
    db: AppQueryDb = drizzleDb,
  ): Promise<{ id: number; name: string } | null> {
    const [row] = await db
      .select({ id: crmContact.id, name: crmContact.name })
      .from(crmContact)
      .where(
        and(
          eq(crmContact.customerId, customerId),
          eq(crmContact.isPrimary, 1),
          isNull(crmContact.deletedAt),
        ),
      )
      .limit(1)
    return (row as { id: number; name: string } | undefined) ?? null
  }

  /** 列表里的"主要联系人"批查：避免 N+1。 */
  static async findPrimaryContactsByCustomerIds(
    customerIds: number[],
    db: AppQueryDb = drizzleDb,
  ): Promise<Map<number, { id: number; name: string; mobile: string | null }>> {
    if (customerIds.length === 0) return new Map()
    const rows = await db
      .select({
        customerId: crmContact.customerId,
        id: crmContact.id,
        name: crmContact.name,
        mobile: crmContact.mobile,
      })
      .from(crmContact)
      .where(
        and(
          inArray(crmContact.customerId, customerIds),
          eq(crmContact.isPrimary, 1),
          isNull(crmContact.deletedAt),
        ),
      )
      .orderBy(asc(crmContact.id))
    const map = new Map<number, { id: number; name: string; mobile: string | null }>()
    for (const r of rows) {
      if (!map.has(r.customerId)) {
        map.set(r.customerId, { id: r.id, name: r.name, mobile: r.mobile })
      }
    }
    return map
  }

  /** 列表里"负责人名"批查：避免 N+1。 */
  static async findOwnerNamesByUserIds(
    userIds: number[],
    db: AppQueryDb = drizzleDb,
  ): Promise<Map<number, string>> {
    if (userIds.length === 0) return new Map()
    const rows = await db
      .select({ id: sysUser.id, name: sysUser.realName })
      .from(sysUser)
      .where(inArray(sysUser.id, userIds))
    const map = new Map<number, string>()
    for (const r of rows) {
      map.set(r.id, r.name ?? '')
    }
    return map
  }
}
