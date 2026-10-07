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
  statusCode: null,
  sourceCode: null,
  levelCode: null,
  industryCode: null,
  phone: null,
  website: null,
  province: null,
  city: null,
  address: null,
  ownerUserId: 7,
  ownerDepartmentId: 10,
  poolStatus: 'owned',
  poolEnteredAt: null,
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
  it('returns the inserted record even when an older record has a later follow-up time', async () => {
    vi.spyOn(CustomerRepository, 'findById').mockResolvedValue(ownedCustomer)
    const records: Awaited<ReturnType<typeof ActivityRepository.listByCustomerId>> = []
    vi.spyOn(ActivityRepository, 'create').mockImplementation(async input => {
      const row = {
        ...input, id: 59, customerId: 1, contactId: null, category: 'follow_up',
        occurredAt: new Date('2026-10-07T05:10:00Z'), nextFollowUpAt: null,
        result: null, nextFollowUpPlan: null, attachmentIds: null, metadata: null,
        plannedAt: null, location: null, participants: null, visitResultCode: null,
        summary: null, entityRefType: 'customer', operatorUserName: '愚公',
        createdAt: new Date(), updatedAt: new Date(),
      } satisfies (typeof records)[number]
      records.push(row)
      return row
    })
    vi.spyOn(ActivityRepository, 'findById').mockImplementation(async id => records.find(row => row.id === id) ?? null)
    vi.spyOn(ActivityRepository, 'computeFollowUpState').mockResolvedValue({ lastFollowUpAt: null, nextFollowUpAt: null })
    vi.spyOn(CustomerRepository, 'update').mockResolvedValue(ownedCustomer)
    vi.spyOn(ActivityRepository, 'listByCustomerId').mockImplementation(async () => [
      { ...records[0], id: 30, content: '旧记录', occurredAt: new Date('2026-10-08T06:00:00Z') },
      ...records,
    ])
    const saved = await new ActivityService().create(1, { type: 'phone', content: '本次新跟进' }, currentUser)
    expect(saved).toMatchObject({ id: 59, content: '本次新跟进', type: 'phone' })
    const list = await ActivityRepository.listByCustomerId(1)
    expect(list.map(row => row.id)).toEqual([30, 59])
  })
  it('persists follow-up attachment ids and extensible metadata', async () => {
    vi.spyOn(CustomerRepository, 'findById').mockResolvedValue(ownedCustomer)
    const createSpy = vi.spyOn(ActivityRepository, 'create').mockResolvedValue({
      id: 101,
      customerId: 1,
      contactId: null,
      entityType: 'customer',
      entityId: 1,
      entityRefType: 'customer',
      category: 'follow_up',
      type: 'phone',
      content: 'with attachment',
      occurredAt: new Date(),
      nextFollowUpAt: null,
      result: null,
      nextFollowUpPlan: null,
      plannedAt: null,
      location: null,
      participants: null,
      visitResultCode: null,
      summary: null,
      attachmentIds: [42, 43],
      metadata: { source: 'drawer' },
      operatorUserId: 7,

      operatorUserName: '愚公',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    vi.spyOn(ActivityRepository, 'computeFollowUpState').mockResolvedValue({
      lastFollowUpAt: new Date(),
      nextFollowUpAt: null,
    })
    vi.spyOn(CustomerRepository, 'update').mockResolvedValue(ownedCustomer)
    vi.spyOn(ActivityRepository, 'listByCustomerId').mockResolvedValue([])

    await new ActivityService().create(
      1,
      {
        type: 'phone',
        content: 'with attachment',
        attachmentIds: [42, 43],
        metadata: { source: 'drawer' },
      },
      currentUser,
    )

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({ attachmentIds: [42, 43], metadata: { source: 'drawer' } }),
      expect.anything(),
    )
  })

  it('客户属于当前用户 → 写跟进 + 更新客户跟进时间（同一事务）', async () => {
    vi.spyOn(CustomerRepository, 'findById').mockResolvedValue(ownedCustomer)
    vi.spyOn(ActivityRepository, 'create').mockResolvedValue({
      id: 100,
      customerId: 1,
      contactId: null,
      entityType: 'customer',
      entityId: 1,
      entityRefType: 'customer',
      category: 'follow_up',
      type: 'phone',
      content: '通话 5 分钟',
      occurredAt: new Date('2026-01-01T10:00:00Z'),
      nextFollowUpAt: null,
      result: null,
      nextFollowUpPlan: null,
      plannedAt: null,
      location: null,
      participants: null,
      visitResultCode: null,
      summary: null,
      operatorUserId: 7,

      operatorUserName: '愚公',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    // service 现在通过 ActivityRepository.computeFollowUpState 算"应该写成什么时间"，
    // 单测里不需要再走真实 SQL，直接给一个固定值，避免对 dbManager 里的 mock tx 产生依赖。
    vi.spyOn(ActivityRepository, 'computeFollowUpState').mockResolvedValue({
      lastFollowUpAt: new Date('2026-01-01T10:00:00Z'),
      nextFollowUpAt: null,
    })
    const updateSpy = vi
      .spyOn(CustomerRepository, 'update')
      .mockResolvedValue(ownedCustomer)
    vi.spyOn(ActivityRepository, 'listByCustomerId').mockResolvedValue([
      {
        id: 100,
        customerId: 1,
        contactId: null,
        entityType: 'customer',
        entityId: 1,
        entityRefType: 'customer',
        category: 'follow_up',
        type: 'phone',
        content: '通话 5 分钟',
        occurredAt: new Date(),
        nextFollowUpAt: null,
        result: null,
        nextFollowUpPlan: null,
        plannedAt: null,
        location: null,
        participants: null,
        visitResultCode: null,
        summary: null,
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

  it('persists follow-up result and next plan without changing customer status', async () => {
    vi.spyOn(CustomerRepository, 'findById').mockResolvedValue({
      ...ownedCustomer,
      statusCode: 'potential',
      relationshipStatus: 'potential',
    })
    const createSpy = vi.spyOn(ActivityRepository, 'create').mockResolvedValue({
      id: 102,
      customerId: 1,
      contactId: 9,
      entityType: 'customer',
      entityId: 1,
      entityRefType: 'customer',
      category: 'follow_up',
      type: 'phone',
      content: '首次电话沟通',
      occurredAt: new Date('2026-10-01T10:00:00Z'),
      nextFollowUpAt: new Date('2026-10-03T02:00:00Z'),
      result: 'interested',
      nextFollowUpPlan: '发送产品介绍资料',
      plannedAt: null,
      location: null,
      participants: null,
      visitResultCode: null,
      summary: null,
      operatorUserId: 7,

      operatorUserName: '愚公',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    vi.spyOn(ActivityRepository, 'computeFollowUpState').mockResolvedValue({
      lastFollowUpAt: new Date('2026-10-01T10:00:00Z'),
      nextFollowUpAt: new Date('2026-10-03T02:00:00Z'),
    })
    vi.spyOn(CustomerRepository, 'update').mockResolvedValue(ownedCustomer)
    vi.spyOn(ActivityRepository, 'listByCustomerId').mockResolvedValue([])
    const lifecycleUpdate = vi.spyOn(CustomerRepository, 'updateLifecycle')

    await new ActivityService().create(
      1,
      {
        type: 'phone',
        contactId: 9,
        content: '首次电话沟通',
        result: 'interested',
        nextFollowUpPlan: '发送产品介绍资料',
        nextFollowUpAt: '2026-10-03T02:00:00.000Z',
      },
      currentUser,
    )

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'follow_up',
        type: 'phone',
        contactId: 9,
        result: 'interested',
        nextFollowUpPlan: '发送产品介绍资料',
      }),
      expect.anything(),
    )
    expect(lifecycleUpdate).not.toHaveBeenCalled()
  })
})

describe('ActivityService.listByCustomerId', () => {
  it('converts the public limit option to the repository pageSize option', async () => {
    vi.spyOn(CustomerRepository, 'findById').mockResolvedValue(ownedCustomer)
    const list = vi.spyOn(ActivityRepository, 'list').mockResolvedValue({ rows: [], total: 0 })

    await new ActivityService().listByCustomerId(1, currentUser, { limit: 20 })

    expect(list).toHaveBeenCalledWith({ customerId: 1, pageSize: 20 }, undefined)
  })
})
