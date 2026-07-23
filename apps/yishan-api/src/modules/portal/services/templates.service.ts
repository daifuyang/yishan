import type { AppQueryDb } from '@/db'
import { TemplatesRepository, type CreateTemplateInput, type TemplateListQuery, type UpdateTemplateInput } from '../repositories/templates.repository.js'

/**
 * Templates Service：业务编排。
 *
 * type: 0=文章模板、1=页面模板。type+name 联合唯一。
 * is_system_default=true 的模板不可删除（由调用方约束）。
 */

export class TemplatesService {
  constructor(private readonly db: AppQueryDb) {}

  async list(query: TemplateListQuery): Promise<{ total: number; items: Awaited<ReturnType<typeof TemplatesRepository.list>>['rows']; page: number; pageSize: number }> {
    const { rows, total } = await TemplatesRepository.list(query, this.db)
    return { total, items: rows, page: query.page ?? 1, pageSize: query.pageSize ?? 10 }
  }

  async findById(id: number) {
    const row = await TemplatesRepository.findById(id, this.db)
    if (!row) throw new Error('Template not found')
    return row
  }

  async create(input: CreateTemplateInput) {
    const dupe = await TemplatesRepository.findByTypeAndName(input.type, input.name, undefined, this.db)
    if (dupe) throw new Error('Template with same type and name already exists')
    return TemplatesRepository.create(input, this.db)
  }

  async update(id: number, input: UpdateTemplateInput) {
    const existed = await TemplatesRepository.findById(id, this.db)
    if (!existed) throw new Error('Template not found')
    if (input.type !== undefined || input.name !== undefined) {
      const dupe = await TemplatesRepository.findByTypeAndName(
        input.type ?? existed.type,
        input.name ?? existed.name,
        id,
        this.db,
      )
      if (dupe) throw new Error('Template with same type and name already exists')
    }
    const updated = await TemplatesRepository.update(id, input, this.db)
    if (!updated) throw new Error('Template not found')
    return updated
  }

  async remove(id: number): Promise<void> {
    const existed = await TemplatesRepository.findById(id, this.db)
    if (!existed) throw new Error('Template not found')
    if (existed.isSystemDefault) throw new Error('System default template cannot be deleted')
    await TemplatesRepository.softDelete(id, this.db)
  }
}
