import { and, desc, eq, isNull, like, or, type SQL } from 'drizzle-orm'
import { drizzleDb, type AppQueryDb } from '@/db'
import { portalPages } from '../db/schema.js'

/**
 * portal_pages Repository。
 */

export interface PageRow {
  id: number
  title: string
  path: string
  content: string
  status: number
  attributes: unknown
  publishTime: Date | null
  templateId: number | null
  creatorId: number | null
  createdAt: Date
  updaterId: number | null
  updatedAt: Date
}

export interface CreatePageInput {
  title: string
  path: string
  content: string
  status?: number
  attributes?: unknown
  publishTime?: Date | null
  templateId?: number | null
  creatorId: number
  updaterId: number
}

export interface UpdatePageInput {
  title?: string
  path?: string
  content?: string
  status?: number
  attributes?: unknown
  publishTime?: Date | null
  templateId?: number | null
  updaterId: number
}

export interface PageListQuery {
  page?: number
  pageSize?: number
  keyword?: string
  status?: number
}

function buildWhere(opts: PageListQuery): SQL | undefined {
  const conds: SQL[] = [isNull(portalPages.deletedAt)]
  if (opts.keyword) {
    const k = `%${opts.keyword}%`
    conds.push(or(like(portalPages.title, k), like(portalPages.path, k))!)
  }
  if (opts.status !== undefined) conds.push(eq(portalPages.status, opts.status))
  return and(...conds)
}

export class PagesRepository {
  static async list(
    query: PageListQuery,
    db: AppQueryDb = drizzleDb,
  ): Promise<{ rows: PageRow[]; total: number }> {
    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 10
    const where = buildWhere(query)
    const [rows, totalRows] = await Promise.all([
      db
        .select()
        .from(portalPages)
        .where(where)
        .orderBy(desc(portalPages.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db.select({ id: portalPages.id }).from(portalPages).where(where),
    ])
    return { rows: rows as PageRow[], total: totalRows.length }
  }

  static async findById(id: number, db: AppQueryDb = drizzleDb): Promise<PageRow | null> {
    const [row] = await db.select().from(portalPages).where(eq(portalPages.id, id)).limit(1)
    return (row as PageRow | undefined) ?? null
  }

  static async findByPath(path: string, db: AppQueryDb = drizzleDb): Promise<PageRow | null> {
    const [row] = await db.select().from(portalPages).where(eq(portalPages.path, path)).limit(1)
    return (row as PageRow | undefined) ?? null
  }

  static async create(input: CreatePageInput, db: AppQueryDb = drizzleDb): Promise<PageRow> {
    const [inserted] = await db
      .insert(portalPages)
      .values({
        title: input.title,
        path: input.path,
        content: input.content,
        status: input.status ?? 1,
        attributes: input.attributes ?? null,
        publishTime: input.publishTime ?? null,
        templateId: input.templateId ?? null,
        creatorId: input.creatorId,
        updaterId: input.updaterId,
      })
      .$returningId()
    const created = await PagesRepository.findById(inserted.id, db)
    if (!created) throw new Error('Failed to read back created portal page')
    return created
  }

  static async update(
    id: number,
    input: UpdatePageInput,
    db: AppQueryDb = drizzleDb,
  ): Promise<PageRow | null> {
    const patch: Record<string, unknown> = { updatedAt: new Date(), updaterId: input.updaterId }
    if (input.title !== undefined) patch.title = input.title
    if (input.path !== undefined) patch.path = input.path
    if (input.content !== undefined) patch.content = input.content
    if (input.status !== undefined) patch.status = input.status
    if (input.attributes !== undefined) patch.attributes = input.attributes
    if (input.publishTime !== undefined) patch.publishTime = input.publishTime
    if (input.templateId !== undefined) patch.templateId = input.templateId
    await db.update(portalPages).set(patch).where(eq(portalPages.id, id))
    return PagesRepository.findById(id, db)
  }

  static async softDelete(id: number, db: AppQueryDb = drizzleDb): Promise<boolean> {
    await db
      .update(portalPages)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(portalPages.id, id))
    return true
  }
}
