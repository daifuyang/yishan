import type { AppQueryDb } from '@/db'
import {
  AttributesRepository,
  type AttributeListQuery,
  type CreateAttributeInput,
  type CreateAttributeValueInput,
  type UpdateAttributeInput,
} from '../repositories/attributes.repository.js'

export class AttributesService {
  constructor(private readonly db: AppQueryDb) {}

  async list(query: AttributeListQuery) {
    const { rows, total } = await AttributesRepository.list(query, this.db)
    return { total, items: rows, page: query.page ?? 1, pageSize: query.pageSize ?? 10 }
  }
  async findById(id: number) {
    const row = await AttributesRepository.findById(id, this.db)
    if (!row) throw new Error('Attribute not found')
    return row
  }
  async create(input: CreateAttributeInput) {
    return AttributesRepository.create(input, this.db)
  }
  async update(id: number, input: UpdateAttributeInput) {
    const existed = await AttributesRepository.findById(id, this.db)
    if (!existed) throw new Error('Attribute not found')
    const updated = await AttributesRepository.update(id, input, this.db)
    if (!updated) throw new Error('Attribute not found')
    return updated
  }
  async remove(id: number): Promise<void> {
    const existed = await AttributesRepository.findById(id, this.db)
    if (!existed) throw new Error('Attribute not found')
    await AttributesRepository.softDelete(id, this.db)
  }

  // values
  async listValues(attributeId: number) {
    return AttributesRepository.listValues(attributeId, this.db)
  }
  async createValue(input: CreateAttributeValueInput) {
    return AttributesRepository.createValue(input, this.db)
  }
  async deleteValues(attributeId: number) {
    await AttributesRepository.deleteValues(attributeId, this.db)
  }
}
