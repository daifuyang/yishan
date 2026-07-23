import { and, desc, eq, isNull, like, or, type SQL } from 'drizzle-orm'
import { drizzleDb, type AppQueryDb } from '@/db'
import { shopProducts, shopProductSkus, shopSkuAttributes } from '../db/schema.js'

export interface ProductRow {
  id: number
  categoryId: number
  name: string
  subtitle: string | null
  coverImage: string | null
  images: unknown
  description: string | null
  price: string
  costPrice: string | null
  stock: number
  unit: string
  weight: string | null
  status: number
  isHot: boolean
  isNew: boolean
  sortOrder: number
  clickCount: number
  creatorId: number
  createdAt: Date
  updaterId: number
  updatedAt: Date
}

export interface SkuRow {
  id: number
  productId: number
  skuCode: string
  skuName: string
  price: string
  costPrice: string | null
  stock: number
  weight: string | null
  coverImage: string | null
  status: number
  creatorId: number
  createdAt: Date
  updaterId: number
  updatedAt: Date
}

export interface CreateProductInput {
  categoryId: number
  name: string
  subtitle?: string | null
  coverImage?: string | null
  images?: unknown
  description?: string | null
  price: string
  costPrice?: string | null
  stock?: number
  unit?: string
  weight?: string | null
  status?: number
  isHot?: boolean
  isNew?: boolean
  sortOrder?: number
  creatorId: number
  updaterId: number
}

export interface UpdateProductInput {
  categoryId?: number
  name?: string
  subtitle?: string | null
  coverImage?: string | null
  images?: unknown
  description?: string | null
  price?: string
  costPrice?: string | null
  stock?: number
  unit?: string
  weight?: string | null
  status?: number
  isHot?: boolean
  isNew?: boolean
  sortOrder?: number
  updaterId: number
}

export interface CreateSkuInput {
  productId: number
  skuCode: string
  skuName: string
  price: string
  costPrice?: string | null
  stock?: number
  weight?: string | null
  coverImage?: string | null
  status?: number
  creatorId: number
  updaterId: number
  attributeValueIds?: number[]
}

export interface UpdateSkuInput {
  skuCode?: string
  skuName?: string
  price?: string
  costPrice?: string | null
  stock?: number
  weight?: string | null
  coverImage?: string | null
  status?: number
  updaterId: number
  attributeValueIds?: number[]
}

export interface ProductListQuery {
  page?: number
  pageSize?: number
  keyword?: string
  categoryId?: number
  status?: number
  isHot?: boolean
  isNew?: boolean
}

function buildWhere(opts: ProductListQuery): SQL | undefined {
  const conds: SQL[] = [isNull(shopProducts.deletedAt)]
  if (opts.keyword) {
    const k = `%${opts.keyword}%`
    conds.push(or(like(shopProducts.name, k), like(shopProducts.subtitle, k))!)
  }
  if (opts.categoryId !== undefined) conds.push(eq(shopProducts.categoryId, opts.categoryId))
  if (opts.status !== undefined) conds.push(eq(shopProducts.status, opts.status))
  if (opts.isHot !== undefined) conds.push(eq(shopProducts.isHot, opts.isHot))
  if (opts.isNew !== undefined) conds.push(eq(shopProducts.isNew, opts.isNew))
  return and(...conds)
}

export class ProductsRepository {
  static async list(
    query: ProductListQuery,
    db: AppQueryDb = drizzleDb,
  ): Promise<{ rows: ProductRow[]; total: number }> {
    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 10
    const where = buildWhere(query)
    const [rows, totalRows] = await Promise.all([
      db.select().from(shopProducts).where(where).orderBy(desc(shopProducts.sortOrder)).limit(pageSize).offset((page - 1) * pageSize),
      db.select({ id: shopProducts.id }).from(shopProducts).where(where),
    ])
    return { rows: rows as ProductRow[], total: totalRows.length }
  }

  static async findById(id: number, db: AppQueryDb = drizzleDb): Promise<ProductRow | null> {
    const [row] = await db.select().from(shopProducts).where(eq(shopProducts.id, id)).limit(1)
    return (row as ProductRow | undefined) ?? null
  }

  static async create(input: CreateProductInput, db: AppQueryDb = drizzleDb): Promise<ProductRow> {
    const [inserted] = await db.insert(shopProducts).values(input).$returningId()
    const created = await ProductsRepository.findById(inserted.id, db)
    if (!created) throw new Error('Failed to read back created shop product')
    return created
  }

  static async update(id: number, input: UpdateProductInput, db: AppQueryDb = drizzleDb): Promise<ProductRow | null> {
    await db.update(shopProducts).set({ ...input, updatedAt: new Date() }).where(eq(shopProducts.id, id))
    return ProductsRepository.findById(id, db)
  }

  static async softDelete(id: number, db: AppQueryDb = drizzleDb): Promise<boolean> {
    await db.update(shopProducts).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(shopProducts.id, id))
    return true
  }

  // ─── skus ───
  static async listSkus(productId: number, db: AppQueryDb = drizzleDb): Promise<SkuRow[]> {
    const rows = await db
      .select()
      .from(shopProductSkus)
      .where(and(eq(shopProductSkus.productId, productId), isNull(shopProductSkus.deletedAt)))
      .orderBy(desc(shopProductSkus.createdAt))
    return rows as SkuRow[]
  }

  static async findSkuById(id: number, db: AppQueryDb = drizzleDb): Promise<SkuRow | null> {
    const [row] = await db.select().from(shopProductSkus).where(eq(shopProductSkus.id, id)).limit(1)
    return (row as SkuRow | undefined) ?? null
  }

  static async createSku(input: CreateSkuInput, db: AppQueryDb = drizzleDb): Promise<SkuRow> {
    const { attributeValueIds, ...skuInput } = input
    const [inserted] = await db.insert(shopProductSkus).values(skuInput).$returningId()
    if (attributeValueIds && attributeValueIds.length > 0) {
      // 需要 attributeId：通常 attribute_value 列表里有；这里简化做法是每个 value 单独查 attributeId。
      // 这里按调用方传入的 mapping 处理；详见 service 层。
    }
    const created = await ProductsRepository.findSkuById(inserted.id, db)
    if (!created) throw new Error('Failed to read back created shop sku')
    return created
  }

  static async updateSku(id: number, input: UpdateSkuInput, db: AppQueryDb = drizzleDb): Promise<SkuRow | null> {
    const { attributeValueIds, ...skuInput } = input
    await db.update(shopProductSkus).set({ ...skuInput, updatedAt: new Date() }).where(eq(shopProductSkus.id, id))
    return ProductsRepository.findSkuById(id, db)
  }

  static async softDeleteSku(id: number, db: AppQueryDb = drizzleDb): Promise<boolean> {
    await db.update(shopProductSkus).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(shopProductSkus.id, id))
    return true
  }

  static async setSkuAttributes(
    skuId: number,
    pairs: Array<{ attributeId: number; valueId: number }>,
    db: AppQueryDb = drizzleDb,
  ): Promise<void> {
    await db.delete(shopSkuAttributes).where(eq(shopSkuAttributes.skuId, skuId))
    if (pairs.length > 0) {
      await db.insert(shopSkuAttributes).values(pairs.map((p) => ({ skuId, attributeId: p.attributeId, valueId: p.valueId })))
    }
  }
}
