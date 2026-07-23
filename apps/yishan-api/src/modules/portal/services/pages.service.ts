import type { AppQueryDb } from '@/db'
import { PagesRepository, type CreatePageInput, type PageListQuery, type UpdatePageInput } from '../repositories/pages.repository.js'

/**
 * Pages Service：业务编排。
 *
 * page.path 在 UI 通常是 URL path（例：/about）。同一 path 在同状态（active）下唯一；
 * 软删除（deletedAt）后允许复用 path。
 */

export class PagesService {
  constructor(private readonly db: AppQueryDb) {}

  async list(query: PageListQuery): Promise<{ total: number; items: Awaited<ReturnType<typeof PagesRepository.list>>['rows']; page: number; pageSize: number }> {
    const { rows, total } = await PagesRepository.list(query, this.db)
    return { total, items: rows, page: query.page ?? 1, pageSize: query.pageSize ?? 10 }
  }

  async findById(id: number) {
    const row = await PagesRepository.findById(id, this.db)
    if (!row) throw new Error('Page not found')
    return row
  }

  async create(input: CreatePageInput) {
    return PagesRepository.create(input, this.db)
  }

  async update(id: number, input: UpdatePageInput) {
    const existed = await PagesRepository.findById(id, this.db)
    if (!existed) throw new Error('Page not found')
    const updated = await PagesRepository.update(id, input, this.db)
    if (!updated) throw new Error('Page not found')
    return updated
  }

  async remove(id: number): Promise<void> {
    const existed = await PagesRepository.findById(id, this.db)
    if (!existed) throw new Error('Page not found')
    await PagesRepository.softDelete(id, this.db)
  }
}
