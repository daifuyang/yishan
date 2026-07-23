import { and, desc, eq, inArray, isNull, like, or, type SQL } from 'drizzle-orm'
import { drizzleDb, type AppQueryDb } from '@/db'
import { portalArticles, portalArticleCategories } from '../db/schema.js'

/**
 * portal_articles Repository。
 *
 * 整个 portal 模块内**唯一**允许访问 portalArticles + portalArticleCategories 表的层。
 */

export interface ArticleRow {
  id: number
  title: string
  slug: string | null
  summary: string | null
  content: string
  coverImage: string | null
  status: number
  isPinned: boolean
  publishTime: Date | null
  attributes: unknown
  tags: unknown
  templateId: number | null
  creatorId: number | null
  createdAt: Date
  updaterId: number | null
  updatedAt: Date
}

export interface CreateArticleInput {
  title: string
  slug?: string | null
  summary?: string | null
  content: string
  coverImage?: string | null
  status?: number
  isPinned?: boolean
  publishTime?: Date | null
  attributes?: unknown
  tags?: unknown
  templateId?: number | null
  categoryIds?: number[]
  creatorId: number
  updaterId: number
}

export interface UpdateArticleInput {
  title?: string
  slug?: string | null
  summary?: string | null
  content?: string
  coverImage?: string | null
  status?: number
  isPinned?: boolean
  publishTime?: Date | null
  attributes?: unknown
  tags?: unknown
  templateId?: number | null
  categoryIds?: number[]
  updaterId: number
}

export interface ArticleListQuery {
  page?: number
  pageSize?: number
  keyword?: string
  status?: number
  categoryId?: number
  templateId?: number
}

function buildWhere(opts: ArticleListQuery, db: AppQueryDb): SQL | undefined {
  const conds: SQL[] = [isNull(portalArticles.deletedAt)]
  if (opts.keyword) {
    const k = `%${opts.keyword}%`
    conds.push(or(like(portalArticles.title, k), like(portalArticles.summary, k))!)
  }
  if (opts.status !== undefined) conds.push(eq(portalArticles.status, opts.status))
  if (opts.templateId !== undefined) conds.push(eq(portalArticles.templateId, opts.templateId))
  if (opts.categoryId !== undefined) {
    conds.push(
      inArray(
        portalArticles.id,
        db
          .select({ id: portalArticleCategories.articleId })
          .from(portalArticleCategories)
          .where(eq(portalArticleCategories.categoryId, opts.categoryId)),
      ),
    )
  }
  return and(...conds)
}

export class ArticlesRepository {
  static async list(
    query: ArticleListQuery,
    db: AppQueryDb = drizzleDb,
  ): Promise<{ rows: ArticleRow[]; total: number }> {
    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 10
    const where = buildWhere(query, db)
    const [rows, totalRows] = await Promise.all([
      db
        .select()
        .from(portalArticles)
        .where(where)
        .orderBy(desc(portalArticles.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db.select({ id: portalArticles.id }).from(portalArticles).where(where),
    ])
    return { rows: rows as ArticleRow[], total: totalRows.length }
  }

  static async findById(id: number, db: AppQueryDb = drizzleDb): Promise<ArticleRow | null> {
    const [row] = await db.select().from(portalArticles).where(eq(portalArticles.id, id)).limit(1)
    return (row as ArticleRow | undefined) ?? null
  }

  /** 文章 + 关联分类 id 列表（用于详情） */
  static async findCategoryIds(articleId: number, db: AppQueryDb = drizzleDb): Promise<number[]> {
    const rows = await db
      .select({ id: portalArticleCategories.categoryId })
      .from(portalArticleCategories)
      .where(eq(portalArticleCategories.articleId, articleId))
    return rows.map((r) => r.id)
  }

  static async create(input: CreateArticleInput, db: AppQueryDb = drizzleDb): Promise<ArticleRow> {
    const [inserted] = await db
      .insert(portalArticles)
      .values({
        title: input.title,
        slug: input.slug ?? null,
        summary: input.summary ?? null,
        content: input.content,
        coverImage: input.coverImage ?? null,
        status: input.status ?? 0,
        isPinned: input.isPinned ?? false,
        publishTime: input.publishTime ?? null,
        attributes: input.attributes ?? null,
        tags: input.tags ?? null,
        templateId: input.templateId ?? null,
        creatorId: input.creatorId,
        updaterId: input.updaterId,
      })
      .$returningId()
    if (input.categoryIds && input.categoryIds.length > 0) {
      await db.insert(portalArticleCategories).values(
        input.categoryIds.map((cid) => ({ articleId: inserted.id, categoryId: cid })),
      )
    }
    const created = await ArticlesRepository.findById(inserted.id, db)
    if (!created) throw new Error('Failed to read back created portal article')
    return created
  }

  static async update(
    id: number,
    input: UpdateArticleInput,
    db: AppQueryDb = drizzleDb,
  ): Promise<ArticleRow | null> {
    const patch: Record<string, unknown> = { updatedAt: new Date(), updaterId: input.updaterId }
    if (input.title !== undefined) patch.title = input.title
    if (input.slug !== undefined) patch.slug = input.slug
    if (input.summary !== undefined) patch.summary = input.summary
    if (input.content !== undefined) patch.content = input.content
    if (input.coverImage !== undefined) patch.coverImage = input.coverImage
    if (input.status !== undefined) patch.status = input.status
    if (input.isPinned !== undefined) patch.isPinned = input.isPinned
    if (input.publishTime !== undefined) patch.publishTime = input.publishTime
    if (input.attributes !== undefined) patch.attributes = input.attributes
    if (input.tags !== undefined) patch.tags = input.tags
    if (input.templateId !== undefined) patch.templateId = input.templateId
    await db.update(portalArticles).set(patch).where(eq(portalArticles.id, id))
    if (input.categoryIds !== undefined) {
      // 整集合替换
      await db.delete(portalArticleCategories).where(eq(portalArticleCategories.articleId, id))
      if (input.categoryIds.length > 0) {
        await db.insert(portalArticleCategories).values(
          input.categoryIds.map((cid) => ({ articleId: id, categoryId: cid })),
        )
      }
    }
    return ArticlesRepository.findById(id, db)
  }

  static async softDelete(id: number, db: AppQueryDb = drizzleDb): Promise<boolean> {
    await db
      .update(portalArticles)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(portalArticles.id, id))
    return true
  }
}
