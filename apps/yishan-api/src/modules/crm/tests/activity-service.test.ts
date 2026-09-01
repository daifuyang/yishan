/**
 * ActivityService 单测。
 *
 * 关键不变量：写跟进 + 更新客户跟进时间必须在同一事务。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { dbManager } from '@/db'
import { ActivityService } from '../services/activity.service.js'
import { ActivityRepository } from '../repositories/activity.repository.js'
import { CustomerRepository } from '../repositories/customer.repository.js'

const ownedCustomer = {
  id: 1,
  code: null,
  name: 'A',
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
  ownerUserId: 7,
  ownerDepartmentId: 10,
  poolStatus: 'owned',
  lastFollowUpAt: null,
  nextFollowUpAt: null,
  remark: null,
  creatorId: 1,
  createdAt: new Date(),
  updaterId: 1,
  updatedAt: new Date(),
}

const currentUser = { id: 7, roleCodes: ['sales'], deptIds: [10] }

beforeEach(() => {
  vi.spyOn(dbManager, 'transaction').mockImplementation(async (fn: any) =>
    fn({} as any),
  )
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ActivityService.create', () => {
  it('客户属于当前用户 → 写跟进 + 更新客户跟进时间（同一事务）', async () => {
    vi.spyOn(CustomerRepository, 'findById').mockResolvedValue(ownedCustomer)
    vi.spyOn(ActivityRepository, 'create').mockResolvedValue({
      id: 100,
      customerId: 1,
      contactId: null,
      type: 'phone',
      content: '通话 5 分钟',
      occurredAt: new Date('2026-01-01T10:00:00Z'),
      nextFollowUpAt: null,
      operatorUserId: 7,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    const updateSpy = vi
      .spyOn(CustomerRepository, 'update')
      .mockResolvedValue(ownedCustomer)
    vi.spyOn(ActivityRepository, 'listByCustomerId').mockResolvedValue([
      {
        id: 100,
        customerId: 1,
        contactId: null,
        type: 'phone',
        content: '通话 5 分钟',
        occurredAt: new Date(),
        nextFollowUpAt: null,
        operatorUserId: 7,
        operatorUserName: 'sales',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ])

    const service = new ActivityService()
    await service.create(
      1,
      { type: 'phone', content: '通话 5 分钟' },
      currentUser,
    )

    // 关键断言：update 与 create 都被调用，且都在 tx 内
    expect(ActivityRepository.create).toHaveBeenCalledTimes(1)
    expect(updateSpy).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ lastFollowUpAt: expect.any(Date) }),
      expect.anything(),
    )
  })

  it('客户不属于当前用户（且不在数据范围） → FORBIDDEN', async () => {
    vi.spyOn(CustomerRepository, 'findById').mockResolvedValue({
      ...ownedCustomer,
      ownerUserId: 999,
      ownerDepartmentId: 999,
    })
    const service = new ActivityService()
    await expect(
      service.create(1, { type: 'phone', content: 'x' }, currentUser),
    ).rejects.toThrow()
  })

  it('非法的 type → ACTIVITY_TYPE_INVALID', async () => {
    vi.spyOn(CustomerRepository, 'findById').mockResolvedValue(ownedCustomer)
    const service = new ActivityService()
    await expect(
      service.create(
        1,
        { type: 'foo' as any, content: 'x' },
        currentUser,
      ),
    ).rejects.toMatchObject({ code: 33203 })
  })

  it('公海客户不能写跟进', async () => {
    vi.spyOn(CustomerRepository, 'findById').mockResolvedValue({
      ...ownedCustomer,
      ownerUserId: null,
      ownerDepartmentId: null,
      poolStatus: 'public',
    })
    const service = new ActivityService()
    await expect(
      service.create(1, { type: 'phone', content: 'x' }, currentUser),
    ).rejects.toThrow()
  })
})
