import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LeadService } from '../services/lead.service.js'
import { CrmErrorCode } from '../schemas/error-codes.js'
import { LeadRepository, buildLeadListWhere, type LeadRow } from '../repositories/lead.repository.js'
import { LeadActivityRepository } from '../repositories/lead-activity.repository.js'
import { dbManager } from '@/db'
import { MySqlDialect } from 'drizzle-orm/mysql-core'
import { LeadRespSchema } from '../schemas/lead.schema.js'

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

  it('binds creator as the default owner', async () => {
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
      sourceName: null,
      intention: null,
      status: 'pending',
      ownerUserId: salesperson.id,
      ownerUserName: '销售',
      ownerDepartmentId: 10,
      createdBy: salesperson.id,
      createdByUserName: '销售',
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
      }),
    )
  })

  it('ignores ownerUserId submitted by the client', async () => {
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
      sourceName: null,
      intention: null,
      status: 'pending',
      ownerUserId: salesperson.id,
      ownerUserName: '销售',
      ownerDepartmentId: 10,
      createdBy: salesperson.id,
      createdByUserName: '销售',
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
        createdBy: salesperson.id,
      }),
    )
    // 归属只由 ownerUserId 决定。
    const args = create.mock.calls[0]?.[0] as unknown as Record<string, unknown> | undefined
    expect(args).not.toHaveProperty('poolStatus')
  })
})

describe('LeadService.list', () => {
  it('limits a salesperson to their own leads without auto-including the pool', async () => {
    const list = vi.spyOn(LeadRepository, 'list').mockResolvedValue({ rows: [], total: 0 })

    await new LeadService().list({}, salesperson)

    expect(list).toHaveBeenCalledWith(expect.objectContaining({
      ownerUserIds: [salesperson.id],
      ownerDepartmentIds: null,
    }))
  })
})

describe('lead pool ownership query', () => {
  const dialect = new MySqlDialect()

  it('lists every owner-null lead in the pool', () => {
    const where = buildLeadListWhere({
      pool: true,
      ownerUserIds: [salesperson.id],
      ownerDepartmentIds: null,
    })
    expect(where).toBeDefined()
    const query = dialect.sqlToQuery(where!)

    expect(query.sql).toMatch(/owner_user_id`?\s+is\s+null/i)
    expect(query.sql).not.toMatch(/pool_status/i)
    expect(query.sql).not.toMatch(/owner_user_id\s+in/i)
  })

  it('does not auto-include owner-null leads in a scoped main list', () => {
    const where = buildLeadListWhere({
      ownerUserIds: [salesperson.id],
      ownerDepartmentIds: null,
    })
    expect(where).toBeDefined()
    const query = dialect.sqlToQuery(where!)

    expect(query.sql).toMatch(/owner_user_id`?\s+in/i)
    expect(query.sql).not.toMatch(/pool_status/i)
    expect(query.sql).not.toMatch(/owner_user_id`?\s+is\s+null/i)
  })

  it('does not expose a second pool-state field in lead responses', () => {
    expect(LeadRespSchema.properties).not.toHaveProperty('poolStatus')
  })
})

describe('LeadService.disqualify', () => {
  it('requires a reason before a lead can be marked invalid', async () => {
    await expect(
      new LeadService().disqualify({ leadId: 1, code: 'no_demand', reason: ' ', currentUser: salesperson }),
    ).rejects.toMatchObject({ code: CrmErrorCode.CRM_LEAD_DISQUALIFY_REASON_REQUIRED })
  })

  it('stores code and explanation when disqualifying and writes a readable audit event', async () => {
    vi.spyOn(dbManager, 'transaction').mockImplementation(async (callback: any) => callback({} as any))
    vi.spyOn(LeadRepository, 'findById').mockResolvedValue(buildLead({ status: 'contact_valid' }))
    const update = vi.spyOn(LeadRepository, 'update').mockResolvedValue({
      ...buildLead({ status: 'contact_invalid' }),
      disqualifyCode: 'no_demand',
      disqualifyReason: '本年度无采购计划',
    })
    const activity = vi.spyOn(LeadActivityRepository, 'create').mockResolvedValue({
      id: 99, leadId: 1, type: 'status_change', content: '', occurredAt: new Date(), nextFollowUpAt: null,
      operatorUserId: salesperson.id, createdAt: new Date(), updatedAt: new Date(),
    })

    const result = await new LeadService().disqualify({
      leadId: 1,
      code: 'no_demand',
      reason: '本年度无采购计划',
      currentUser: salesperson,
    })

    expect(update).toHaveBeenCalledWith(1, expect.objectContaining({
      status: 'contact_invalid',
      disqualifyCode: 'no_demand',
      disqualifyReason: '本年度无采购计划',
    }), expect.anything())
    expect(result.disqualifyCode).toBe('no_demand')
    expect(activity).toHaveBeenCalledWith(expect.objectContaining({
      type: 'status_change',
      content: expect.stringContaining('无需求'),
    }), expect.anything())
  })
})

describe('LeadService.qualify', () => {
  it('refuses qualification without a usable contact channel', async () => {
    vi.spyOn(dbManager, 'transaction').mockImplementation(async (callback: any) => callback({} as any))
    vi.spyOn(LeadRepository, 'findById').mockResolvedValue(buildLead({
      status: 'pending',
      mobile: null,
      phone: null,
      email: null,
      wechat: null,
    }))

    await expect(
      new LeadService().qualify({
        leadId: 1,
        evidence: '预算已确认',
        nextAction: '安排演示',
        currentUser: salesperson,
      }),
    ).rejects.toMatchObject({ code: CrmErrorCode.CRM_LEAD_QUALIFICATION_REQUIRED })
  })

  it('stores evidence + next action and writes the 联系方式有效 audit event', async () => {
    vi.spyOn(dbManager, 'transaction').mockImplementation(async (callback: any) => callback({} as any))
    vi.spyOn(LeadRepository, 'findById').mockResolvedValue(buildLead({ status: 'pending' }))
    vi.spyOn(LeadRepository, 'update').mockResolvedValue(buildLead({ status: 'contact_valid' }))
    const activity = vi.spyOn(LeadActivityRepository, 'create').mockResolvedValue({
      id: 101, leadId: 1, type: 'status_change', content: '', occurredAt: new Date(), nextFollowUpAt: null,
      operatorUserId: salesperson.id, createdAt: new Date(), updatedAt: new Date(),
    })

    await new LeadService().qualify({
      leadId: 1,
      evidence: '  预算已确认  ',
      nextAction: '  安排演示  ',
      currentUser: salesperson,
    })

    expect(activity).toHaveBeenCalledWith(expect.objectContaining({
      type: 'status_change',
      content: expect.stringMatching(/未处理 → 联系方式有效[\s\S]*预算已确认[\s\S]*安排演示/),
    }), expect.anything())
  })
})

describe('LeadService.reactivate', () => {
  it('allows only a contact-invalid lead to reactivate to pending', async () => {
    vi.spyOn(dbManager, 'transaction').mockImplementation(async (callback: any) => callback({} as any))
    vi.spyOn(LeadRepository, 'findById')
      .mockResolvedValueOnce(buildLead({ status: 'contact_invalid' }))
      .mockResolvedValueOnce(buildLead({ status: 'pending' }))
    const update = vi.spyOn(LeadRepository, 'update').mockResolvedValue(buildLead({ status: 'pending' }))
    const activity = vi.spyOn(LeadActivityRepository, 'create').mockResolvedValue({
      id: 110, leadId: 1, type: 'status_change', content: '', occurredAt: new Date(), nextFollowUpAt: null,
      operatorUserId: salesperson.id, createdAt: new Date(), updatedAt: new Date(),
    })

    await new LeadService().reactivate({
      leadId: 1,
      reason: '客户已重新接洽',
      currentUser: salesperson,
    })

    expect(update).toHaveBeenCalledWith(1, expect.objectContaining({
      status: 'pending',
      disqualifyCode: null,
      disqualifyReason: null,
    }), expect.anything())
    expect(activity).toHaveBeenCalledWith(expect.objectContaining({
      type: 'status_change',
      content: expect.stringContaining('重新激活'),
    }), expect.anything())
  })

  it('rejects reactivate from a non-invalid lead', async () => {
    vi.spyOn(dbManager, 'transaction').mockImplementation(async (callback: any) => callback({} as any))
    vi.spyOn(LeadRepository, 'findById').mockResolvedValue(buildLead({ status: 'contact_valid' }))

    await expect(
      new LeadService().reactivate({ leadId: 1, reason: '再次尝试', currentUser: salesperson }),
    ).rejects.toMatchObject({ code: CrmErrorCode.CRM_LEAD_REACTIVATE_INVALID_STATE })
  })

  it('rejects reactivate from a closed lead', async () => {
    vi.spyOn(dbManager, 'transaction').mockImplementation(async (callback: any) => callback({} as any))
    vi.spyOn(LeadRepository, 'findById').mockResolvedValue(buildLead({ status: 'closed' }))

    await expect(
      new LeadService().reactivate({ leadId: 1, reason: '再次尝试', currentUser: salesperson }),
    ).rejects.toMatchObject({ code: CrmErrorCode.CRM_LEAD_REACTIVATE_INVALID_STATE })
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
      id: 1, name: '王经理', companyName: '示例公司', mobile: '13800000000', phone: null, email: null, wechat: null, qq: null, sourceId: null, sourceName: null, intention: null,
      status: 'pending', ownerUserId: salesperson.id, ownerUserName: '销售', ownerDepartmentId: 10,
      createdBy: null, createdByUserName: null, lastFollowUpAt: null, nextFollowUpAt: null,
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
      id: 1, name: '王经理', companyName: '示例公司', mobile: '13800000000', phone: null, email: null, wechat: null, qq: null, sourceId: null, sourceName: null, intention: null,
      status: 'contact_valid', ownerUserId: 999, ownerUserName: '其它销售', ownerDepartmentId: 10,
      createdBy: salesperson.id, createdByUserName: '销售', lastFollowUpAt: null, nextFollowUpAt: null,
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

function buildLead(overrides: Partial<LeadRow> = {}) {
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
      sourceName: null,
      intention: null,
      status: 'pending' as const,
      ownerUserId: salesperson.id,
      ownerUserName: '销售',
      ownerDepartmentId: 10,
      createdBy: salesperson.id,
      createdByUserName: '销售',
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
    vi.spyOn(LeadRepository, 'findById').mockResolvedValue(buildLead({ convertedCustomerId: 99 }))

    await expect(
      new LeadService().assign({ leadId: 1, targetUserId: 8, currentUser: salesperson }),
    ).rejects.toMatchObject({ code: CrmErrorCode.CRM_LEAD_STATUS_INVALID })
  })

  it('qualify 拒绝在已无效线索上执行', async () => {
    vi.spyOn(LeadRepository, 'findById').mockResolvedValue(buildLead({ status: 'contact_invalid' }))

    await expect(
      new LeadService().qualify({
        leadId: 1,
        evidence: '预算已确认',
        nextAction: '安排演示',
        currentUser: salesperson,
      }),
    ).rejects.toMatchObject({ code: CrmErrorCode.CRM_LEAD_STATUS_INVALID })
  })

  it('disqualify 拒绝在已转化线索上执行', async () => {
    vi.spyOn(LeadRepository, 'findById').mockResolvedValue(buildLead({ convertedCustomerId: 99 }))

    await expect(
      new LeadService().disqualify({ leadId: 1, code: 'rejected', reason: '误判', currentUser: salesperson }),
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

  it('把线索退回公海：ownerUserId=null', async () => {
    vi.spyOn(LeadRepository, 'findById').mockResolvedValue(buildLead({ status: 'contact_valid' }))
    const update = vi.spyOn(LeadRepository, 'update').mockResolvedValue({
      ...buildLead({ status: 'contact_valid' }),
      ownerUserId: null,
    })

    await new LeadService().assign({ leadId: 1, targetUserId: null, currentUser: salesperson })

    expect(update).toHaveBeenCalledWith(1, expect.objectContaining({
      ownerUserId: null,
    }))
  })

  it('把线索分配给同事：ownerUserId=target', async () => {
    vi.spyOn(LeadRepository, 'findById').mockResolvedValue(buildLead({ status: 'contact_valid' }))
    const update = vi.spyOn(LeadRepository, 'update').mockResolvedValue({
      ...buildLead({ status: 'contact_valid' }),
      ownerUserId: 8,
    })

    await new LeadService().assign({ leadId: 1, targetUserId: 8, currentUser: salesperson })

    expect(update).toHaveBeenCalledWith(1, expect.objectContaining({
      ownerUserId: 8,
    }))
  })

  it('自指分配（同一人）不写 activity，避免噪音', async () => {
    vi.spyOn(LeadRepository, 'findById').mockResolvedValue(buildLead({ status: 'contact_valid' }))
    const update = vi.spyOn(LeadRepository, 'update').mockResolvedValue(buildLead({ status: 'contact_valid' }))
    const activity = vi.spyOn(LeadActivityRepository, 'create')

    await new LeadService().assign({ leadId: 1, targetUserId: salesperson.id, currentUser: salesperson })

    expect(update).toHaveBeenCalledWith(1, expect.objectContaining({
      ownerUserId: salesperson.id,
    }))
    expect(activity).not.toHaveBeenCalled()
  })

  it('allows a supervisor to allocate an owner-null lead from the pool', async () => {
    vi.spyOn(LeadRepository, 'findById').mockResolvedValue(buildLead({
      ownerUserId: null,
      ownerDepartmentId: null,
    }))
    const update = vi.spyOn(LeadRepository, 'update').mockResolvedValue(buildLead({ ownerUserId: 8 }))

    await new LeadService().assign({ leadId: 1, targetUserId: 8, currentUser: salesperson })

    expect(update).toHaveBeenCalledWith(1, expect.objectContaining({ ownerUserId: 8 }))
  })

  it('does not expose an owned lead outside the salesperson scope', async () => {
    vi.spyOn(LeadRepository, 'findById').mockResolvedValue(buildLead({
      ownerUserId: 999,
      ownerDepartmentId: 999,
    }))
    const update = vi.spyOn(LeadRepository, 'update')

    await expect(
      new LeadService().assign({ leadId: 1, targetUserId: null, currentUser: salesperson }),
    ).rejects.toMatchObject({ code: CrmErrorCode.CRM_LEAD_NOT_FOUND })

    expect(update).not.toHaveBeenCalled()
  })
})

describe('LeadService.update（编辑资料）', () => {
  beforeEach(() => {
    vi.spyOn(LeadActivityRepository, 'create').mockResolvedValue({
      id: 1, leadId: 1, type: 'profile_edit', content: '', occurredAt: new Date(), nextFollowUpAt: null,
      operatorUserId: salesperson.id, createdAt: new Date(), updatedAt: new Date(),
    })
  })

  it('白名单字段写入，ownerUserId/status/converted* 等被忽略', async () => {
    vi.spyOn(LeadRepository, 'findById').mockResolvedValue(buildLead({ status: 'contact_valid' }))
    const update = vi.spyOn(LeadRepository, 'update').mockResolvedValue(buildLead({ status: 'contact_valid' }))

    // 用类型断言模拟客户端提交越权字段，服务端应忽略
    const maliciousInput = {
      companyName: '上海拓维信息技术有限公司',
      ownerUserId: 999,
      status: 'contact_valid',
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
    expect(written).not.toHaveProperty('convertedCustomerId')
  })

  it('联系人为空字符串时拒绝', async () => {
    vi.spyOn(LeadRepository, 'findById').mockResolvedValue(buildLead({ status: 'contact_valid' }))
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

  it('已转化或联系方式无效的线索不可编辑', async () => {
    vi.spyOn(LeadRepository, 'findById').mockResolvedValue(buildLead({ convertedCustomerId: 99 }))

    await expect(
      new LeadService().update({
        leadId: 1,
        input: { companyName: '新公司' },
        currentUser: salesperson,
      }),
    ).rejects.toMatchObject({ code: CrmErrorCode.CRM_LEAD_STATUS_INVALID })
  })

  it('无字段变化时直接返回，不写库、不写审计', async () => {
    vi.spyOn(LeadRepository, 'findById').mockResolvedValue(buildLead({ status: 'contact_valid' }))
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
    vi.spyOn(LeadRepository, 'findById').mockResolvedValue(buildLead({ status: 'contact_valid' }))
    const update = vi.spyOn(LeadRepository, 'update').mockResolvedValue({
      ...buildLead({ status: 'contact_valid' }),
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
