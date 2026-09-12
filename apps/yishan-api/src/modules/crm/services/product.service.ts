/**
 * 产品目录（Phase 2）Service。
 *
 * 业务规则集中在 service 内；Repository 仅做"读 / 写 / 软删 / 列"。
 *
 * 边界：
 *   - 产品 / 分类 / 单位三表共 9 个动作：list / create / update / enable / disable / softDelete。
 *   - 所有 enable/disable 都仅改 enabled 列（不变 deleted_at）；用户可单独"软删除"以隐藏。
 *   - amount_cents / taxRateBp 校验全部走 utils/money。
 *   - update 是白名单字段：仅 name / categoryCode / unitCode / standardPriceCents / taxRateBp / enabled / description。
 *     code 一旦写入不允许改；quotation_item.product_code 是不可变引用。
 *   - 删除前检查：分类下若有未删除的产品 → 拒绝；分类若有子分类 → 拒绝；单位无此约束（业务上单位不会被报价引用快照语义强约束）。
 *   - createdBy / updaterId 一律从 currentUser.id 推导；客户端不能伪造。
 */
import { BusinessError } from '@/exceptions/business-error.js'
import type { AppQueryDb } from '@/db'
import { CrmErrorCode } from '../schemas/error-codes.js'
import {
  ProductCategoryRepository,
  ProductRepository,
  UnitRepository,
  type CategoryListQuery,
  type CategoryRow,
  type CreateCategoryInput,
  type CreateProductInput,
  type CreateUnitInput,
  type ProductListQuery,
  type ProductRow,
  type UnitListQuery,
  type UnitRow,
  type UpdateCategoryInput,
  type UpdateProductInput,
  type UpdateUnitInput,
} from '../repositories/product.repository.js'
import type { DataScopeUser } from '../schemas/data-scope.js'

/* ─── Validation helpers ─────────────────────────── */

/** 税率基点合法区间：0..10000（即 0%..100%）。 */
const TAX_RATE_BP_MIN = 0
const TAX_RATE_BP_MAX = 10000

function assertSafeCents(value: number, hint: string): void {
  if (!Number.isFinite(value) || !Number.isSafeInteger(value)) {
    throw new BusinessError(CrmErrorCode.CRM_PRODUCT_PRICE_INVALID, `${hint} 必须是合法整数（分）`)
  }
}

function assertTaxRateBpValid(value: number): void {
  if (
    !Number.isInteger(value) ||
    value < TAX_RATE_BP_MIN ||
    value > TAX_RATE_BP_MAX
  ) {
    throw new BusinessError(
      CrmErrorCode.CRM_PRODUCT_TAX_RATE_INVALID,
      `税率基点必须是 ${TAX_RATE_BP_MIN}..${TAX_RATE_BP_MAX} 之间的整数`,
    )
  }
}

function assertNonEmpty(value: string, hint: string, errorCode: number = CrmErrorCode.CRM_PRODUCT_NOT_FOUND): void {
  if (!value || value.trim() === '') {
    throw new BusinessError(errorCode, hint)
  }
}

/* ─── ProductService ──────────────────────────────── */

export interface UpdateProductArgs {
  id: number
  input: {
    name?: string
    categoryCode?: string | null
    unitCode?: string | null
    standardPriceCents?: number
    taxRateBp?: number
    enabled?: number
    description?: string | null
  }
  currentUser: DataScopeUser
}

export interface CreateProductArgs {
  input: {
    code: string
    name: string
    categoryCode?: string | null
    unitCode?: string | null
    standardPriceCents?: number
    taxRateBp?: number
    enabled?: number
    description?: string | null
  }
  currentUser: DataScopeUser
}

export class ProductService {
  constructor(private readonly deps: { db?: AppQueryDb } = {}) {}

  async list(query: ProductListQuery): Promise<{ items: ProductRow[]; total: number; page: number; pageSize: number }> {
    const { rows, total } = await ProductRepository.list(query, this.deps.db)
    return {
      items: rows,
      total,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
    }
  }

  async findById(id: number): Promise<ProductRow | null> {
    return ProductRepository.findById(id, this.deps.db)
  }

  /**
   * 创建产品。
   *
   * 校验顺序：
   *   1. code / name 非空（trim 后）
   *   2. code 唯一
   *   3. standardPriceCents / taxRateBp 合法
   *   4. categoryCode / unitCode 若提供，必须 enabled=1 且未被软删
   *
   * 注：createdBy / updaterId 直接用 currentUser.id；不做权限推断。
   */
  async create({ input, currentUser }: CreateProductArgs): Promise<ProductRow> {
    const code = (input.code ?? '').trim()
    const name = (input.name ?? '').trim()
    assertNonEmpty(code, '请填写产品编码')
    assertNonEmpty(name, '请填写产品名称')

    const existing = await ProductRepository.findByCode(code, undefined, this.deps.db)
    if (existing) {
      throw new BusinessError(CrmErrorCode.CRM_PRODUCT_CODE_DUPLICATE, '产品编码已存在')
    }

    if (input.standardPriceCents !== undefined && input.standardPriceCents !== null) {
      assertSafeCents(input.standardPriceCents, '标准单价')
    }
    if (input.taxRateBp !== undefined && input.taxRateBp !== null) {
      assertTaxRateBpValid(input.taxRateBp)
    }

    if (input.categoryCode) {
      const cat = await ProductCategoryRepository.findByCode(input.categoryCode, undefined, this.deps.db)
      if (!cat || cat.enabled !== 1) {
        throw new BusinessError(CrmErrorCode.CRM_PRODUCT_CATEGORY_NOT_FOUND, '产品分类不存在或已停用')
      }
    }
    if (input.unitCode) {
      const unit = await UnitRepository.findByCode(input.unitCode, undefined, this.deps.db)
      if (!unit || unit.enabled !== 1) {
        throw new BusinessError(CrmErrorCode.CRM_PRODUCT_UNIT_NOT_FOUND, '计量单位不存在或已停用')
      }
    }

    const createInput: CreateProductInput = {
      code,
      name,
      categoryCode: input.categoryCode ?? null,
      unitCode: input.unitCode ?? null,
      standardPriceCents: input.standardPriceCents ?? 0,
      taxRateBp: input.taxRateBp ?? 0,
      enabled: input.enabled ?? 1,
      description: input.description ?? null,
      creatorId: currentUser.id,
      updaterId: currentUser.id,
    }
    return ProductRepository.create(createInput, this.deps.db)
  }

  /**
   * 更新产品：仅白名单字段生效，code 一旦创建不可改。
   *
   * 规则：
   *   - name 必须 trim 后非空
   *   - standardPriceCents / taxRateBp 走 money 校验
   *   - categoryCode / unitCode 若提供，必须 enabled=1
   *   - 引用不存在的引用对象时抛业务码
   */
  async update({ id, input, currentUser }: UpdateProductArgs): Promise<ProductRow | null> {
    const existing = await ProductRepository.findById(id, this.deps.db)
    if (!existing) {
      throw new BusinessError(CrmErrorCode.CRM_PRODUCT_NOT_FOUND, '产品不存在或已删除')
    }

    const patch: UpdateProductInput = { updaterId: currentUser.id }

    if (input.name !== undefined) {
      const trimmed = input.name.trim()
      if (!trimmed) {
        throw new BusinessError(CrmErrorCode.CRM_PRODUCT_NOT_FOUND, '请填写产品名称')
      }
      patch.name = trimmed
    }
    if (input.categoryCode !== undefined) {
      if (input.categoryCode === null || input.categoryCode === '') {
        patch.categoryCode = null
      } else {
        const cat = await ProductCategoryRepository.findByCode(input.categoryCode, undefined, this.deps.db)
        if (!cat || cat.enabled !== 1) {
          throw new BusinessError(CrmErrorCode.CRM_PRODUCT_CATEGORY_NOT_FOUND, '产品分类不存在或已停用')
        }
        patch.categoryCode = input.categoryCode
      }
    }
    if (input.unitCode !== undefined) {
      if (input.unitCode === null || input.unitCode === '') {
        patch.unitCode = null
      } else {
        const unit = await UnitRepository.findByCode(input.unitCode, undefined, this.deps.db)
        if (!unit || unit.enabled !== 1) {
          throw new BusinessError(CrmErrorCode.CRM_PRODUCT_UNIT_NOT_FOUND, '计量单位不存在或已停用')
        }
        patch.unitCode = input.unitCode
      }
    }
    if (input.standardPriceCents !== undefined && input.standardPriceCents !== null) {
      assertSafeCents(input.standardPriceCents, '标准单价')
      patch.standardPriceCents = input.standardPriceCents
    }
    if (input.taxRateBp !== undefined && input.taxRateBp !== null) {
      assertTaxRateBpValid(input.taxRateBp)
      patch.taxRateBp = input.taxRateBp
    }
    if (input.enabled !== undefined) {
      patch.enabled = input.enabled === 1 ? 1 : 0
    }
    if (input.description !== undefined) {
      patch.description = input.description
    }

    return ProductRepository.update(id, patch, this.deps.db)
  }

  async enable({ id, currentUser }: { id: number; currentUser: DataScopeUser }): Promise<ProductRow | null> {
    return this.setEnabled(id, 1, currentUser)
  }

  async disable({ id, currentUser }: { id: number; currentUser: DataScopeUser }): Promise<ProductRow | null> {
    return this.setEnabled(id, 0, currentUser)
  }

  private async setEnabled(id: number, enabled: 0 | 1, currentUser: DataScopeUser): Promise<ProductRow | null> {
    const existing = await ProductRepository.findById(id, this.deps.db)
    if (!existing) {
      throw new BusinessError(CrmErrorCode.CRM_PRODUCT_NOT_FOUND, '产品不存在或已删除')
    }
    if (existing.enabled === enabled) return existing
    return ProductRepository.update(id, { enabled, updaterId: currentUser.id }, this.deps.db)
  }

  /**
   * 软删除：写 deleted_at。报价快照保留 nameSnapshot / unitSnapshot /
   * unitPriceSnapshot / taxRateSnapshot，因此删产品不会破坏已存在的报价历史。
   *
   * 业务约束：
   *   - 已删除（deleted_at 非空）不允许再次删除（按 not found 处理）。
   */
  async softDelete({ id, currentUser: _currentUser }: { id: number; currentUser: DataScopeUser }): Promise<void> {
    const existing = await ProductRepository.findById(id, this.deps.db)
    if (!existing) {
      throw new BusinessError(CrmErrorCode.CRM_PRODUCT_NOT_FOUND, '产品不存在或已删除')
    }
    const affected = await ProductRepository.softDelete(id, this.deps.db)
    if (affected === 0) {
      throw new BusinessError(CrmErrorCode.CRM_PRODUCT_NOT_FOUND, '产品不存在或已删除')
    }
  }
}

/* ─── ProductCategoryService ──────────────────────── */

export interface CreateCategoryArgs {
  input: {
    code: string
    name: string
    parentCode?: string | null
    sort?: number
    enabled?: number
  }
  currentUser: DataScopeUser
}

export interface UpdateCategoryArgs {
  id: number
  input: {
    name?: string
    parentCode?: string | null
    sort?: number
    enabled?: number
  }
  currentUser: DataScopeUser
}

export class ProductCategoryService {
  constructor(private readonly deps: { db?: AppQueryDb } = {}) {}

  async list(query: CategoryListQuery): Promise<{ items: CategoryRow[]; total: number; page: number; pageSize: number }> {
    const { rows, total } = await ProductCategoryRepository.list(query, this.deps.db)
    return { items: rows, total, page: query.page ?? 1, pageSize: query.pageSize ?? 200 }
  }

  async listEnabled(): Promise<CategoryRow[]> {
    return ProductCategoryRepository.listEnabled(this.deps.db)
  }

  async create({ input }: CreateCategoryArgs): Promise<CategoryRow> {
    const code = (input.code ?? '').trim()
    const name = (input.name ?? '').trim()
    assertNonEmpty(code, '请填写分类编码', CrmErrorCode.CRM_PRODUCT_CATEGORY_NOT_FOUND)
    assertNonEmpty(name, '请填写分类名称', CrmErrorCode.CRM_PRODUCT_CATEGORY_NOT_FOUND)

    // 自引用检查：父分类编码等于自身编码。在 dupe 检查之前做，可让"自身父分类"作为
    // 显式业务错误暴露，而不是先撞上"分类编码已存在"。
    if (input.parentCode && input.parentCode.trim() === code) {
      throw new BusinessError(CrmErrorCode.CRM_PRODUCT_CATEGORY_NOT_FOUND, '父分类不能为自身')
    }

    const dupe = await ProductCategoryRepository.findByCode(code, undefined, this.deps.db)
    if (dupe) {
      throw new BusinessError(CrmErrorCode.CRM_PRODUCT_CATEGORY_CODE_DUPLICATE, '分类编码已存在')
    }

    if (input.parentCode) {
      // parent 必须存在且未软删
      const parent = await ProductCategoryRepository.findByCode(input.parentCode, undefined, this.deps.db)
      if (!parent) {
        throw new BusinessError(CrmErrorCode.CRM_PRODUCT_CATEGORY_NOT_FOUND, '父分类不存在')
      }
      if (parent.code === code) {
        throw new BusinessError(CrmErrorCode.CRM_PRODUCT_CATEGORY_NOT_FOUND, '父分类不能为自身')
      }
    }

    const createInput: CreateCategoryInput = {
      code,
      name,
      parentCode: input.parentCode ?? null,
      sort: input.sort ?? 0,
      enabled: input.enabled ?? 1,
    }
    return ProductCategoryRepository.create(createInput, this.deps.db)
  }

  async update({ id, input }: UpdateCategoryArgs): Promise<CategoryRow | null> {
    const existing = await ProductCategoryRepository.findById(id, this.deps.db)
    if (!existing) {
      throw new BusinessError(CrmErrorCode.CRM_PRODUCT_CATEGORY_NOT_FOUND, '产品分类不存在')
    }

    const patch: UpdateCategoryInput = {}

    if (input.name !== undefined) {
      const trimmed = input.name.trim()
      if (!trimmed) {
        throw new BusinessError(CrmErrorCode.CRM_PRODUCT_CATEGORY_NOT_FOUND, '请填写分类名称')
      }
      patch.name = trimmed
    }
    if (input.parentCode !== undefined) {
      if (input.parentCode === null || input.parentCode === '') {
        patch.parentCode = null
      } else {
        if (input.parentCode === existing.code) {
          throw new BusinessError(CrmErrorCode.CRM_PRODUCT_CATEGORY_NOT_FOUND, '父分类不能为自身')
        }
        const parent = await ProductCategoryRepository.findByCode(input.parentCode, undefined, this.deps.db)
        if (!parent) {
          throw new BusinessError(CrmErrorCode.CRM_PRODUCT_CATEGORY_NOT_FOUND, '父分类不存在')
        }
        patch.parentCode = input.parentCode
      }
    }
    if (input.sort !== undefined) patch.sort = input.sort
    if (input.enabled !== undefined) patch.enabled = input.enabled === 1 ? 1 : 0

    return ProductCategoryRepository.update(id, patch, this.deps.db)
  }

  /**
   * 软删除分类。删除前必须确保：
   *   - 没有未删除的子分类
   *   - 没有未删除的产品引用此分类
   *
   * 保留策略：报价快照保留分类名（crm_quotation_item.categorySnapshot），删分类不影响历史报价。
   */
  async softDelete({ id }: { id: number }): Promise<void> {
    const existing = await ProductCategoryRepository.findById(id, this.deps.db)
    if (!existing) {
      throw new BusinessError(CrmErrorCode.CRM_PRODUCT_CATEGORY_NOT_FOUND, '产品分类不存在')
    }
    const children = await ProductCategoryRepository.findChildrenByParentCode(existing.code, false, this.deps.db)
    if (children.length > 0) {
      throw new BusinessError(
        CrmErrorCode.CRM_PRODUCT_CATEGORY_HAS_CHILDREN,
        '该分类下仍有子分类，无法删除',
      )
    }
    const products = await ProductCategoryRepository.findProductsByCategoryCode(existing.code, false, this.deps.db)
    if (products.length > 0) {
      throw new BusinessError(
        CrmErrorCode.CRM_PRODUCT_CATEGORY_HAS_PRODUCTS,
        '该分类下仍有产品，无法删除',
      )
    }
    const affected = await ProductCategoryRepository.softDelete(id, this.deps.db)
    if (affected === 0) {
      throw new BusinessError(CrmErrorCode.CRM_PRODUCT_CATEGORY_NOT_FOUND, '产品分类不存在')
    }
  }
}

/* ─── UnitService ─────────────────────────────────── */

export interface CreateUnitArgs {
  input: {
    code: string
    name: string
    sort?: number
    enabled?: number
  }
  currentUser: DataScopeUser
}

export interface UpdateUnitArgs {
  id: number
  input: {
    name?: string
    sort?: number
    enabled?: number
  }
  currentUser: DataScopeUser
}

export class UnitService {
  constructor(private readonly deps: { db?: AppQueryDb } = {}) {}

  async list(query: UnitListQuery): Promise<{ items: UnitRow[]; total: number; page: number; pageSize: number }> {
    const { rows, total } = await UnitRepository.list(query, this.deps.db)
    return { items: rows, total, page: query.page ?? 1, pageSize: query.pageSize ?? 200 }
  }

  async listEnabled(): Promise<UnitRow[]> {
    return UnitRepository.listEnabled(this.deps.db)
  }

  async create({ input }: CreateUnitArgs): Promise<UnitRow> {
    const code = (input.code ?? '').trim()
    const name = (input.name ?? '').trim()
    assertNonEmpty(code, '请填写单位编码', CrmErrorCode.CRM_PRODUCT_UNIT_NOT_FOUND)
    assertNonEmpty(name, '请填写单位名称', CrmErrorCode.CRM_PRODUCT_UNIT_NOT_FOUND)

    const dupe = await UnitRepository.findByCode(code, undefined, this.deps.db)
    if (dupe) {
      throw new BusinessError(CrmErrorCode.CRM_PRODUCT_UNIT_CODE_DUPLICATE, '单位编码已存在')
    }

    const createInput: CreateUnitInput = {
      code,
      name,
      sort: input.sort ?? 0,
      enabled: input.enabled ?? 1,
    }
    return UnitRepository.create(createInput, this.deps.db)
  }

  async update({ id, input }: UpdateUnitArgs): Promise<UnitRow | null> {
    const existing = await UnitRepository.findById(id, this.deps.db)
    if (!existing) {
      throw new BusinessError(CrmErrorCode.CRM_PRODUCT_UNIT_NOT_FOUND, '计量单位不存在')
    }
    const patch: UpdateUnitInput = {}
    if (input.name !== undefined) {
      const trimmed = input.name.trim()
      if (!trimmed) {
        throw new BusinessError(CrmErrorCode.CRM_PRODUCT_UNIT_NOT_FOUND, '请填写单位名称')
      }
      patch.name = trimmed
    }
    if (input.sort !== undefined) patch.sort = input.sort
    if (input.enabled !== undefined) patch.enabled = input.enabled === 1 ? 1 : 0

    return UnitRepository.update(id, patch, this.deps.db)
  }

  /**
   * 软删除单位。
   *
   * 注意：单位被报价快照（unitSnapshot）保留，因此删除单位不影响历史报价。
   * 但若单位仍被启用产品引用，应让用户先迁移产品。删除前不强制校验（与分类不同）；
   * 业务上"先停用再删除"是更安全的工作流，因此本方法仅做软删除。
   */
  async softDelete({ id }: { id: number }): Promise<void> {
    const existing = await UnitRepository.findById(id, this.deps.db)
    if (!existing) {
      throw new BusinessError(CrmErrorCode.CRM_PRODUCT_UNIT_NOT_FOUND, '计量单位不存在')
    }
    const affected = await UnitRepository.softDelete(id, this.deps.db)
    if (affected === 0) {
      throw new BusinessError(CrmErrorCode.CRM_PRODUCT_UNIT_NOT_FOUND, '计量单位不存在')
    }
  }
}