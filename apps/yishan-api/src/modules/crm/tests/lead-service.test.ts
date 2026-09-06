import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LeadService } from '../services/lead.service.js'
import { CrmErrorCode } from '../schemas/error-codes.js'
import { LeadRepository, type LeadStatus } from '../repositories/lead.repository.js'
import { LeadActivityRepository } from '../repositories/lead-activity.repository.js'
import { dbManager } from '@/db'

const salesperson = { id: 7, roleCodes: ['sales'], deptIds: [10] }

afterEach(() => {
  vi.restoreAllMocks()
})

describe('LeadService.create', () => {
  it('rejects a lead with an empty contact name', async () => {
    const service = new LeadService()

    await expect(
      service.create({ input: { name: '   ' }, currentUser: salesperson }),
    ).rejects.toMatchObject({
      code: CrmErrorCode.CRM_LEAD_CONTACT_REQUIRED,
    })
  })

  it('binds creator as default owner and never writes poolStatus=public', async () => {
    const create = vi.spyOn(LeadRepository, 'create').mockResolvedValue({
      id: 99,
      name: '王经理',
      companyName: null,
      mobile: null,
      phone: null,
      email: null,
      wechat: null,
      qq: null,
      sourceId: null,
      intention: null,
      status: 'new',
      ownerUserId: salesperson.id,
      ownerUserName: '销售',
      ownerDepartmentId: 10,
      poolStatus: 'owned',
      createdBy: salesperson.id,
      lastFollowUpAt: null,
      nextFollowUpAt: null,
      disqualifyReason: null,
      disqualifyCode: null,
      convertedCustomerId: null,
      convertedContactId: null,
      convertedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    await new LeadService().create({
      input: { name: '王经理', companyName: '示例公司' },
      currentUser: salesperson,
    })

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: '王经理',
        ownerUserId: salesperson.id,
        ownerDepartmentId: 10,
        createdBy: salesperson.id,
        creatorId: salesperson.id,
        updaterId: salesperson.id,
        poolStatus: 'owned',
      }),
    )
  })

  it('ignores ownerUserId / poolStatus submitted by the client', async () => {
    const create = vi.spyOn(LeadRepository, 'create').mockResolvedValue({
      id: 100,
      name: '王经理',
      companyName: null,
      mobile: null,
      phone: null,
      email: null,
      wechat: null,
      qq: null,
      sourceId: null,
      intention: null,
      status: 'new',
      ownerUserId: salesperson.id,
      ownerUserName: '销售',
      ownerDepartmentId: 10,
      poolStatus: 'owned',
      createdBy: salesperson.id,
      lastFollowUpAt: null,
      nextFollowUpAt: null,
      disqualifyReason: null,
      disqualifyCode: null,
      convertedCustomerId: null,
      convertedContactId: null,
      convertedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    // 即便前端传了 ownerUserId，服务端也按当前登录用户覆盖
    await new LeadService().create({
      input: {
        name: '王经理',
        // @ts-expect-error：客户端不应传，服务端忽略
        ownerUserId: 999,
      },
      currentUser: salesperson,
    })

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerUserId: salesperson.id,
        poolStatus: 'owned',
        createdBy: salesperson.id,
      }),
    )
    // 显式确认「public」从未被写入
    const args = create.mock.calls[0]?.[0] as unknown as Record<string, unknown> | undefined
    expect(args?.poolStatus).not.toBe('public')
  })
})

describe('LeadService.list', () => {
  it('limits a salesperson to their own leads and the public pool', async () => {
    const list = vi.spyOn(LeadRepository, 'list').mockResolvedValue({ rows: [], total: 0 })

    await new LeadService().list({}, salesperson)

    expect(list).toHaveBeenCalledWith(expect.objectContaining({
      ownerUserIds: [salesperson.id],
      ownerDepartmentIds: null,
    }))
  })
})

describe('LeadService.disqualify', () => {
  it('requires a reason before a lead can be marked invalid', async () => {
    await expect(
      new LeadService().disqualify({ leadId: 1, reason: ' ', currentUser: salesperson }),
    ).rejects.toMatchObject({ code: CrmErrorCode.CRM_LEAD_DISQUALIFY_REASON_REQUIRED })
  })
})

describe('LeadService.claim', () => {
  it('claims a lead from the pool for the current salesperson', async () => {
    vi.spyOn(dbManager, 'transaction').mockImplementation(async (callback: any) => callback({} as any))
    const claim = vi.spyOn(LeadRepository, 'claimInTx').mockResolvedValue(1)
    vi.spyOn(LeadActivityRepository, 'create').mockResolvedValue({
      id: 1, leadId: 1, type: 'owner_change', content: '暂未分配 → 销售', occurredAt: new Date(), nextFollowUpAt: null,
      operatorUserId: salesperson.id, createdAt: new Date(), updatedAt: new Date(),
    })
    vi.spyOn(LeadRepository, 'findById').mockResolvedValue({
      id: 1, name: '王经理', companyName: '示例公司', mobile: '13800000000', phone: null, email: null, wechat: null, qq: null, sourceId: null, intention: null,
      status: 'new', ownerUserId: salesperson.id, ownerUserName: '销售', ownerDepartmentId: 10,
      poolStatus: 'public', createdBy: null, lastFollowUpAt: null, nextFollowUpAt: null,
      disqualifyReason: null, disqualifyCode: null, convertedCustomerId: null, convertedContactId: null, convertedAt: null, createdAt: new Date(), updatedAt: new Date(),
    })

    await new LeadService().claim({ leadId: 1, currentUser: salesperson })

    expect(claim).toHaveBeenCalledWith(1, salesperson.id, 10, salesperson.id, expect.anything())
  })

  it('reports already-owned when claimInTx affects zero rows but lead exists', async () => {
    vi.spyOn(dbManager, 'transaction').mockImplementation(async (callback: any) => callback({} as any))
    vi.spyOn(LeadRepository, 'claimInTx').mockResolvedValue(0)
    // 已经有人领取，但 lead 仍存在
    vi.spyOn(LeadRepository, 'findById').mockResolvedValue({
      id: 1, name: '王经理', companyName: '示例公司', mobile: '13800000000', phone: null, email: null, wechat: null, qq: null, sourceId: null, intention: null,
      status: 'processing', ownerUserId: 999, ownerUserName: '其它销售', ownerDepartmentId: 10,
      poolStatus: 'owned', createdBy: salesperson.id, lastFollowUpAt: null, nextFollowUpAt: null,
      disqualifyReason: null, disqualifyCode: null, convertedCustomerId: null, convertedContactId: null, convertedAt: null, createdAt: new Date(), updatedAt: new Date(),
    })

    await expect(
      new LeadService().claim({ leadId: 1, currentUser: salesperson }),
    ).rejects.toMatchObject({ code: CrmErrorCode.CRM_LEAD_ALREADY_OWNED })
  })

  it('reports not-found when claim target row no longer exists', async () => {
    vi.spyOn(dbManager, 'transaction').mockImplementation(async (callback: any) => callback({} as any))
    vi.spyOn(LeadRepository, 'claimInTx').mockResolvedValue(0)
    vi.spyOn(LeadRepository, 'findById').mockResolvedValue(null)

    await expect(
      new LeadService().claim({ leadId: 1, currentUser: salesperson }),
    ).rejects.toMatchObject({ code: CrmErrorCode.CRM_LEAD_NOT_FOUND })
  })
})

function buildLead(overrides: Partial<{ status: LeadStatus; id: number }>) {
    return {
      id: 1,
      name: '王经理',
      companyName: '示例公司',
      mobile: '13800000000',
      phone: null,
      email: null,
      wechat: null,
      qq: null,
      sourceId: null,
      intention: null,
      status: 'new' as const,
      ownerUserId: salesperson.id,
      ownerUserName: '销售',
      ownerDepartmentId: 10,
      poolStatus: 'owned' as const,
      createdBy: salesperson.id,
      lastFollowUpAt: null,
      nextFollowUpAt: null,
      disqualifyReason: null,
      disqualifyCode: null,
      convertedCustomerId: null,
      convertedContactId: null,
      convertedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }
  }

describe('LeadService 终态守卫（已转化/无效）', () => {

  it('assign 拒绝在已转化线索上执行', async () => {
    vi.spyOn(LeadRepository, 'findById').mockResolvedValue(buildLead({ status: 'converted' }))

    await expect(
      new LeadService().assign({ leadId: 1, targetUserId: 8, currentUser: salesperson }),
    ).rejects.toMatchObject({ code: CrmErrorCode.CRM_LEAD_STATUS_INVALID })
  })

  it('qualify 拒绝在已无效线索上执行', async () => {
    vi.spyOn(LeadRepository, 'findById').mockResolvedValue(buildLead({ status: 'disqualified' }))

    await expect(
      new LeadService().qualify({ leadId: 1, currentUser: salesperson }),
    ).rejects.toMatchObject({ code: CrmErrorCode.CRM_LEAD_STATUS_INVALID })
  })

  it('disqualify 拒绝在已转化线索上执行', async () => {
    vi.spyOn(LeadRepository, 'findById').mockResolvedValue(buildLead({ status: 'converted' }))

    await expect(
      new LeadService().disqualify({ leadId: 1, reason: '误判', currentUser: salesperson }),
    ).rejects.toMatchObject({ code: CrmErrorCode.CRM_LEAD_STATUS_INVALID })
  })
})

describe('LeadService.assign 状态机', () => {
  beforeEach(() => {
    // assign 在 owner 实际变化时会写 owner_change activity；测试用 stub 屏蔽掉。
    vi.spyOn(LeadActivityRepository, 'create').mockResolvedValue({
      id: 1, leadId: 1, type: 'owner_change', content: '', occurredAt: new Date(), nextFollowUpAt: null,
      operatorUserId: salesperson.id, createdAt: new Date(), updatedAt: new Date(),
    })
  })

  it('把线索退回公海：ownerUserId=null, poolStatus=public', async () => {
    vi.spyOn(LeadRepository, 'findById').mockResolvedValue(buildLead({ status: 'processing' }))
    const update = vi.spyOn(LeadRepository, 'update').mockResolvedValue({
      ...buildLead({ status: 'processing' }),
      ownerUserId: null,
      poolStatus: 'public',
    })

    await new LeadService().assign({ leadId: 1, targetUserId: null, currentUser: salesperson })

    expect(update).toHaveBeenCalledWith(1, expect.objectContaining({
      ownerUserId: null,
      poolStatus: 'public',
    }))
  })

  it('把线索分配给同事：ownerUserId=target, poolStatus=owned', async () => {
    vi.spyOn(LeadRepository, 'findById').mockResolvedValue(buildLead({ status: 'processing' }))
    const update = vi.spyOn(LeadRepository, 'update').mockResolvedValue({
      ...buildLead({ status: 'processing' }),
      ownerUserId: 8,
    })

    await new LeadService().assign({ leadId: 1, targetUserId: 8, currentUser: salesperson })

    expect(update).toHaveBeenCalledWith(1, expect.objectContaining({
      ownerUserId: 8,
      poolStatus: 'owned',
    }))
  })

  it('自指分配（同一人）不写 activity，避免噪音', async () => {
    vi.spyOn(LeadRepository, 'findById').mockResolvedValue(buildLead({ status: 'processing' }))
    const update = vi.spyOn(LeadRepository, 'update').mockResolvedValue(buildLead({ status: 'processing' }))
    const activity = vi.spyOn(LeadActivityRepository, 'create')

    await new LeadService().assign({ leadId: 1, targetUserId: salesperson.id, currentUser: salesperson })

    expect(update).toHaveBeenCalledWith(1, expect.objectContaining({
      ownerUserId: salesperson.id,
      poolStatus: 'owned',
    }))
    expect(activity).not.toHaveBeenCalled()
  })
})

describe('LeadService.update（编辑资料）', () => {
  beforeEach(() => {
    vi.spyOn(LeadActivityRepository, 'create').mockResolvedValue({
      id: 1, leadId: 1, type: 'profile_edit', content: '', occurredAt: new Date(), nextFollowUpAt: null,
      operatorUserId: salesperson.id, createdAt: new Date(), updatedAt: new Date(),
    })
  })

  it('白名单字段写入，ownerUserId/status/poolStatus/converted* 等被忽略', async () => {
    vi.spyOn(LeadRepository, 'findById').mockResolvedValue(buildLead({ status: 'processing' }))
    const update = vi.spyOn(LeadRepository, 'update').mockResolvedValue(buildLead({ status: 'processing' }))

    // 用类型断言模拟客户端提交越权字段，服务端应忽略
    const maliciousInput = {
      companyName: '上海拓维信息技术有限公司',
      ownerUserId: 999,
      status: 'qualified',
      poolStatus: 'public',
    } as unknown as Parameters<typeof LeadService.prototype.update>[0]['input']

    await new LeadService().update({
      leadId: 1,
      input: maliciousInput,
      currentUser: salesperson,
    })

    const written = update.mock.calls[0]?.[1] as unknown as Record<string, unknown> | undefined
    expect(written).toBeDefined()
    expect(written?.companyName).toBe('上海拓维信息技术有限公司')
    expect(written).not.toHaveProperty('ownerUserId')
    expect(written).not.toHaveProperty('status')
    expect(written).not.toHaveProperty('poolStatus')
    expect(written).not.toHaveProperty('convertedCustomerId')
  })

  it('联系人为空字符串时拒绝', async () => {
    vi.spyOn(LeadRepository, 'findById').mockResolvedValue(buildLead({ status: 'processing' }))
    const update = vi.spyOn(LeadRepository, 'update')

    await expect(
      new LeadService().update({
        leadId: 1,
        input: { name: '   ' },
        currentUser: salesperson,
      }),
    ).rejects.toMatchObject({ code: CrmErrorCode.CRM_LEAD_CONTACT_REQUIRED })

    expect(update).not.toHaveBeenCalled()
  })

  it('终态线索（已转化 / 已无效）不可编辑', async () => {
    vi.spyOn(LeadRepository, 'findById').mockResolvedValue(buildLead({ status: 'converted' }))

    await expect(
      new LeadService().update({
        leadId: 1,
        input: { companyName: '新公司' },
        currentUser: salesperson,
      }),
    ).rejects.toMatchObject({ code: CrmErrorCode.CRM_LEAD_STATUS_INVALID })
  })

  it('无字段变化时直接返回，不写库、不写审计', async () => {
    vi.spyOn(LeadRepository, 'findById').mockResolvedValue(buildLead({ status: 'processing' }))
    const update = vi.spyOn(LeadRepository, 'update')
    const activity = vi.spyOn(LeadActivityRepository, 'create')

    const result = await new LeadService().update({
      leadId: 1,
      input: {
        // 与 buildLead 默认值完全相同
        companyName: '示例公司',
        mobile: '13800000000',
      },
      currentUser: salesperson,
    })

    expect(result).toBeDefined()
    expect(update).not.toHaveBeenCalled()
    expect(activity).not.toHaveBeenCalled()
  })

  it('字段实际变化时写入并产生 diff 审计', async () => {
    vi.spyOn(LeadRepository, 'findById').mockResolvedValue(buildLead({ status: 'processing' }))
    const update = vi.spyOn(LeadRepository, 'update').mockResolvedValue({
      ...buildLead({ status: 'processing' }),
      companyName: '上海拓维信息技术有限公司',
      mobile: '13900000000',
    })
    const activity = vi.spyOn(LeadActivityRepository, 'create')

    await new LeadService().update({
      leadId: 1,
      input: {
        companyName: '上海拓维信息技术有限公司',
        mobile: '13900000000',
        // 微信字段未提供，不应出现在审计中
      },
      currentUser: salesperson,
    })

    expect(update).toHaveBeenCalledWith(1, expect.objectContaining({
      companyName: '上海拓维信息技术有限公司',
      mobile: '13900000000',
    }))

    expect(activity).toHaveBeenCalledTimes(1)
    const args = activity.mock.calls[0]?.[0] as unknown as Record<string, unknown> | undefined
    expect(args?.type).toBe('profile_edit')
    expect(String(args?.content)).toContain('公司：示例公司 → 上海拓维信息技术有限公司')
    expect(String(args?.content)).toContain('手机：13800000000 → 13900000000')
    expect(String(args?.content)).not.toContain('微信')
  })
})
