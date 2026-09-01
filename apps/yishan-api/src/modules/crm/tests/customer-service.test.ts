/**
 * CustomerService 单测。
 *
 * 通过 vi.spyOn mock 仓库 / status / source 的访问，
 * 覆盖核心业务规则：查重、数据范围、认领 / 释放 / 转交。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BusinessError } from '@/exceptions/business-error.js'
import { CustomerService } from '../services/customer.service.js'
import { CustomerFlowService } from '../actions/customer-flow.js'
import { CustomerRepository } from '../repositories/customer.repository.js'
import { TransferRepository } from '../repositories/transfer.repository.js'
import { StatusRepository } from '../repositories/status.repository.js'
import { dbManager } from '@/db'
import { CrmErrorCode } from '../schemas/error-codes.js'

const baseCustomer = {
  id: 1,
  code: null,
  name: 'ABC 公司',
  type: 'enterprise',
  statusId: null,
  sourceId: null,
  level: null,
  industry: null,
  phone: null,
  website: null,
  province: null,
  city: null,
  address: null,
  ownerUserId: null,
  ownerDepartmentId: null,
  poolStatus: 'public',
  lastFollowUpAt: null,
  nextFollowUpAt: null,
  remark: null,
  creatorId: 1,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updaterId: 1,
  updatedAt: new Date('2026-01-01T00:00:00Z'),
}

const ownedCustomer = {
  ...baseCustomer,
  id: 2,
  poolStatus: 'owned',
  ownerUserId: 7,
  ownerDepartmentId: 10,
}

const superAdmin = { id: 1, roleCodes: ['super_admin'], deptIds: [] }
const normalSales = { id: 7, roleCodes: ['sales'], deptIds: [10] }

beforeEach(() => {
  // 默认 dbManager.transaction 直接调用回调（同步 mock）
  vi.spyOn(dbManager, 'transaction').mockImplementation(async (fn: any) =>
    fn({} as any),
  )
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('CustomerService.create', () => {
  it('重复企业客户 → CRM_CUSTOMER_DUPLICATE + details', async () => {
    vi.spyOn(CustomerRepository, 'findDuplicate').mockResolvedValue(baseCustomer)
    vi.spyOn(CustomerRepository, 'findOwnerNamesByUserIds').mockResolvedValue(new Map())

    const service = new CustomerService()
    await expect(
      service.create({
        input: { name: 'ABC 公司', type: 'enterprise', phone: '13800000000' },
        currentUser: normalSales,
      }),
    ).rejects.toMatchObject({
      code: CrmErrorCode.CRM_CUSTOMER_DUPLICATE,
      details: expect.stringContaining('existingCustomerId'),
    })
  })

  it('新企业客户成功创建，ownerUserId 缺省时 poolStatus=public', async () => {
    vi.spyOn(CustomerRepository, 'findDuplicate').mockResolvedValue(null)
    const createSpy = vi
      .spyOn(CustomerRepository, 'create')
      .mockResolvedValue({ ...baseCustomer, id: 99, name: 'XYZ' })
    vi.spyOn(CustomerRepository, 'setCustomerTags').mockResolvedValue(undefined)

    const service = new CustomerService()
    const result = await service.create({
      input: { name: 'XYZ', type: 'enterprise' },
      currentUser: normalSales,
    })
    expect(result.customer.id).toBe(99)
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'XYZ', type: 'enterprise', poolStatus: 'public' }),
      expect.anything(),
    )
  })

  it('新企业客户带 ownerUserId → poolStatus=owned', async () => {
    vi.spyOn(CustomerRepository, 'findDuplicate').mockResolvedValue(null)
    const createSpy = vi
      .spyOn(CustomerRepository, 'create')
      .mockResolvedValue({ ...baseCustomer, id: 100 })

    const service = new CustomerService()
    await service.create({
      input: { name: 'Z', type: 'enterprise', ownerUserId: 7 },
      currentUser: superAdmin,
    })
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({ ownerUserId: 7, poolStatus: 'owned' }),
      expect.anything(),
    )
  })

  it('statusId 不存在 → CRM_STATUS_NOT_FOUND', async () => {
    vi.spyOn(CustomerRepository, 'findDuplicate').mockResolvedValue(null)
    vi.spyOn(StatusRepository, 'findById').mockResolvedValue(null)
    const service = new CustomerService()
    await expect(
      service.create({
        input: { name: 'Z', type: 'enterprise', statusId: 999 },
        currentUser: superAdmin,
      }),
    ).rejects.toMatchObject({ code: CrmErrorCode.CRM_STATUS_NOT_FOUND })
  })
})

describe('CustomerService.detail', () => {
  it('非数据范围内的客户 → 抛 NOT_FOUND（不泄漏存在性）', async () => {
    vi.spyOn(CustomerRepository, 'findDetailById').mockResolvedValue({
      ...ownedCustomer,
      ownerUserName: null,
      statusName: null,
      sourceName: null,
      primaryContactId: null,
      primaryContactName: null,
      tagIds: [],
    })
    const service = new CustomerService()
    await expect(
      service.detail(ownedCustomer.id, { id: 8, roleCodes: ['sales'], deptIds: [99] }),
    ).rejects.toBeInstanceOf(BusinessError)
  })

  it('super_admin 看任何客户 → 通过', async () => {
    vi.spyOn(CustomerRepository, 'findDetailById').mockResolvedValue({
      ...ownedCustomer,
      ownerUserName: null,
      statusName: null,
      sourceName: null,
      primaryContactId: null,
      primaryContactName: null,
      tagIds: [],
    })
    const service = new CustomerService()
    const row = await service.detail(ownedCustomer.id, superAdmin)
    expect(row.id).toBe(ownedCustomer.id)
  })

  it('公海客户任何销售可见', async () => {
    vi.spyOn(CustomerRepository, 'findDetailById').mockResolvedValue({
      ...baseCustomer,
      ownerUserName: null,
      statusName: null,
      sourceName: null,
      primaryContactId: null,
      primaryContactName: null,
      tagIds: [],
    })
    const service = new CustomerService()
    const row = await service.detail(baseCustomer.id, normalSales)
    expect(row.id).toBe(baseCustomer.id)
  })
})

describe('CustomerFlowService.claim', () => {
  it('claimInTx 影响行数 = 0 + row 仍存在 + poolStatus !== public → ALREADY_OWNED', async () => {
    vi.spyOn(CustomerRepository, 'claimInTx').mockResolvedValue(0)
    vi.spyOn(CustomerRepository, 'findById').mockResolvedValue(ownedCustomer)
    vi.spyOn(TransferRepository, 'create').mockResolvedValue({} as any)

    const flow = new CustomerFlowService()
    await expect(
      flow.claim({
        customerId: 2,
        currentUser: { ...normalSales, deptId: 10 },
      }),
    ).rejects.toMatchObject({ code: CrmErrorCode.CRM_CUSTOMER_ALREADY_OWNED })
    expect(TransferRepository.create).not.toHaveBeenCalled()
  })

  it('并发：两个销售同时 claim，只有第一个成功；第二个被抢', async () => {
    // 第一次 claimInTx 影响 1 行（成功）
    // 第二次（被抢时）影响 0 行
    vi.spyOn(CustomerRepository, 'claimInTx')
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0)
    vi.spyOn(CustomerRepository, 'findById').mockResolvedValue({
      ...baseCustomer,
      poolStatus: 'owned',
      ownerUserId: 7,
      ownerDepartmentId: 10,
    })
    vi.spyOn(TransferRepository, 'create').mockResolvedValue({} as any)

    const flow = new CustomerFlowService()

    const winner = await flow.claim({
      customerId: 1,
      currentUser: { id: 7, roleCodes: ['sales'], deptIds: [10], deptId: 10 },
    })
    expect(winner).toBeDefined()
    expect(TransferRepository.create).toHaveBeenCalledTimes(1)

    await expect(
      flow.claim({
        customerId: 1,
        currentUser: { id: 8, roleCodes: ['sales'], deptIds: [10], deptId: 10 },
      }),
    ).rejects.toMatchObject({ code: CrmErrorCode.CRM_CUSTOMER_ALREADY_OWNED })
  })
})

describe('CustomerFlowService.release', () => {
  it('非 owner 释放 → RELEASE_FORBIDDEN', async () => {
    vi.spyOn(CustomerRepository, 'findById').mockResolvedValue(ownedCustomer)
    const flow = new CustomerFlowService()
    await expect(
      flow.release({
        customerId: 2,
        reason: 'test',
        currentUser: { id: 8, roleCodes: ['sales'], deptIds: [10] },
      }),
    ).rejects.toMatchObject({ code: CrmErrorCode.CRM_CUSTOMER_RELEASE_FORBIDDEN })
  })

  it('owner 释放成功 → poolStatus=public + 写 transfer', async () => {
    vi.spyOn(CustomerRepository, 'findById').mockResolvedValue(ownedCustomer)
    vi.spyOn(CustomerRepository, 'update').mockResolvedValue({
      ...baseCustomer,
      id: 2,
      poolStatus: 'public',
      ownerUserId: null,
      ownerDepartmentId: null,
    })
    const createSpy = vi
      .spyOn(TransferRepository, 'create')
      .mockResolvedValue({} as any)

    const flow = new CustomerFlowService()
    await flow.release({
      customerId: 2,
      reason: '暂时无需求',
      currentUser: { id: 7, roleCodes: ['sales'], deptIds: [10] },
    })
    expect(CustomerRepository.update).toHaveBeenCalledWith(
      2,
      expect.objectContaining({ poolStatus: 'public', ownerUserId: null }),
      expect.anything(),
    )
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'release', fromUserId: 7, toUserId: null }),
      expect.anything(),
    )
  })
})

describe('CustomerFlowService.transfer', () => {
  it('转交给目标是自己 → TRANSFER_TARGET_INVALID', async () => {
    const flow = new CustomerFlowService()
    await expect(
      flow.transfer({
        customerId: 1,
        targetUserId: 7,
        currentUser: { id: 7, roleCodes: ['sales'], deptIds: [10] },
      }),
    ).rejects.toMatchObject({
      code: CrmErrorCode.CRM_CUSTOMER_TRANSFER_TARGET_INVALID,
    })
  })

  it('正常转交：owner 变更 + 写 transfer type=transfer', async () => {
    vi.spyOn(CustomerRepository, 'findById').mockResolvedValue(ownedCustomer)
    vi.spyOn(CustomerRepository, 'update').mockResolvedValue({
      ...ownedCustomer,
      ownerUserId: 8,
    })
    const createSpy = vi
      .spyOn(TransferRepository, 'create')
      .mockResolvedValue({} as any)

    const flow = new CustomerFlowService()
    await flow.transfer({
      customerId: 2,
      targetUserId: 8,
      reason: '区域调整',
      currentUser: { id: 7, roleCodes: ['sales'], deptIds: [10] },
    })
    expect(CustomerRepository.update).toHaveBeenCalledWith(
      2,
      expect.objectContaining({ ownerUserId: 8, poolStatus: 'owned' }),
      expect.anything(),
    )
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'transfer',
        fromUserId: 7,
        toUserId: 8,
      }),
      expect.anything(),
    )
  })
})
