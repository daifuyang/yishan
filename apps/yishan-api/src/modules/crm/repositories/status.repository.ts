import { and, asc, count, eq, isNull, like, ne, type SQL } from 'drizzle-orm'
import { drizzleDb, type AppQueryDb } from '@/db'
import { crmCustomerStatus } from '../db/schema.js'

/**
 * crm_customer_status Repository。
 *
 * 系统预置 (is_system = 1) 不允许改 code/type/is_system。
 * 第一版允许修改：name / sort / enabled。
 */

export interface StatusRow {
  id: number
  name: string
  code: string | null
  type: string
  sort: number
  enabled: number
  isSystem: number
  createdAt: Date
  updatedAt: Date
}

export interface CreateStatusInput {
  name: string
  code?: string | null
  type?: string
  sort?: number
  enabled?: number
}

export interface UpdateStatusInput {
  name?: string
  sort?: number
  enabled?: number
}

export interface StatusListQuery {
  page?: number
  pageSize?: number
  keyword?: string
  enabled?: number
}

const statusPublicColumns = {
  id: crmCustomerStatus.id,
  name: crmCustomerStatus.name,
  code: crmCustomerStatus.code,
  type: crmCustomerStatus.type,
  sort: crmCustomerStatus.sort,
  enabled: crmCustomerStatus.enabled,
  isSystem: crmCustomerStatus.isSystem,
  createdAt: crmCustomerStatus.createdAt,
  updatedAt: crmCustomerStatus.updatedAt,
}

function buildWhere(opts: StatusListQuery): SQL | undefined {
  const conds: SQL[] = [isNull(crmCustomerStatus.deletedAt)]
  if (opts.keyword) {
    conds.push(like(crmCustomerStatus.name, `%${opts.keyword}%`))
  }
  if (opts.enabled !== undefined) conds.push(eq(crmCustomerStatus.enabled, opts.enabled))
  return and(...conds)
}

export class StatusRepository {
  static async list(
    query: StatusListQuery,
    db: AppQueryDb = drizzleDb,
  ): Promise<{ rows: StatusRow[]; total: number }> {
    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 200
    const where = buildWhere(query)
    const [rows, totalRow] = await Promise.all([
      db
        .select(statusPublicColumns)
        .from(crmCustomerStatus)
        .where(where)
        .orderBy(asc(crmCustomerStatus.sort), asc(crmCustomerStatus.id))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db.select({ c: count() }).from(crmCustomerStatus).where(where),
    ])
    return { rows: rows as StatusRow[], total: Number(totalRow[0]?.c ?? 0) }
  }

  static async findById(
    id: number,
    db: AppQueryDb = drizzleDb,
  ): Promise<StatusRow | null> {
    const [row] = await db
      .select(statusPublicColumns)
      .from(crmCustomerStatus)
      .where(and(eq(crmCustomerStatus.id, id), isNull(crmCustomerStatus.deletedAt)))
      .limit(1)
    return (row as StatusRow | undefined) ?? null
  }

  static async findByName(
    name: string,
    excludeId: number | undefined,
    db: AppQueryDb = drizzleDb,
  ): Promise<StatusRow | null> {
    const conds: SQL[] = [eq(crmCustomerStatus.name, name), isNull(crmCustomerStatus.deletedAt)]
    if (excludeId !== undefined) conds.push(ne(crmCustomerStatus.id, excludeId))
    const [row] = await db
      .select(statusPublicColumns)
      .from(crmCustomerStatus)
      .where(and(...conds))
      .limit(1)
    return (row as StatusRow | undefined) ?? null
  }

  static async create(
    input: CreateStatusInput,
    db: AppQueryDb = drizzleDb,
  ): Promise<StatusRow> {
    const [inserted] = await db
      .insert(crmCustomerStatus)
      .values({
        name: input.name,
        code: input.code ?? null,
        type: input.type ?? 'active',
        sort: input.sort ?? 0,
        enabled: input.enabled ?? 1,
        isSystem: 0,
      })
      .$returningId()
    const created = await StatusRepository.findById(inserted.id, db)
    if (!created) throw new Error('Failed to read back created crm status')
    return created
  }

  static async update(
    id: number,
    input: UpdateStatusInput,
    db: AppQueryDb = drizzleDb,
  ): Promise<StatusRow | null> {
    const patch: Record<string, unknown> = { updatedAt: new Date() }
    if (input.name !== undefined) patch.name = input.name
    if (input.sort !== undefined) patch.sort = input.sort
    if (input.enabled !== undefined) patch.enabled = input.enabled
    await db.update(crmCustomerStatus).set(patch).where(eq(crmCustomerStatus.id, id))
    return StatusRepository.findById(id, db)
  }

  static async softDelete(id: number, db: AppQueryDb = drizzleDb): Promise<void> {
    await db
      .update(crmCustomerStatus)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(crmCustomerStatus.id, id))
  }
}
