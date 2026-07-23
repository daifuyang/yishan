import type { AppQueryDb } from '@/db'
import { CategoriesRepository, type CategoryListQuery, type CreateCategoryInput, type UpdateCategoryInput } from '../repositories/categories.repository.js'

export class CategoriesService {
  constructor(private readonly db: AppQueryDb) {}

  async list(query: CategoryListQuery) {
    const { rows, total } = await CategoriesRepository.list(query, this.db)
    return { total, items: rows, page: query.page ?? 1, pageSize: query.pageSize ?? 10 }
  }
  async findById(id: number) {
    const row = await CategoriesRepository.findById(id, this.db)
    if (!row) throw new Error('Category not found')
    return row
  }
  async create(input: CreateCategoryInput) {
    return CategoriesRepository.create(input, this.db)
  }
  async update(id: number, input: UpdateCategoryInput) {
    const existed = await CategoriesRepository.findById(id, this.db)
    if (!existed) throw new Error('Category not found')
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
