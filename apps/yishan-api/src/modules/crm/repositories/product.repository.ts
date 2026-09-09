/**
 * 产品目录（Phase 2）Repository。
 *
 * 三个表的薄数据访问层：
 *   - crm_product        ：产品主表，金额用 bigint({ mode: 'number' }) cents
 *   - crm_product_category：分类字典，code 唯一
 *   - crm_unit           ：单位字典，code 唯一
 *
 * 设计原则：
 *   - 业务规则（唯一性、价格合法、税率合法、引用完整性、软删约束）一律放在 service 层。
 *   - Repository 只做"读 / 写 / 软删 / 列"。
 *   - 不在 Repository 内 join 业务表（service 层需要时由 service 自行组合）。
 *   - 金额字段统一为 JS number（cents，safe integer），见 utils/money.ts。
 */
import { and, asc, count, desc, eq, inArray, isNull, like, ne, or, type SQL } from 'drizzle-orm'
import { drizzleDb, type AppQueryDb } from '@/db'
import {
  crmProduct,
  crmProductCategory,
  crmUnit,
} from '../db/schema.js'

/* ─── Types ───────────────────────────────────────── */

/**
 * 排序方向：按 sort ASC 主排序，code 作为 tie-breaker。
 * 服务层负责把 query 翻译成这个 union。
 */
export type SortDir = 'asc' | 'desc'

export interface ProductRow {
  id: number
  code: string
  name: string
  categoryCode: string | null
  categoryName: string | null
  unitCode: string | null
  unitName: string | null
  standardPriceCents: number
  taxRateBp: number
  enabled: number
  description: string | null
  creatorId: number | null
  createdAt: Date
  updaterId: number | null
  updatedAt: Date
}

export interface CategoryRow {
  id: number
  code: string
  name: string
  parentCode: string | null
  sort: number
  enabled: number
  createdAt: Date
  updatedAt: Date
}

export interface UnitRow {
  id: number
  code: string
  name: string
  sort: number
  enabled: number
  createdAt: Date
  updatedAt: Date
}

/* ─── Product ─────────────────────────────────────── */

export interface ProductListQuery {
  page?: number
  pageSize?: number
  keyword?: string
  categoryCode?: string | null
  enabled?: number
  includeDisabled?: boolean
}

export interface CreateProductInput {
  code: string
  name: string
  categoryCode?: string | null
  unitCode?: string | null
  standardPriceCents?: number
  taxRateBp?: number
  enabled?: number
  description?: string | null
  creatorId: number
  updaterId: number
}

export interface UpdateProductInput {
  name?: string
  categoryCode?: string | null
  unitCode?: string | null
  standardPriceCents?: number
  taxRateBp?: number
  enabled?: number
  description?: string | null
  updaterId: number
}

/* ─── Category ────────────────────────────────────── */

export interface CategoryListQuery {
  page?: number
  pageSize?: number
  keyword?: string
  enabled?: number
  includeDisabled?: boolean
}

export interface CreateCategoryInput {
  code: string
  name: string
  parentCode?: string | null
  sort?: number
  enabled?: number
}

export interface UpdateCategoryInput {
  name?: string
  parentCode?: string | null
  sort?: number
  enabled?: number
}

/* ─── Unit ────────────────────────────────────────── */

export interface UnitListQuery {
  page?: number
  pageSize?: number
  keyword?: string
  enabled?: number
  includeDisabled?: boolean
}

export interface CreateUnitInput {
  code: string
  name: string
  sort?: number
  enabled?: number
}

export interface UpdateUnitInput {
  name?: string
  sort?: number
  enabled?: number
}

/* ─── Helpers ─────────────────────────────────────── */

const productColumns = {
  id: crmProduct.id,
  code: crmProduct.code,
  name: crmProduct.name,
  categoryCode: crmProduct.categoryCode,
  categoryName: crmProductCategory.name,
  unitCode: crmProduct.unitCode,
  unitName: crmUnit.name,
  standardPriceCents: crmProduct.standardPriceCents,
  taxRateBp: crmProduct.taxRateBp,
  enabled: crmProduct.enabled,
  description: crmProduct.description,
  creatorId: crmProduct.creatorId,
  createdAt: crmProduct.createdAt,
  updaterId: crmProduct.updaterId,
  updatedAt: crmProduct.updatedAt,
}

const categoryColumns = {
  id: crmProductCategory.id,
  code: crmProductCategory.code,
  name: crmProductCategory.name,
  parentCode: crmProductCategory.parentCode,
  sort: crmProductCategory.sort,
  enabled: crmProductCategory.enabled,
  createdAt: crmProductCategory.createdAt,
  updatedAt: crmProductCategory.updatedAt,
}

const unitColumns = {
  id: crmUnit.id,
  code: crmUnit.code,
  name: crmUnit.name,
  sort: crmUnit.sort,
  enabled: crmUnit.enabled,
  createdAt: crmUnit.createdAt,
  updatedAt: crmUnit.updatedAt,
}

function buildProductWhere(opts: ProductListQuery): SQL | undefined {
  const conds: SQL[] = [isNull(crmProduct.deletedAt)]
  if (opts.keyword) {
    const k = `%${opts.keyword}%`
    conds.push(or(like(crmProduct.code, k), like(crmProduct.name, k))!)
  }
  if (opts.categoryCode !== undefined && opts.categoryCode !== null) {
    conds.push(eq(crmProduct.categoryCode, opts.categoryCode))
  }
  if (!opts.includeDisabled) {
    if (opts.enabled !== undefined) {
      conds.push(eq(crmProduct.enabled, opts.enabled))
    } else {
      conds.push(eq(crmProduct.enabled, 1))
    }
  } else if (opts.enabled !== undefined) {
    conds.push(eq(crmProduct.enabled, opts.enabled))
  }
  return and(...conds)
}

function buildCategoryWhere(opts: CategoryListQuery): SQL | undefined {
  const conds: SQL[] = [isNull(crmProductCategory.deletedAt)]
  if (opts.keyword) {
    conds.push(or(
      like(crmProductCategory.code, `%${opts.keyword}%`),
      like(crmProductCategory.name, `%${opts.keyword}%`),
    )!)
  }
  if (!opts.includeDisabled) {
    if (opts.enabled !== undefined) {
      conds.push(eq(crmProductCategory.enabled, opts.enabled))
    } else {
      conds.push(eq(crmProductCategory.enabled, 1))
    }
  } else if (opts.enabled !== undefined) {
    conds.push(eq(crmProductCategory.enabled, opts.enabled))
  }
  return and(...conds)
}

function buildUnitWhere(opts: UnitListQuery): SQL | undefined {
  const conds: SQL[] = [isNull(crmUnit.deletedAt)]
  if (opts.keyword) {
    conds.push(or(
      like(crmUnit.code, `%${opts.keyword}%`),
      like(crmUnit.name, `%${opts.keyword}%`),
    )!)
  }
  if (!opts.includeDisabled) {
    if (opts.enabled !== undefined) {
      conds.push(eq(crmUnit.enabled, opts.enabled))
    } else {
      conds.push(eq(crmUnit.enabled, 1))
    }
  } else if (opts.enabled !== undefined) {
    conds.push(eq(crmUnit.enabled, opts.enabled))
  }
  return and(...conds)
}

/* ─── ProductRepository ───────────────────────────── */

export class ProductRepository {
  /**
   * 列表：leftJoin 分类 / 单位，拿到 categoryName / unitName；
   * deleted_at IS NULL 始终过滤；默认只看 enabled=1。
   */
  static async list(
    query: ProductListQuery,
    db: AppQueryDb = drizzleDb,
  ): Promise<{ rows: ProductRow[]; total: number }> {
    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 20
    const where = buildProductWhere(query)
    const [rows, totalRow] = await Promise.all([
      db
        .select(productColumns)
        .from(crmProduct)
        .leftJoin(crmProductCategory, and(
          eq(crmProductCategory.code, crmProduct.categoryCode),
          isNull(crmProductCategory.deletedAt),
        ))
        .leftJoin(crmUnit, and(
          eq(crmUnit.code, crmProduct.unitCode),
          isNull(crmUnit.deletedAt),
        ))
        .where(where)
        .orderBy(desc(crmProduct.updatedAt), desc(crmProduct.id))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db.select({ c: count() }).from(crmProduct).where(where),
    ])
    return { rows: rows as ProductRow[], total: Number(totalRow[0]?.c ?? 0) }
  }

  static async findById(
    id: number,
    db: AppQueryDb = drizzleDb,
  ): Promise<ProductRow | null> {
    const [row] = await db
      .select(productColumns)
      .from(crmProduct)
      .leftJoin(crmProductCategory, and(
        eq(crmProductCategory.code, crmProduct.categoryCode),
        isNull(crmProductCategory.deletedAt),
      ))
      .leftJoin(crmUnit, and(
        eq(crmUnit.code, crmProduct.unitCode),
        isNull(crmUnit.deletedAt),
      ))
      .where(and(eq(crmProduct.id, id), isNull(crmProduct.deletedAt)))
      .limit(1)
    return (row as ProductRow | undefined) ?? null
  }

  /**
   * 按 code 查找（含 join）；service 层用来判唯一性 / 取创建后的回读。
   * excludeId 用于 update 时排除自己。
   */
  static async findByCode(
    code: string,
    excludeId: number | undefined,
    db: AppQueryDb = drizzleDb,
  ): Promise<ProductRow | null> {
    const conds: SQL[] = [eq(crmProduct.code, code), isNull(crmProduct.deletedAt)]
    if (excludeId !== undefined) conds.push(ne(crmProduct.id, excludeId))
    const [row] = await db
      .select(productColumns)
      .from(crmProduct)
      .leftJoin(crmProductCategory, and(
        eq(crmProductCategory.code, crmProduct.categoryCode),
        isNull(crmProductCategory.deletedAt),
      ))
      .leftJoin(crmUnit, and(
        eq(crmUnit.code, crmProduct.unitCode),
        isNull(crmUnit.deletedAt),
      ))
      .where(and(...conds))
      .limit(1)
    return (row as ProductRow | undefined) ?? null
  }

  static async create(input: CreateProductInput, db: AppQueryDb = drizzleDb): Promise<ProductRow> {
    const [inserted] = await db
      .insert(crmProduct)
      .values({
        code: input.code,
        name: input.name,
        categoryCode: input.categoryCode ?? null,
        unitCode: input.unitCode ?? null,
        standardPriceCents: input.standardPriceCents ?? 0,
        taxRateBp: input.taxRateBp ?? 0,
        enabled: input.enabled ?? 1,
        description: input.description ?? null,
        creatorId: input.creatorId,
        updaterId: input.updaterId,
      })
      .$returningId()
    const created = await ProductRepository.findById(inserted.id, db)
    if (!created) throw new Error('Failed to read back created crm product')
    return created
  }

  static async update(
    id: number,
    input: UpdateProductInput,
    db: AppQueryDb = drizzleDb,
  ): Promise<ProductRow | null> {
    const patch: Record<string, unknown> = { updatedAt: new Date() }
    if (input.name !== undefined) patch.name = input.name
    if (input.categoryCode !== undefined) patch.categoryCode = input.categoryCode
    if (input.unitCode !== undefined) patch.unitCode = input.unitCode
    if (input.standardPriceCents !== undefined) patch.standardPriceCents = input.standardPriceCents
    if (input.taxRateBp !== undefined) patch.taxRateBp = input.taxRateBp
    if (input.enabled !== undefined) patch.enabled = input.enabled
    if (input.description !== undefined) patch.description = input.description
    patch.updaterId = input.updaterId
    await db
      .update(crmProduct)
      .set(patch)
      .where(and(eq(crmProduct.id, id), isNull(crmProduct.deletedAt)))
    return ProductRepository.findById(id, db)
  }

  /**
   * 软删除：写 deleted_at。报价快照保留 nameSnapshot / unitSnapshot / unitPriceSnapshot /
   * taxRateSnapshot，因此删产品不会破坏历史报价（crm_quotation_item 不在这里创建，
   * Phase 3 报价模块会引用本表 code，本方法只决定 product 列表是否可见）。
   *
   * 返回受影响行数：0 表示不存在或已删除。
   */
  static async softDelete(id: number, db: AppQueryDb = drizzleDb): Promise<number> {
    const result = await db
      .update(crmProduct)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(crmProduct.id, id), isNull(crmProduct.deletedAt)))
    return ((result as unknown as [{ affectedRows?: number } | undefined])[0])?.affectedRows ?? 0
  }
}

/* ─── ProductCategoryRepository ───────────────────── */

export class ProductCategoryRepository {
  static async list(
    query: CategoryListQuery,
    db: AppQueryDb = drizzleDb,
  ): Promise<{ rows: CategoryRow[]; total: number }> {
    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 200
    const where = buildCategoryWhere(query)
    const [rows, totalRow] = await Promise.all([
      db
        .select(categoryColumns)
        .from(crmProductCategory)
        .where(where)
        .orderBy(asc(crmProductCategory.sort), asc(crmProductCategory.id))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db.select({ c: count() }).from(crmProductCategory).where(where),
    ])
    return { rows: rows as CategoryRow[], total: Number(totalRow[0]?.c ?? 0) }
  }

  /**
   * 仅取 enabled=1 的全量分类（不分页），供产品表单下拉用。
   */
  static async listEnabled(db: AppQueryDb = drizzleDb): Promise<CategoryRow[]> {
    const rows = await db
      .select(categoryColumns)
      .from(crmProductCategory)
      .where(and(eq(crmProductCategory.enabled, 1), isNull(crmProductCategory.deletedAt)))
      .orderBy(asc(crmProductCategory.sort), asc(crmProductCategory.id))
    return rows as CategoryRow[]
  }

  static async findByCode(
    code: string,
    excludeId: number | undefined,
    db: AppQueryDb = drizzleDb,
  ): Promise<CategoryRow | null> {
    const conds: SQL[] = [eq(crmProductCategory.code, code), isNull(crmProductCategory.deletedAt)]
    if (excludeId !== undefined) conds.push(ne(crmProductCategory.id, excludeId))
    const [row] = await db
      .select(categoryColumns)
      .from(crmProductCategory)
      .where(and(...conds))
      .limit(1)
    return (row as CategoryRow | undefined) ?? null
  }

  static async findById(
    id: number,
    db: AppQueryDb = drizzleDb,
  ): Promise<CategoryRow | null> {
    const [row] = await db
      .select(categoryColumns)
      .from(crmProductCategory)
      .where(and(eq(crmProductCategory.id, id), isNull(crmProductCategory.deletedAt)))
      .limit(1)
    return (row as CategoryRow | undefined) ?? null
  }

  /**
   * 找到所有以 `parentCode` 为父分类的子分类，用于"分类删除前判断是否还有子节点"。
   * includeDisabled = true 时同时返回 disabled 的子分类，避免边界漏判。
   */
  static async findChildrenByParentCode(
    parentCode: string,
    includeDisabled: boolean,
    db: AppQueryDb = drizzleDb,
  ): Promise<CategoryRow[]> {
    const conds: SQL[] = [eq(crmProductCategory.parentCode, parentCode), isNull(crmProductCategory.deletedAt)]
    if (!includeDisabled) conds.push(eq(crmProductCategory.enabled, 1))
    const rows = await db
      .select(categoryColumns)
      .from(crmProductCategory)
      .where(and(...conds))
    return rows as CategoryRow[]
  }

  /**
   * 找到所有 categoryCode = code 的产品，用于"分类删除前判断是否还有产品引用"。
   * includeDisabled = true 时同时返回 disabled 的产品。
   */
  static async findProductsByCategoryCode(
    code: string,
    includeDisabled: boolean,
    db: AppQueryDb = drizzleDb,
  ): Promise<{ id: number }[]> {
    const conds: SQL[] = [eq(crmProduct.categoryCode, code), isNull(crmProduct.deletedAt)]
    if (!includeDisabled) conds.push(eq(crmProduct.enabled, 1))
    const rows = await db
      .select({ id: crmProduct.id })
      .from(crmProduct)
      .where(and(...conds))
    return rows as { id: number }[]
  }

  static async create(input: CreateCategoryInput, db: AppQueryDb = drizzleDb): Promise<CategoryRow> {
    const [inserted] = await db
      .insert(crmProductCategory)
      .values({
        code: input.code,
        name: input.name,
        parentCode: input.parentCode ?? null,
        sort: input.sort ?? 0,
        enabled: input.enabled ?? 1,
      })
      .$returningId()
    const created = await ProductCategoryRepository.findById(inserted.id, db)
    if (!created) throw new Error('Failed to read back created crm product category')
    return created
  }

  static async update(
    id: number,
    input: UpdateCategoryInput,
    db: AppQueryDb = drizzleDb,
  ): Promise<CategoryRow | null> {
    const patch: Record<string, unknown> = { updatedAt: new Date() }
    if (input.name !== undefined) patch.name = input.name
    if (input.parentCode !== undefined) patch.parentCode = input.parentCode
    if (input.sort !== undefined) patch.sort = input.sort
    if (input.enabled !== undefined) patch.enabled = input.enabled
    await db
      .update(crmProductCategory)
      .set(patch)
      .where(and(eq(crmProductCategory.id, id), isNull(crmProductCategory.deletedAt)))
    return ProductCategoryRepository.findById(id, db)
  }

  static async softDelete(id: number, db: AppQueryDb = drizzleDb): Promise<number> {
    const result = await db
      .update(crmProductCategory)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(crmProductCategory.id, id), isNull(crmProductCategory.deletedAt)))
    return ((result as unknown as [{ affectedRows?: number } | undefined])[0])?.affectedRows ?? 0
  }
}

/* ─── UnitRepository ──────────────────────────────── */

export class UnitRepository {
  static async list(
    query: UnitListQuery,
    db: AppQueryDb = drizzleDb,
  ): Promise<{ rows: UnitRow[]; total: number }> {
    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 200
    const where = buildUnitWhere(query)
    const [rows, totalRow] = await Promise.all([
      db
        .select(unitColumns)
        .from(crmUnit)
        .where(where)
        .orderBy(asc(crmUnit.sort), asc(crmUnit.id))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db.select({ c: count() }).from(crmUnit).where(where),
    ])
    return { rows: rows as UnitRow[], total: Number(totalRow[0]?.c ?? 0) }
  }

  static async listEnabled(db: AppQueryDb = drizzleDb): Promise<UnitRow[]> {
    const rows = await db
      .select(unitColumns)
      .from(crmUnit)
      .where(and(eq(crmUnit.enabled, 1), isNull(crmUnit.deletedAt)))
      .orderBy(asc(crmUnit.sort), asc(crmUnit.id))
    return rows as UnitRow[]
  }

  static async findByCode(
    code: string,
    excludeId: number | undefined,
    db: AppQueryDb = drizzleDb,
  ): Promise<UnitRow | null> {
    const conds: SQL[] = [eq(crmUnit.code, code), isNull(crmUnit.deletedAt)]
    if (excludeId !== undefined) conds.push(ne(crmUnit.id, excludeId))
    const [row] = await db
      .select(unitColumns)
      .from(crmUnit)
      .where(and(...conds))
      .limit(1)
    return (row as UnitRow | undefined) ?? null
  }

  static async findById(
    id: number,
    db: AppQueryDb = drizzleDb,
  ): Promise<UnitRow | null> {
    const [row] = await db
      .select(unitColumns)
      .from(crmUnit)
      .where(and(eq(crmUnit.id, id), isNull(crmUnit.deletedAt)))
      .limit(1)
    return (row as UnitRow | undefined) ?? null
  }

  static async create(input: CreateUnitInput, db: AppQueryDb = drizzleDb): Promise<UnitRow> {
    const [inserted] = await db
      .insert(crmUnit)
      .values({
        code: input.code,
        name: input.name,
        sort: input.sort ?? 0,
        enabled: input.enabled ?? 1,
      })
      .$returningId()
    const created = await UnitRepository.findById(inserted.id, db)
    if (!created) throw new Error('Failed to read back created crm unit')
    return created
  }

  static async update(
    id: number,
    input: UpdateUnitInput,
    db: AppQueryDb = drizzleDb,
  ): Promise<UnitRow | null> {
    const patch: Record<string, unknown> = { updatedAt: new Date() }
    if (input.name !== undefined) patch.name = input.name
    if (input.sort !== undefined) patch.sort = input.sort
    if (input.enabled !== undefined) patch.enabled = input.enabled
    await db
      .update(crmUnit)
      .set(patch)
      .where(and(eq(crmUnit.id, id), isNull(crmUnit.deletedAt)))
    return UnitRepository.findById(id, db)
  }

  static async softDelete(id: number, db: AppQueryDb = drizzleDb): Promise<number> {
    const result = await db
      .update(crmUnit)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(crmUnit.id, id), isNull(crmUnit.deletedAt)))
    return ((result as unknown as [{ affectedRows?: number } | undefined])[0])?.affectedRows ?? 0
  }
}

/**
 * 内部辅助：被 service 用于按 id 列表批量查 enabled 状态，避免 N+1。
 * 不导出到路由层。
 */
export async function findCategoriesByIds(
  ids: readonly number[],
  db: AppQueryDb = drizzleDb,
): Promise<CategoryRow[]> {
  if (ids.length === 0) return []
  const rows = await db
    .select(categoryColumns)
    .from(crmProductCategory)
    .where(and(inArray(crmProductCategory.id, ids as number[]), isNull(crmProductCategory.deletedAt)))
  return rows as CategoryRow[]
}