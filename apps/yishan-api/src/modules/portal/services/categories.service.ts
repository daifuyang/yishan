import type { AppQueryDb } from '@/db'
import { CategoriesRepository, type CategoryListQuery, type CreateCategoryInput, type UpdateCategoryInput } from '../repositories/categories.repository.js'

/**
 * Categories Service：业务编排。
 *
 * service 拿 db 句柄（构造注入），调 repository；不接触 SQL。
 */

export class CategoriesService {
  constructor(private readonly db: AppQueryDb) {}

  async list(query: CategoryListQuery): Promise<{ total: number; items: Awaited<ReturnType<typeof CategoriesRepository.list>>['rows']; page: number; pageSize: number }> {
    const { rows, total } = await CategoriesRepository.list(query, this.db)
    return { total, items: rows, page: query.page ?? 1, pageSize: query.pageSize ?? 10 }
  }

  async findById(id: number) {
    const row = await CategoriesRepository.findById(id, this.db)
    if (!row) throw new Error('Category not found')
    return row
  }

  async create(input: CreateCategoryInput) {
    const dupe = await CategoriesRepository.findByNameAndParent(input.name, input.parentId ?? null, undefined, this.db)
    if (dupe) throw new Error('Category already exists under the same parent')
    return CategoriesRepository.create(input, this.db)
  }

  async update(id: number, input: UpdateCategoryInput) {
    const existed = await CategoriesRepository.findById(id, this.db)
    if (!existed) throw new Error('Category not found')
    if (input.name !== undefined) {
      const dupe = await CategoriesRepository.findByNameAndParent(
        input.name,
        input.parentId ?? existed.parentId ?? null,
        id,
        this.db,
      )
      if (dupe) throw new Error('Category already exists under the same parent')
    }
    const updated = await CategoriesRepository.update(id, input, this.db)
    if (!updated) throw new Error('Category not found')
    return updated
  }

  async remove(id: number): Promise<void> {
    const existed = await CategoriesRepository.findById(id, this.db)
    if (!existed) throw new Error('Category not found')
    await CategoriesRepository.softDelete(id, this.db)
  }
}
