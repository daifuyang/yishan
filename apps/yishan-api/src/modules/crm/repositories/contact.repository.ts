import { and, asc, count, desc, eq, inArray, isNull, like, or, type SQL } from 'drizzle-orm'
import { drizzleDb, type AppQueryDb } from '@/db'
import { crmContact } from '../db/schema.js'

/**
 * crm_contact Repository。
 *
 * 整个 CRM 模块内**唯一**允许访问 crmContact 表的层。
 */

export interface ContactRow {
  id: number
  customerId: number
  name: string
  gender: number
  mobile: string | null
  phone: string | null
  email: string | null
  department: string | null
  position: string | null
  isPrimary: number
  birthday: Date | null
  remark: string | null
  creatorId: number | null
  createdAt: Date
  updaterId: number | null
  updatedAt: Date
}

export interface CreateContactInput {
  customerId: number
  name: string
  gender?: number
  mobile?: string | null
  phone?: string | null
  email?: string | null
  department?: string | null
  position?: string | null
  isPrimary?: number
  birthday?: Date | null
  remark?: string | null
  creatorId: number
  updaterId: number
}

export interface UpdateContactInput {
  name?: string
  gender?: number
  mobile?: string | null
  phone?: string | null
  email?: string | null
  department?: string | null
  position?: string | null
  isPrimary?: number
  birthday?: Date | null
  remark?: string | null
  updaterId: number
}

export interface ContactListQuery {
  page?: number
  pageSize?: number
  keyword?: string
  customerId?: number
  isPrimary?: number
}

const contactPublicColumns = {
  id: crmContact.id,
  customerId: crmContact.customerId,
  name: crmContact.name,
  gender: crmContact.gender,
  mobile: crmContact.mobile,
  phone: crmContact.phone,
  email: crmContact.email,
  department: crmContact.department,
  position: crmContact.position,
  isPrimary: crmContact.isPrimary,
  birthday: crmContact.birthday,
  remark: crmContact.remark,
  creatorId: crmContact.creatorId,
  createdAt: crmContact.createdAt,
  updaterId: crmContact.updaterId,
  updatedAt: crmContact.updatedAt,
}

function buildListWhere(opts: ContactListQuery): SQL | undefined {
  const conds: SQL[] = [isNull(crmContact.deletedAt)]
  if (opts.keyword) {
    const k = `%${opts.keyword}%`
    conds.push(
      or(
        like(crmContact.name, k),
        like(crmContact.mobile, k),
        like(crmContact.phone, k),
        like(crmContact.email, k),
      )!,
    )
  }
  if (opts.customerId !== undefined) conds.push(eq(crmContact.customerId, opts.customerId))
  if (opts.isPrimary !== undefined) conds.push(eq(crmContact.isPrimary, opts.isPrimary))
  return and(...conds)
}

export class ContactRepository {
  static async list(
    query: ContactListQuery,
    db: AppQueryDb = drizzleDb,
  ): Promise<{ rows: ContactRow[]; total: number }> {
    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 10
    const where = buildListWhere(query)

    const [rows, totalRow] = await Promise.all([
      db
        .select(contactPublicColumns)
        .from(crmContact)
        .where(where)
        .orderBy(desc(crmContact.updatedAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db.select({ c: count() }).from(crmContact).where(where),
    ])

    return { rows: rows as ContactRow[], total: Number(totalRow[0]?.c ?? 0) }
  }

  static async listByCustomerId(
    customerId: number,
    db: AppQueryDb = drizzleDb,
  ): Promise<ContactRow[]> {
    const rows = await db
      .select(contactPublicColumns)
      .from(crmContact)
      .where(and(eq(crmContact.customerId, customerId), isNull(crmContact.deletedAt)))
      .orderBy(asc(crmContact.id))
    return rows as ContactRow[]
  }

  static async findById(
    id: number,
    db: AppQueryDb = drizzleDb,
  ): Promise<ContactRow | null> {
    const [row] = await db
      .select(contactPublicColumns)
      .from(crmContact)
      .where(and(eq(crmContact.id, id), isNull(crmContact.deletedAt)))
      .limit(1)
    return (row as ContactRow | undefined) ?? null
  }

  static async create(
    input: CreateContactInput,
    db: AppQueryDb = drizzleDb,
  ): Promise<ContactRow> {
    const [inserted] = await db
      .insert(crmContact)
      .values({
        customerId: input.customerId,
        name: input.name,
        gender: input.gender ?? 0,
        mobile: input.mobile ?? null,
        phone: input.phone ?? null,
        email: input.email ?? null,
        department: input.department ?? null,
        position: input.position ?? null,
        isPrimary: input.isPrimary ?? 0,
        birthday: input.birthday ?? null,
        remark: input.remark ?? null,
        creatorId: input.creatorId,
        updaterId: input.updaterId,
      })
      .$returningId()
    const created = await ContactRepository.findById(inserted.id, db)
    if (!created) throw new Error('Failed to read back created crm contact')
    return created
  }

  static async update(
    id: number,
    input: UpdateContactInput,
    db: AppQueryDb = drizzleDb,
  ): Promise<ContactRow | null> {
    const patch: Record<string, unknown> = { updatedAt: new Date(), updaterId: input.updaterId }
    if (input.name !== undefined) patch.name = input.name
    if (input.gender !== undefined) patch.gender = input.gender
    if (input.mobile !== undefined) patch.mobile = input.mobile
    if (input.phone !== undefined) patch.phone = input.phone
    if (input.email !== undefined) patch.email = input.email
    if (input.department !== undefined) patch.department = input.department
    if (input.position !== undefined) patch.position = input.position
    if (input.isPrimary !== undefined) patch.isPrimary = input.isPrimary
    if (input.birthday !== undefined) patch.birthday = input.birthday
    if (input.remark !== undefined) patch.remark = input.remark
    await db.update(crmContact).set(patch).where(eq(crmContact.id, id))
    return ContactRepository.findById(id, db)
  }

  /**
   * 把指定联系人设为客户的"主联系人"，并清空该客户下其他联系人的 is_primary。
   * 用于在事务内做"一个客户一个主联系人"约束。
   */
  static async setPrimaryInTx(
    contactId: number,
    customerId: number,
    db: AppQueryDb,
  ): Promise<void> {
    // 把该客户下所有联系人的 is_primary 清掉
    await db
      .update(crmContact)
      .set({ isPrimary: 0, updatedAt: new Date() })
      .where(and(eq(crmContact.customerId, customerId), isNull(crmContact.deletedAt)))
    // 把目标联系人设为 primary
    await db
      .update(crmContact)
      .set({ isPrimary: 1, updatedAt: new Date() })
      .where(eq(crmContact.id, contactId))
  }

  static async softDelete(id: number, db: AppQueryDb = drizzleDb): Promise<void> {
    await db
      .update(crmContact)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(crmContact.id, id))
  }

  /**
   * 校验 customerIds 全部存在：用于跨表一致性检查。
   * 返回存在 id 的子集。
   */
  static async existingIds(
    ids: number[],
    db: AppQueryDb = drizzleDb,
  ): Promise<Set<number>> {
    if (ids.length === 0) return new Set()
    const rows = await db
      .select({ id: crmContact.id })
      .from(crmContact)
      .where(and(inArray(crmContact.id, ids), isNull(crmContact.deletedAt)))
    return new Set(rows.map((r) => r.id))
  }
}
