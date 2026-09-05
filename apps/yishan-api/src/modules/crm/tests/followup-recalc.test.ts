/**
 * 跟进时间重算：create / update / delete 任何一条跟进之后，
 * 客户的 lastFollowUpAt / nextFollowUpAt 必须从剩余未删记录里重新推出，
 * 而**不是**取"这次操作的那条记录"的值（补录 / 删除最新一条都要正确）。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { dbManager } from '@/db'
import { ActivityService } from '../services/activity.service.js'
import { ActivityRepository } from '../repositories/activity.repository.js'
import { CustomerRepository } from '../repositories/customer.repository.js'

const customer = {
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
const user = { id: 7, roleCodes: ['sales'], deptIds: [10] }

beforeEach(() => {
  // 事务用 mock tx；其它操作全部 spy，避免碰真 DB
  vi.spyOn(dbManager, 'transaction').mockImplementation(async (fn: any) => fn({} as any))
  vi.spyOn(CustomerRepository, 'findById').mockResolvedValue(customer)
})
afterEach(() => vi.restoreAllMocks())

describe('ActivityService 重算客户跟进时间', () => {
  it('create：补录一条上周的跟进，客户的 lastFollowUpAt 仍按"最大 occurred_at"算', async () => {
    // 1) 计算结果是上周三（最新一次正常跟进的时间），不是补录这条上周一
    vi.spyOn(ActivityRepository, 'computeFollowUpState').mockResolvedValue({
      lastFollowUpAt: new Date('2026-08-26T10:00:00Z'),
      nextFollowUpAt: new Date('2026-09-02T10:00:00Z'),
    })
    const updateSpy = vi.spyOn(CustomerRepository, 'update').mockResolvedValue(customer)
    vi.spyOn(ActivityRepository, 'create').mockResolvedValue({
      id: 1,
      customerId: 1,
      contactId: null,
      type: 'phone',
      content: '补录',
      occurredAt: new Date('2026-08-24T10:00:00Z'),
      nextFollowUpAt: null,
      operatorUserId: 7,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    vi.spyOn(ActivityRepository, 'listByCustomerId').mockResolvedValue([])

    await new ActivityService().create(1, { type: 'phone', content: '补录' }, user)

    expect(updateSpy).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        lastFollowUpAt: new Date('2026-08-26T10:00:00Z'),
        nextFollowUpAt: new Date('2026-09-02T10:00:00Z'),
      }),
      expect.anything(),
    )
  })

  it('create：本次没填下次跟进时间时，客户的 nextFollowUpAt 由"现有记录里最近一条填过的"决定', async () => {
    vi.spyOn(ActivityRepository, 'computeFollowUpState').mockResolvedValue({
      lastFollowUpAt: new Date('2026-09-01T10:00:00Z'),
      nextFollowUpAt: new Date('2026-09-10T10:00:00Z'),
    })
    const updateSpy = vi.spyOn(CustomerRepository, 'update').mockResolvedValue(customer)
    vi.spyOn(ActivityRepository, 'create').mockResolvedValue({
      id: 1,
      customerId: 1,
      contactId: null,
      type: 'phone',
      content: 'x',
      occurredAt: new Date(),
      nextFollowUpAt: null, // 本次没填
      operatorUserId: 7,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    vi.spyOn(ActivityRepository, 'listByCustomerId').mockResolvedValue([])

    await new ActivityService().create(1, { type: 'phone', content: 'x' }, user)

    // 不允许被覆盖为 null —— 否则会丢掉之前定好的计划
    const call = updateSpy.mock.calls[0]
    expect(call?.[1]?.nextFollowUpAt).toEqual(new Date('2026-09-10T10:00:00Z'))
  })

  it('remove：删除后会按剩余记录重算（不能只 clear）', async () => {
    vi.spyOn(ActivityRepository, 'findById').mockResolvedValue({
      id: 1,
      customerId: 1,
      contactId: null,
      type: 'phone',
      content: 'x',
      occurredAt: new Date('2026-09-01T10:00:00Z'),
      nextFollowUpAt: null,
      operatorUserId: 7,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    vi.spyOn(ActivityRepository, 'softDelete').mockResolvedValue()
    vi.spyOn(ActivityRepository, 'computeFollowUpState').mockResolvedValue({
      lastFollowUpAt: new Date('2026-08-25T10:00:00Z'),
      nextFollowUpAt: null,
    })
    const updateSpy = vi.spyOn(CustomerRepository, 'update').mockResolvedValue(customer)

    await new ActivityService().remove(1, user)

    // 关键是 update 被调用，且 nextFollowUpAt 显式传了（不是被遗忘）
    expect(updateSpy).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ lastFollowUpAt: new Date('2026-08-25T10:00:00Z') }),
      expect.anything(),
    )
  })
})
