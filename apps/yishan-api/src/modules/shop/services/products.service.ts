import type { AppQueryDb } from '@/db'
import {
  ProductsRepository,
  type CreateProductInput,
  type CreateSkuInput,
  type ProductListQuery,
  type UpdateProductInput,
  type UpdateSkuInput,
} from '../repositories/products.repository.js'

export class ProductsService {
  constructor(private readonly db: AppQueryDb) {}

  async list(query: ProductListQuery) {
    const { rows, total } = await ProductsRepository.list(query, this.db)
    return { total, items: rows, page: query.page ?? 1, pageSize: query.pageSize ?? 10 }
  }
  async findById(id: number) {
    const row = await ProductsRepository.findById(id, this.db)
    if (!row) throw new Error('Product not found')
    return row
  }
  async create(input: CreateProductInput) {
    return ProductsRepository.create(input, this.db)
  }
  async update(id: number, input: UpdateProductInput) {
    const existed = await ProductsRepository.findById(id, this.db)
    if (!existed) throw new Error('Product not found')
    const updated = await ProductsRepository.update(id, input, this.db)
    if (!updated) throw new Error('Product not found')
    return updated
  }
  async remove(id: number): Promise<void> {
    const existed = await ProductsRepository.findById(id, this.db)
    if (!existed) throw new Error('Product not found')
    await ProductsRepository.softDelete(id, this.db)
  }

  // skus
  async listSkus(productId: number) {
    return ProductsRepository.listSkus(productId, this.db)
  }
  async createSku(input: CreateSkuInput) {
    return ProductsRepository.createSku(input, this.db)
  }
  async updateSku(id: number, input: UpdateSkuInput) {
    const existed = await ProductsRepository.findSkuById(id, this.db)
    if (!existed) throw new Error('SKU not found')
    const updated = await ProductsRepository.updateSku(id, input, this.db)
    if (!updated) throw new Error('SKU not found')
    return updated
  }
  async removeSku(id: number): Promise<void> {
    const existed = await ProductsRepository.findSkuById(id, this.db)
    if (!existed) throw new Error('SKU not found')
    await ProductsRepository.softDeleteSku(id, this.db)
  }
}
