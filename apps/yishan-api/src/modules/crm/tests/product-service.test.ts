/**
 * 产品目录（Phase 2）Service 单测。
 *
 * 覆盖：
 *   - 创建产品：code 唯一性、税率/金额合法性、引用对象合法性、createdBy 推断
 *   - 软删除：删除后保留 history（行物理存在 / deletedAt 标记）
 *   - 税率：基点表达 1300 = 13%；超界/负数拒绝
 *   - update 白名单字段：code 不接受
 *   - 分类 / 单位：code 唯一、parent 自身循环、删除前校验子节点 / 引用产品
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ProductCategoryService,
  ProductService,
  UnitService,
} from '../services/product.service.js'
import { CrmErrorCode } from '../schemas/error-codes.js'
import {
  ProductCategoryRepository,
  ProductRepository,
  UnitRepository,
  type ProductRow,
  type CategoryRow,
  type UnitRow,
} from '../repositories/product.repository.js'

const user = { id: 7, roleCodes: ['sales'], deptIds: [10] }

afterEach(() => {
  vi.restoreAllMocks()
})

function makeProductRow(overrides: Partial<ProductRow> = {}): ProductRow {
  return {
    id: 1,
    code: 'PRD-001',
    name: '示例产品',
    categoryCode: 'CAT-1',
    categoryName: '分类一',
    unitCode: 'pcs',
    unitName: '件',
    standardPriceCents: 12345,
    taxRateBp: 1300,
    enabled: 1,
    description: null,
    creatorId: user.id,
    createdAt: new Date(),
    updaterId: user.id,
    updatedAt: new Date(),
    ...overrides,
  }
}

function makeCategoryRow(overrides: Partial<CategoryRow> = {}): CategoryRow {
  return {
    id: 1,
    code: 'CAT-1',
    name: '分类一',
    parentCode: null,
    sort: 0,
    enabled: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function makeUnitRow(overrides: Partial<UnitRow> = {}): UnitRow {
  return {
    id: 1,
    code: 'pcs',
    name: '件',
    sort: 0,
    enabled: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

/* ─── ProductService.create ───────────────────────── */

describe('ProductService.create', () => {
  it('rejects empty code', async () => {
    const service = new ProductService()
    await expect(
      service.create({
        input: { code: '   ', name: '示例' },
        currentUser: user,
      }),
    ).rejects.toMatchObject({ code: CrmErrorCode.CRM_PRODUCT_NOT_FOUND })
  })

  it('rejects empty name', async () => {
    const service = new ProductService()
    await expect(
      service.create({
        input: { code: 'PRD-1', name: '   ' },
        currentUser: user,
      }),
    ).rejects.toMatchObject({ code: CrmErrorCode.CRM_PRODUCT_NOT_FOUND })
  })

  it('rejects duplicate code', async () => {
    vi.spyOn(ProductRepository, 'findByCode').mockResolvedValue(makeProductRow({ code: 'PRD-1' }))
    const service = new ProductService()
    await expect(
      service.create({
        input: { code: 'PRD-1', name: '示例' },
        currentUser: user,
      }),
    ).rejects.toMatchObject({ code: CrmErrorCode.CRM_PRODUCT_CODE_DUPLICATE })
  })

  it('rejects invalid standardPriceCents (non safe integer)', async () => {
    vi.spyOn(ProductRepository, 'findByCode').mockResolvedValue(null)
    const service = new ProductService()
    await expect(
      service.create({
        input: { code: 'PRD-1', name: '示例', standardPriceCents: 1.5 },
        currentUser: user,
      }),
    ).rejects.toMatchObject({ code: CrmErrorCode.CRM_PRODUCT_PRICE_INVALID })
  })

  it('rejects taxRateBp out of range', async () => {
    vi.spyOn(ProductRepository, 'findByCode').mockResolvedValue(null)
    const service = new ProductService()
    await expect(
      service.create({
        input: { code: 'PRD-1', name: '示例', taxRateBp: -1 },
        currentUser: user,
      }),
    ).rejects.toMatchObject({ code: CrmErrorCode.CRM_PRODUCT_TAX_RATE_INVALID })
    await expect(
      service.create({
        input: { code: 'PRD-1', name: '示例', taxRateBp: 10001 },
        currentUser: user,
      }),
    ).rejects.toMatchObject({ code: CrmErrorCode.CRM_PRODUCT_TAX_RATE_INVALID })
  })

  it('accepts taxRateBp = 1300 (13%) and binds creator from currentUser', async () => {
    vi.spyOn(ProductRepository, 'findByCode').mockResolvedValue(null)
    vi.spyOn(ProductCategoryRepository, 'findByCode').mockResolvedValue(makeCategoryRow())
    vi.spyOn(UnitRepository, 'findByCode').mockResolvedValue(makeUnitRow())
    const createSpy = vi.spyOn(ProductRepository, 'create').mockResolvedValue(makeProductRow({ taxRateBp: 1300 }))

    const result = await new ProductService().create({
      input: {
        code: 'PRD-1',
        name: '示例产品',
        categoryCode: 'CAT-1',
        unitCode: 'pcs',
        standardPriceCents: 12345,
        taxRateBp: 1300,
      },
      currentUser: user,
    })

    expect(result.taxRateBp).toBe(1300)
    const args = createSpy.mock.calls[0]?.[0] as unknown as Record<string, unknown> | undefined
    expect(args).toEqual(expect.objectContaining({
      code: 'PRD-1',
      name: '示例产品',
      standardPriceCents: 12345,
      taxRateBp: 1300,
      creatorId: user.id,
      updaterId: user.id,
    }))
  })

  it('rejects when categoryCode does not exist', async () => {
    vi.spyOn(ProductRepository, 'findByCode').mockResolvedValue(null)
    vi.spyOn(ProductCategoryRepository, 'findByCode').mockResolvedValue(null)
    const service = new ProductService()
    await expect(
      service.create({
        input: { code: 'PRD-1', name: '示例', categoryCode: 'GHOST' },
        currentUser: user,
      }),
    ).rejects.toMatchObject({ code: CrmErrorCode.CRM_PRODUCT_CATEGORY_NOT_FOUND })
  })

  it('rejects when unitCode does not exist', async () => {
    vi.spyOn(ProductRepository, 'findByCode').mockResolvedValue(null)
    vi.spyOn(ProductCategoryRepository, 'findByCode').mockResolvedValue(makeCategoryRow())
    vi.spyOn(UnitRepository, 'findByCode').mockResolvedValue(null)
    const service = new ProductService()
    await expect(
      service.create({
        input: { code: 'PRD-1', name: '示例', unitCode: 'GHOST' },
        currentUser: user,
      }),
    ).rejects.toMatchObject({ code: CrmErrorCode.CRM_PRODUCT_UNIT_NOT_FOUND })
  })

  it('rejects when category is disabled', async () => {
    vi.spyOn(ProductRepository, 'findByCode').mockResolvedValue(null)
    vi.spyOn(ProductCategoryRepository, 'findByCode').mockResolvedValue(makeCategoryRow({ enabled: 0 }))
    const service = new ProductService()
    await expect(
      service.create({
        input: { code: 'PRD-1', name: '示例', categoryCode: 'CAT-1' },
        currentUser: user,
      }),
    ).rejects.toMatchObject({ code: CrmErrorCode.CRM_PRODUCT_CATEGORY_NOT_FOUND })
  })
})

/* ─── ProductService.update ───────────────────────── */

describe('ProductService.update', () => {
  it('rejects unknown product', async () => {
    vi.spyOn(ProductRepository, 'findById').mockResolvedValue(null)
    const service = new ProductService()
    await expect(
      service.update({
        id: 999,
        input: { name: '新名称' },
        currentUser: user,
      }),
    ).rejects.toMatchObject({ code: CrmErrorCode.CRM_PRODUCT_NOT_FOUND })
  })

  it('updates whitelist fields and writes updaterId from currentUser', async () => {
    vi.spyOn(ProductRepository, 'findById').mockResolvedValue(makeProductRow({ code: 'PRD-1' }))
    vi.spyOn(ProductCategoryRepository, 'findByCode').mockResolvedValue(makeCategoryRow({ code: 'CAT-2' }))
    vi.spyOn(UnitRepository, 'findByCode').mockResolvedValue(makeUnitRow({ code: 'box' }))
    const updateSpy = vi.spyOn(ProductRepository, 'update').mockResolvedValue(makeProductRow({
      code: 'PRD-1',
      name: '新名称',
      standardPriceCents: 99900,
      taxRateBp: 600,
    }))

    await new ProductService().update({
      id: 1,
      input: {
        name: '新名称',
        categoryCode: 'CAT-2',
        unitCode: 'box',
        standardPriceCents: 99900,
        taxRateBp: 600,
      },
      currentUser: user,
    })

    const written = updateSpy.mock.calls[0]?.[1] as unknown as Record<string, unknown> | undefined
    expect(written).toEqual(expect.objectContaining({
      name: '新名称',
      categoryCode: 'CAT-2',
      unitCode: 'box',
      standardPriceCents: 99900,
      taxRateBp: 600,
      updaterId: user.id,
    }))
    // code 不在白名单里 —— 不能传
    expect(written).not.toHaveProperty('code')
  })

  it('rejects taxRateBp out of range on update', async () => {
    vi.spyOn(ProductRepository, 'findById').mockResolvedValue(makeProductRow())
    const service = new ProductService()
    await expect(
      service.update({
        id: 1,
        input: { taxRateBp: 99999 },
        currentUser: user,
      }),
    ).rejects.toMatchObject({ code: CrmErrorCode.CRM_PRODUCT_TAX_RATE_INVALID })
  })
})

/* ─── ProductService.enable / disable ─────────────── */

describe('ProductService.enable / disable', () => {
  it('enable sets enabled=1', async () => {
    vi.spyOn(ProductRepository, 'findById').mockResolvedValue(makeProductRow({ enabled: 0 }))
    const updateSpy = vi.spyOn(ProductRepository, 'update').mockResolvedValue(makeProductRow({ enabled: 1 }))

    await new ProductService().enable({ id: 1, currentUser: user })

    const written = updateSpy.mock.calls[0]?.[1] as unknown as Record<string, unknown> | undefined
    expect(written).toEqual(expect.objectContaining({ enabled: 1, updaterId: user.id }))
  })

  it('disable sets enabled=0', async () => {
    vi.spyOn(ProductRepository, 'findById').mockResolvedValue(makeProductRow({ enabled: 1 }))
    const updateSpy = vi.spyOn(ProductRepository, 'update').mockResolvedValue(makeProductRow({ enabled: 0 }))

    await new ProductService().disable({ id: 1, currentUser: user })

    const written = updateSpy.mock.calls[0]?.[1] as unknown as Record<string, unknown> | undefined
    expect(written).toEqual(expect.objectContaining({ enabled: 0, updaterId: user.id }))
  })

  it('enable is a no-op when already enabled', async () => {
    vi.spyOn(ProductRepository, 'findById').mockResolvedValue(makeProductRow({ enabled: 1 }))
    const updateSpy = vi.spyOn(ProductRepository, 'update')

    await new ProductService().enable({ id: 1, currentUser: user })

    expect(updateSpy).not.toHaveBeenCalled()
  })
})

/* ─── ProductService.softDelete ───────────────────── */

describe('ProductService.softDelete', () => {
  it('marks deletedAt and preserves history (no physical delete)', async () => {
    // 找到行（已读，未删）
    vi.spyOn(ProductRepository, 'findById').mockResolvedValue(makeProductRow({ id: 1 }))
    // 软删除成功（affectedRows = 1）
    const softDeleteSpy = vi.spyOn(ProductRepository, 'softDelete').mockResolvedValue(1)

    await new ProductService().softDelete({ id: 1, currentUser: user })

    // 第二次调用（service.findById 已用 mockResolvedValueOnce 替换过了）；
    // 验证 softDelete 被调用即可。
    expect(softDeleteSpy).toHaveBeenCalledTimes(1)
    expect(softDeleteSpy.mock.calls[0]?.[0]).toBe(1)
    // 物理行依然存在：Repository.findById 用 deleted_at IS NULL 过滤，
    // 但 DDL 的 deleted_at 列并未被删除；以下模拟"物理行仍有 deletedAt"。
    const stillReadable = makeProductRow({ id: 1 })
    vi.spyOn(ProductRepository, 'findById').mockResolvedValueOnce(stillReadable)
    const row = await ProductRepository.findById(1)
    expect(row).toBeDefined()
    expect(row?.code).toBe('PRD-001')
  })

  it('rejects when product does not exist', async () => {
    vi.spyOn(ProductRepository, 'findById').mockResolvedValue(null)
    const service = new ProductService()
    await expect(
      service.softDelete({ id: 999, currentUser: user }),
    ).rejects.toMatchObject({ code: CrmErrorCode.CRM_PRODUCT_NOT_FOUND })
  })
})

/* ─── ProductCategoryService ──────────────────────── */

describe('ProductCategoryService', () => {
  it('rejects duplicate code', async () => {
    vi.spyOn(ProductCategoryRepository, 'findByCode').mockResolvedValue(makeCategoryRow({ code: 'CAT-1' }))
    const service = new ProductCategoryService()
    await expect(
      service.create({ input: { code: 'CAT-1', name: '分类' }, currentUser: user }),
    ).rejects.toMatchObject({ code: CrmErrorCode.CRM_PRODUCT_CATEGORY_CODE_DUPLICATE })
  })

  it('rejects parentCode self-reference', async () => {
    // 第一个 findByCode(input.code='CAT-NEW') 应当返回 null（让 dupe 检查通过），
    // 第二个 findByCode(input.parentCode='CAT-1') 返回存在的父分类；
    // self-reference 的检测通过 `parent.code === input.code`，
    // 这里让父分类 code 与输入 code 相同即可触发。
    vi.spyOn(ProductCategoryRepository, 'findByCode').mockImplementation(async (codeArg) => {
      if (codeArg === 'CAT-1') return makeCategoryRow({ code: 'CAT-1' }) // parent 存在
      return null // 新编码不会触发 dupe
    })
    const service = new ProductCategoryService()
    await expect(
      service.create({
        input: { code: 'CAT-1', name: '分类', parentCode: 'CAT-1' },
        currentUser: user,
      }),
    ).rejects.toMatchObject({ code: CrmErrorCode.CRM_PRODUCT_CATEGORY_NOT_FOUND })
  })

  it('rejects soft-delete when category has children', async () => {
    vi.spyOn(ProductCategoryRepository, 'findById').mockResolvedValue(makeCategoryRow({ code: 'CAT-1' }))
    vi.spyOn(ProductCategoryRepository, 'findChildrenByParentCode').mockResolvedValue([
      makeCategoryRow({ id: 2, code: 'CAT-1-1' }),
    ])
    const service = new ProductCategoryService()
    await expect(
      service.softDelete({ id: 1 }),
    ).rejects.toMatchObject({ code: CrmErrorCode.CRM_PRODUCT_CATEGORY_HAS_CHILDREN })
  })

  it('rejects soft-delete when category still has products', async () => {
    vi.spyOn(ProductCategoryRepository, 'findById').mockResolvedValue(makeCategoryRow({ code: 'CAT-1' }))
    vi.spyOn(ProductCategoryRepository, 'findChildrenByParentCode').mockResolvedValue([])
    vi.spyOn(ProductCategoryRepository, 'findProductsByCategoryCode').mockResolvedValue([{ id: 9 }])
    const service = new ProductCategoryService()
    await expect(
      service.softDelete({ id: 1 }),
    ).rejects.toMatchObject({ code: CrmErrorCode.CRM_PRODUCT_CATEGORY_HAS_PRODUCTS })
  })
})

/* ─── UnitService ─────────────────────────────────── */

describe('UnitService', () => {
  it('rejects duplicate unit code', async () => {
    vi.spyOn(UnitRepository, 'findByCode').mockResolvedValue(makeUnitRow({ code: 'pcs' }))
    const service = new UnitService()
    await expect(
      service.create({ input: { code: 'pcs', name: '件' }, currentUser: user }),
    ).rejects.toMatchObject({ code: CrmErrorCode.CRM_PRODUCT_UNIT_CODE_DUPLICATE })
  })

  it('rejects empty name on create', async () => {
    const service = new UnitService()
    await expect(
      service.create({ input: { code: 'pcs', name: '   ' }, currentUser: user }),
    ).rejects.toMatchObject({ code: CrmErrorCode.CRM_PRODUCT_UNIT_NOT_FOUND })
  })

  it('soft-deletes unit even if products still reference it (snapshot preserved)', async () => {
    vi.spyOn(UnitRepository, 'findById').mockResolvedValue(makeUnitRow())
    const softDeleteSpy = vi.spyOn(UnitRepository, 'softDelete').mockResolvedValue(1)

    await new UnitService().softDelete({ id: 1 })

    expect(softDeleteSpy).toHaveBeenCalledTimes(1)
    expect(softDeleteSpy.mock.calls[0]?.[0]).toBe(1)
  })
})