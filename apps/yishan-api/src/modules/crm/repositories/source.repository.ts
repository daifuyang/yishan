import { and, asc, count, eq, isNull, like, ne, type SQL } from 'drizzle-orm'
import { drizzleDb, type AppQueryDb } from '@/db'
import { crmCustomerSource } from '../db/schema.js'

/**
 * crm_customer_source Repository。
 */

export interface SourceRow {
  id: number
  name: string
  code: string | null
  sort: number
  enabled: number
  createdAt: Date
  updatedAt: Date
}

export interface CreateSourceInput {
  name: string
  code?: string | null
  sort?: number
  enabled?: number
}

export interface UpdateSourceInput {
  name?: string
  sort?: number
  enabled?: number
}

export interface SourceListQuery {
  page?: number
  pageSize?: number
  keyword?: string
  enabled?: number
}

const sourcePublicColumns = {
  id: crmCustomerSource.id,
  name: crmCustomerSource.name,
  code: crmCustomerSource.code,
  sort: crmCustomerSource.sort,
  enabled: crmCustomerSource.enabled,
  createdAt: crmCustomerSource.createdAt,
  updatedAt: crmCustomerSource.updatedAt,
}

function buildWhere(opts: SourceListQuery): SQL | undefined {
  const conds: SQL[] = [isNull(crmCustomerSource.deletedAt)]
  if (opts.keyword) {
    conds.push(like(crmCustomerSource.name, `%${opts.keyword}%`))
  }
  if (opts.enabled !== undefined) conds.push(eq(crmCustomerSource.enabled, opts.enabled))
  return and(...conds)
}

export class SourceRepository {
  static async list(
    query: SourceListQuery,
    db: AppQueryDb = drizzleDb,
  ): Promise<{ rows: SourceRow[]; total: number }> {
    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 200
    const where = buildWhere(query)
    const [rows, totalRow] = await Promise.all([
      db
        .select(sourcePublicColumns)
        .from(crmCustomerSource)
        .where(where)
        .orderBy(asc(crmCustomerSource.sort), asc(crmCustomerSource.id))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db.select({ c: count() }).from(crmCustomerSource).where(where),
    ])
    return { rows: rows as SourceRow[], total: Number(totalRow[0]?.c ?? 0) }
  }

  static async findById(
    id: number,
    db: AppQueryDb = drizzleDb,
  ): Promise<SourceRow | null> {
    const [row] = await db
      .select(sourcePublicColumns)
      .from(crmCustomerSource)
      .where(and(eq(crmCustomerSource.id, id), isNull(crmCustomerSource.deletedAt)))
      .limit(1)
    return (row as SourceRow | undefined) ?? null
  }

  static async findByName(
    name: string,
    excludeId: number | undefined,
    db: AppQueryDb = drizzleDb,
  ): Promise<SourceRow | null> {
    const conds: SQL[] = [eq(crmCustomerSource.name, name), isNull(crmCustomerSource.deletedAt)]
    if (excludeId !== undefined) conds.push(ne(crmCustomerSource.id, excludeId))
    const [row] = await db
      .select(sourcePublicColumns)
      .from(crmCustomerSource)
      .where(and(...conds))
      .limit(1)
    return (row as SourceRow | undefined) ?? null
  }

  static async create(
    input: CreateSourceInput,
    db: AppQueryDb = drizzleDb,
  ): Promise<SourceRow> {
    const [inserted] = await db
      .insert(crmCustomerSource)
      .values({
        name: input.name,
        code: input.code ?? null,
        sort: input.sort ?? 0,
        enabled: input.enabled ?? 1,
      })
      .$returningId()
    const created = await SourceRepository.findById(inserted.id, db)
    if (!created) throw new Error('Failed to read back created crm source')
    return created
  }

  static async update(
    id: number,
    input: UpdateSourceInput,
    db: AppQueryDb = drizzleDb,
  ): Promise<SourceRow | null> {
    const patch: Record<string, unknown> = { updatedAt: new Date() }
    if (input.name !== undefined) patch.name = input.name
    if (input.sort !== undefined) patch.sort = input.sort
    if (input.enabled !== undefined) patch.enabled = input.enabled
    await db.update(crmCustomerSource).set(patch).where(eq(crmCustomerSource.id, id))
    return SourceRepository.findById(id, db)
  }

  static async softDelete(id: number, db: AppQueryDb = drizzleDb): Promise<void> {
    await db
      .update(crmCustomerSource)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(crmCustomerSource.id, id))
  }
}
