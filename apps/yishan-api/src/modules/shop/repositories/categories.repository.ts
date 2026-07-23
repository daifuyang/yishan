import { and, desc, eq, isNull, like, or, type SQL } from 'drizzle-orm'
import { drizzleDb, type AppQueryDb } from '@/db'
import { shopCategories } from '../db/schema.js'

export interface CategoryRow {
  id: number
  name: string
  parentId: number | null
  coverImage: string | null
  icon: string | null
  description: string | null
  sortOrder: number
  status: number
  creatorId: number
  createdAt: Date
  updaterId: number
  updatedAt: Date
}

export interface CreateCategoryInput {
  name: string
  parentId?: number | null
  coverImage?: string | null
  icon?: string | null
  description?: string | null
  sortOrder?: number
  status?: number
  creatorId: number
  updaterId: number
}

export interface UpdateCategoryInput {
  name?: string
  parentId?: number | null
  coverImage?: string | null
  icon?: string | null
  description?: string | null
  sortOrder?: number
  status?: number
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
  const conds: SQL[] = [isNull(shopCategories.deletedAt)]
  if (opts.keyword) {
    const k = `%${opts.keyword}%`
    conds.push(or(like(shopCategories.name, k), like(shopCategories.description, k))!)
  }
  if (opts.parentId !== undefined) conds.push(eq(shopCategories.parentId, opts.parentId))
  if (opts.status !== undefined) conds.push(eq(shopCategories.status, opts.status))
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
      db.select().from(shopCategories).where(where).orderBy(desc(shopCategories.sortOrder)).limit(pageSize).offset((page - 1) * pageSize),
      db.select({ id: shopCategories.id }).from(shopCategories).where(where),
    ])
    return { rows: rows as CategoryRow[], total: totalRows.length }
  }

  static async findById(id: number, db: AppQueryDb = drizzleDb): Promise<CategoryRow | null> {
    const [row] = await db.select().from(shopCategories).where(eq(shopCategories.id, id)).limit(1)
    return (row as CategoryRow | undefined) ?? null
  }

  static async create(input: CreateCategoryInput, db: AppQueryDb = drizzleDb): Promise<CategoryRow> {
    const [inserted] = await db.insert(shopCategories).values(input).$returningId()
    const created = await CategoriesRepository.findById(inserted.id, db)
    if (!created) throw new Error('Failed to read back created shop category')
    return created
  }

  static async update(id: number, input: UpdateCategoryInput, db: AppQueryDb = drizzleDb): Promise<CategoryRow | null> {
    const patch = { ...input, updatedAt: new Date() }
    await db.update(shopCategories).set(patch).where(eq(shopCategories.id, id))
    return CategoriesRepository.findById(id, db)
  }

  static async softDelete(id: number, db: AppQueryDb = drizzleDb): Promise<boolean> {
    await db.update(shopCategories).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(shopCategories.id, id))
    return true
  }
}
