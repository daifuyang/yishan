import type { AppQueryDb } from '@/db'
import { ArticlesRepository, type ArticleListQuery, type CreateArticleInput, type UpdateArticleInput } from '../repositories/articles.repository.js'

/**
 * Articles Service：业务编排。
 *
 * 文章支持多分类（多对多，经 portal_article_categories 桥接）。
 * service 拿 db 句柄（构造注入），调 repository；不接触 SQL。
 */

export class ArticlesService {
  constructor(private readonly db: AppQueryDb) {}

  async list(query: ArticleListQuery): Promise<{ total: number; items: Awaited<ReturnType<typeof ArticlesRepository.list>>['rows']; page: number; pageSize: number }> {
    const { rows, total } = await ArticlesRepository.list(query, this.db)
    return { total, items: rows, page: query.page ?? 1, pageSize: query.pageSize ?? 10 }
  }

  async findById(id: number) {
    const row = await ArticlesRepository.findById(id, this.db)
    if (!row) throw new Error('Article not found')
    const categoryIds = await ArticlesRepository.findCategoryIds(id, this.db)
    return { ...row, categoryIds }
  }

  async create(input: CreateArticleInput) {
    return ArticlesRepository.create(input, this.db)
  }

  async update(id: number, input: UpdateArticleInput) {
    const existed = await ArticlesRepository.findById(id, this.db)
    if (!existed) throw new Error('Article not found')
    const updated = await ArticlesRepository.update(id, input, this.db)
    if (!updated) throw new Error('Article not found')
    return updated
  }

  async remove(id: number): Promise<void> {
    const existed = await ArticlesRepository.findById(id, this.db)
    if (!existed) throw new Error('Article not found')
    await ArticlesRepository.softDelete(id, this.db)
  }

  async publish(id: number, userId: number): Promise<void> {
    const existed = await ArticlesRepository.findById(id, this.db)
    if (!existed) throw new Error('Article not found')
    await ArticlesRepository.update(id, { status: 1, publishTime: new Date(), updaterId: userId }, this.db)
  }
}
