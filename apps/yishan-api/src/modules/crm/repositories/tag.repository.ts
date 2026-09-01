import { and, asc, count, eq, isNull, like, ne, type SQL } from 'drizzle-orm'
import { drizzleDb, type AppQueryDb } from '@/db'
import { crmTag } from '../db/schema.js'

/**
 * crm_tag Repository。
 */

export interface TagRow {
  id: number
  name: string
  color: string | null
  enabled: number
  createdAt: Date
  updatedAt: Date
}

export interface CreateTagInput {
  name: string
  color?: string | null
  enabled?: number
}

export interface UpdateTagInput {
  name?: string
  color?: string | null
  enabled?: number
}

export interface TagListQuery {
  page?: number
  pageSize?: number
  keyword?: string
  enabled?: number
}

const tagPublicColumns = {
  id: crmTag.id,
  name: crmTag.name,
  color: crmTag.color,
  enabled: crmTag.enabled,
  createdAt: crmTag.createdAt,
  updatedAt: crmTag.updatedAt,
}

function buildWhere(opts: TagListQuery): SQL | undefined {
  const conds: SQL[] = [isNull(crmTag.deletedAt)]
  if (opts.keyword) {
    const k = `%${opts.keyword}%`
    conds.push(like(crmTag.name, k))
  }
  if (opts.enabled !== undefined) conds.push(eq(crmTag.enabled, opts.enabled))
  return and(...conds)
}

export class TagRepository {
  static async list(
    query: TagListQuery,
    db: AppQueryDb = drizzleDb,
  ): Promise<{ rows: TagRow[]; total: number }> {
    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 200
    const where = buildWhere(query)

    const [rows, totalRow] = await Promise.all([
      db
        .select(tagPublicColumns)
        .from(crmTag)
        .where(where)
        .orderBy(asc(crmTag.id))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db.select({ c: count() }).from(crmTag).where(where),
    ])
    return { rows: rows as TagRow[], total: Number(totalRow[0]?.c ?? 0) }
  }

  static async listAllEnabled(db: AppQueryDb = drizzleDb): Promise<TagRow[]> {
    const rows = await db
      .select(tagPublicColumns)
      .from(crmTag)
      .where(and(eq(crmTag.enabled, 1), isNull(crmTag.deletedAt)))
      .orderBy(asc(crmTag.id))
    return rows as TagRow[]
  }

  static async findById(
    id: number,
    db: AppQueryDb = drizzleDb,
  ): Promise<TagRow | null> {
    const [row] = await db
      .select(tagPublicColumns)
      .from(crmTag)
      .where(and(eq(crmTag.id, id), isNull(crmTag.deletedAt)))
      .limit(1)
    return (row as TagRow | undefined) ?? null
  }

  static async findByName(
    name: string,
    excludeId: number | undefined,
    db: AppQueryDb = drizzleDb,
  ): Promise<TagRow | null> {
    const conds: SQL[] = [eq(crmTag.name, name), isNull(crmTag.deletedAt)]
    if (excludeId !== undefined) conds.push(ne(crmTag.id, excludeId))
    const [row] = await db
      .select(tagPublicColumns)
      .from(crmTag)
      .where(and(...conds))
      .limit(1)
    return (row as TagRow | undefined) ?? null
  }

  static async create(input: CreateTagInput, db: AppQueryDb = drizzleDb): Promise<TagRow> {
    const [inserted] = await db
      .insert(crmTag)
      .values({
        name: input.name,
        color: input.color ?? null,
        enabled: input.enabled ?? 1,
      })
      .$returningId()
    const created = await TagRepository.findById(inserted.id, db)
    if (!created) throw new Error('Failed to read back created crm tag')
    return created
  }

  static async update(
    id: number,
    input: UpdateTagInput,
    db: AppQueryDb = drizzleDb,
  ): Promise<TagRow | null> {
    const patch: Record<string, unknown> = { updatedAt: new Date() }
    if (input.name !== undefined) patch.name = input.name
    if (input.color !== undefined) patch.color = input.color
    if (input.enabled !== undefined) patch.enabled = input.enabled
    await db.update(crmTag).set(patch).where(eq(crmTag.id, id))
    return TagRepository.findById(id, db)
  }

  static async softDelete(id: number, db: AppQueryDb = drizzleDb): Promise<void> {
    await db
      .update(crmTag)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(crmTag.id, id))
  }
}
