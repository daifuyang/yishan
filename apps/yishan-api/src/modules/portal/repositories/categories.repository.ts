import { and, asc, eq, isNull, like, ne, or, type SQL } from 'drizzle-orm'
import { drizzleDb, type AppQueryDb } from '@/db'
import { portalCategories } from '../db/schema.js'

/**
 * portal_categories Repository。
 *
 * 整个 portal 模块内**唯一**允许访问 portalCategories 表的层。
 * service / routes / module.ts 禁止直接 import db 或 schema。
 */

export interface CategoryRow {
  id: number
  name: string
  slug: string | null
  parentId: number | null
  status: number
  sortOrder: number
  description: string | null
  creatorId: number | null
  createdAt: Date
  updaterId: number | null
  updatedAt: Date
}

export interface CreateCategoryInput {
  name: string
  slug?: string | null
  parentId?: number | null
  status?: number
  sortOrder?: number
  description?: string | null
  creatorId: number
  updaterId: number
}

export interface UpdateCategoryInput {
  name?: string
  slug?: string | null
  parentId?: number | null
  status?: number
  sortOrder?: number
  description?: string | null
  updaterId: number
}

export interface CategoryListQuery {
  page?: number
  pageSize?: number
  keyword?: string
  parentId?: number
  status?: number
}

function buildWhere(opts: CategoryListQuery): SQL | undefined {
  const conds: SQL[] = [isNull(portalCategories.deletedAt)]
  if (opts.keyword) {
    const k = `%${opts.keyword}%`
    conds.push(or(like(portalCategories.name, k), like(portalCategories.description, k))!)
  }
  if (opts.parentId !== undefined) conds.push(eq(portalCategories.parentId, opts.parentId))
  if (opts.status !== undefined) conds.push(eq(portalCategories.status, opts.status))
  return and(...conds)
}

export class CategoriesRepository {
  static async list(
    query: CategoryListQuery,
    db: AppQueryDb = drizzleDb,
  ): Promise<{ rows: CategoryRow[]; total: number }> {
    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 10
    const where = buildWhere(query)
    const [rows, totalRows] = await Promise.all([
      db
        .select()
        .from(portalCategories)
        .where(where)
        .orderBy(asc(portalCategories.sortOrder))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db.select({ id: portalCategories.id }).from(portalCategories).where(where),
    ])
    return { rows: rows as CategoryRow[], total: totalRows.length }
  }

  static async findById(id: number, db: AppQueryDb = drizzleDb): Promise<CategoryRow | null> {
    const [row] = await db.select().from(portalCategories).where(eq(portalCategories.id, id)).limit(1)
    return (row as CategoryRow | undefined) ?? null
  }

  /**
   * 查同 parent 下同名（用于 create/update 时去重）。
   * `excludeId` 用于 update 跳过自己。
   */
  static async findByNameAndParent(
    name: string,
    parentId: number | null,
    excludeId: number | undefined,
    db: AppQueryDb = drizzleDb,
  ): Promise<CategoryRow | null> {
    const conds: SQL[] = [eq(portalCategories.name, name), isNull(portalCategories.deletedAt)]
    if (parentId === null) conds.push(isNull(portalCategories.parentId))
    else conds.push(eq(portalCategories.parentId, parentId))
    if (excludeId !== undefined) conds.push(ne(portalCategories.id, excludeId))
    const [row] = await db
      .select()
      .from(portalCategories)
      .where(and(...conds))
      .limit(1)
    return (row as CategoryRow | undefined) ?? null
  }

  static async create(input: CreateCategoryInput, db: AppQueryDb = drizzleDb): Promise<CategoryRow> {
    const [inserted] = await db
      .insert(portalCategories)
      .values({
        name: input.name,
        slug: input.slug ?? input.name,
        parentId: input.parentId ?? null,
        status: input.status ?? 1,
        sortOrder: input.sortOrder ?? 0,
        description: input.description ?? null,
        creatorId: input.creatorId,
        updaterId: input.updaterId,
      })
      .$returningId()
    const created = await CategoriesRepository.findById(inserted.id, db)
    if (!created) throw new Error('Failed to read back created portal category')
    return created
  }

  static async update(
    id: number,
    input: UpdateCategoryInput,
    db: AppQueryDb = drizzleDb,
  ): Promise<CategoryRow | null> {
    const patch: Record<string, unknown> = { updatedAt: new Date(), updaterId: input.updaterId }
    if (input.name !== undefined) patch.name = input.name
    if (input.slug !== undefined) patch.slug = input.slug
    if (input.parentId !== undefined) patch.parentId = input.parentId
    if (input.status !== undefined) patch.status = input.status
    if (input.sortOrder !== undefined) patch.sortOrder = input.sortOrder
    if (input.description !== undefined) patch.description = input.description
    await db.update(portalCategories).set(patch).where(eq(portalCategories.id, id))
    return CategoriesRepository.findById(id, db)
  }

  static async softDelete(id: number, db: AppQueryDb = drizzleDb): Promise<boolean> {
    await db
      .update(portalCategories)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(portalCategories.id, id))
    return true
  }
}
