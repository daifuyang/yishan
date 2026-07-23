import { and, desc, eq, isNull, like, ne, or, type SQL } from 'drizzle-orm'
import { drizzleDb, type AppQueryDb } from '@/db'
import { portalTemplates } from '../db/schema.js'

/**
 * portal_templates Repository。
 *
 * 模板 type：0=文章模板、1=页面模板。
 */

export interface TemplateRow {
  id: number
  name: string
  description: string | null
  type: number
  schema: unknown
  config: unknown
  status: number
  isSystemDefault: boolean
  creatorId: number | null
  createdAt: Date
  updaterId: number | null
  updatedAt: Date
}

export interface CreateTemplateInput {
  name: string
  description?: string | null
  type: number
  schema?: unknown
  config?: unknown
  status?: number
  isSystemDefault?: boolean
  creatorId: number
  updaterId: number
}

export interface UpdateTemplateInput {
  name?: string
  description?: string | null
  type?: number
  schema?: unknown
  config?: unknown
  status?: number
  isSystemDefault?: boolean
  updaterId: number
}

export interface TemplateListQuery {
  page?: number
  pageSize?: number
  keyword?: string
  type?: number
  status?: number
}

function buildWhere(opts: TemplateListQuery): SQL | undefined {
  const conds: SQL[] = [isNull(portalTemplates.deletedAt)]
  if (opts.keyword) {
    const k = `%${opts.keyword}%`
    conds.push(or(like(portalTemplates.name, k), like(portalTemplates.description, k))!)
  }
  if (opts.type !== undefined) conds.push(eq(portalTemplates.type, opts.type))
  if (opts.status !== undefined) conds.push(eq(portalTemplates.status, opts.status))
  return and(...conds)
}

export class TemplatesRepository {
  static async list(
    query: TemplateListQuery,
    db: AppQueryDb = drizzleDb,
  ): Promise<{ rows: TemplateRow[]; total: number }> {
    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 10
    const where = buildWhere(query)
    const [rows, totalRows] = await Promise.all([
      db
        .select()
        .from(portalTemplates)
        .where(where)
        .orderBy(desc(portalTemplates.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db.select({ id: portalTemplates.id }).from(portalTemplates).where(where),
    ])
    return { rows: rows as TemplateRow[], total: totalRows.length }
  }

  static async findById(id: number, db: AppQueryDb = drizzleDb): Promise<TemplateRow | null> {
    const [row] = await db.select().from(portalTemplates).where(eq(portalTemplates.id, id)).limit(1)
    return (row as TemplateRow | undefined) ?? null
  }

  static async findByTypeAndName(
    type: number,
    name: string,
    excludeId: number | undefined,
    db: AppQueryDb = drizzleDb,
  ): Promise<TemplateRow | null> {
    const conds: SQL[] = [
      eq(portalTemplates.type, type),
      eq(portalTemplates.name, name),
      isNull(portalTemplates.deletedAt),
    ]
    if (excludeId !== undefined) {
      conds.push(ne(portalTemplates.id, excludeId))
    }
    const [row] = await db.select().from(portalTemplates).where(and(...conds)).limit(1)
    return (row as TemplateRow | undefined) ?? null
  }

  static async create(input: CreateTemplateInput, db: AppQueryDb = drizzleDb): Promise<TemplateRow> {
    const [inserted] = await db
      .insert(portalTemplates)
      .values({
        name: input.name,
        description: input.description ?? null,
        type: input.type,
        schema: input.schema ?? null,
        config: input.config ?? null,
        status: input.status ?? 1,
        isSystemDefault: input.isSystemDefault ?? false,
        creatorId: input.creatorId,
        updaterId: input.updaterId,
      })
      .$returningId()
    const created = await TemplatesRepository.findById(inserted.id, db)
    if (!created) throw new Error('Failed to read back created portal template')
    return created
  }

  static async update(
    id: number,
    input: UpdateTemplateInput,
    db: AppQueryDb = drizzleDb,
  ): Promise<TemplateRow | null> {
    const patch: Record<string, unknown> = { updatedAt: new Date(), updaterId: input.updaterId }
    if (input.name !== undefined) patch.name = input.name
    if (input.description !== undefined) patch.description = input.description
    if (input.type !== undefined) patch.type = input.type
    if (input.schema !== undefined) patch.schema = input.schema
    if (input.config !== undefined) patch.config = input.config
    if (input.status !== undefined) patch.status = input.status
    if (input.isSystemDefault !== undefined) patch.isSystemDefault = input.isSystemDefault
    await db.update(portalTemplates).set(patch).where(eq(portalTemplates.id, id))
    return TemplatesRepository.findById(id, db)
  }

  static async softDelete(id: number, db: AppQueryDb = drizzleDb): Promise<boolean> {
    await db
      .update(portalTemplates)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(portalTemplates.id, id))
    return true
  }
}
