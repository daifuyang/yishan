import { afterEach, describe, expect, it, vi } from 'vitest'
import { dbManager } from '@/db'
import { LeadRepository, type LeadRow } from '../repositories/lead.repository.js'
import { LeadActivityRepository } from '../repositories/lead-activity.repository.js'
import { CustomerRepository, type CustomerRow } from '../repositories/customer.repository.js'
import { ContactRepository, type ContactRow } from '../repositories/contact.repository.js'
import { LeadConversionService } from '../services/lead-conversion.service.js'
import { CrmErrorCode } from '../schemas/error-codes.js'

const salesperson = { id: 7, roleCodes: ['sales'], deptIds: [10] }

function buildLead(overrides: Partial<LeadRow> = {}): LeadRow {
  return {
    id: 42,
    name: '王经理',
    companyName: '上海示例有限公司',
    mobile: '13800000000',
    phone: null,
    email: 'wang@example.com',
    wechat: null,
    qq: null,
    sourceId: 11,
    intention: '需要 CRM 方案',
    status: 'qualified',
    ownerUserId: salesperson.id,
    ownerUserName: '销售',
    ownerDepartmentId: 10,
    poolStatus: 'owned',
    createdBy: salesperson.id,
    lastFollowUpAt: new Date(),
    nextFollowUpAt: new Date(),
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

function buildCustomer(overrides: Partial<CustomerRow> = {}): CustomerRow {
  return {
    id: 1,
    code: null,
    name: '上海示例有限公司',
    type: 'enterprise',
    statusId: null,
    sourceId: 11,
    level: null,
    industry: null,
    phone: '13800000000',
    website: null,
    province: null,
    city: null,
    address: null,
    ownerUserId: salesperson.id,
    ownerDepartmentId: 10,
    poolStatus: 'owned',
    lastFollowUpAt: null,
    nextFollowUpAt: null,
    remark: null,
    creatorId: salesperson.id,
    createdAt: new Date(),
    updaterId: salesperson.id,
    updatedAt: new Date(),
    ...overrides,
  }
}

function buildContact(overrides: Partial<ContactRow> = {}): ContactRow {
  return {
    id: 2,
    customerId: 1,
    name: '王经理',
    gender: 0,
    mobile: '13800000000',
    phone: null,
    email: 'wang@example.com',
    department: null,
    position: null,
    isPrimary: 1,
    birthday: null,
    remark: null,
    creatorId: salesperson.id,
    createdAt: new Date(),
    updaterId: salesperson.id,
    updatedAt: new Date(),
    ...overrides,
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('LeadConversionService.convert', () => {
  it('creates a customer and primary contact, then marks the qualified lead converted in one transaction', async () => {
    vi.spyOn(dbManager, 'transaction').mockImplementation(async (callback: any) => callback({} as any))
    vi.spyOn(LeadRepository, 'findById').mockResolvedValue(buildLead())
    // SELECT ... FOR UPDATE 返回 qualified 行；后续链路按计划执行
    const lockSpy = vi.spyOn(LeadRepository as any, 'lockQualifiedForConversionInTx').mockResolvedValue(buildLead())
    const customerCreate = vi.spyOn(CustomerRepository, 'create').mockResolvedValue(buildCustomer({ id: 100 }))
    const contactCreate = vi.spyOn(ContactRepository, 'create').mockResolvedValue(buildContact({ id: 200, customerId: 100 }))
    vi.spyOn(ContactRepository, 'setPrimaryInTx').mockResolvedValue(undefined)
    const leadUpdate = vi.spyOn(LeadRepository, 'update').mockResolvedValue({
      ...buildLead(),
      status: 'converted',
      convertedCustomerId: 100,
      convertedContactId: 200,
      convertedAt: new Date(),
    })
    vi.spyOn(LeadActivityRepository, 'create').mockResolvedValue({
      id: 999, leadId: 42, type: 'status_change', content: '', occurredAt: new Date(), nextFollowUpAt: null,
      operatorUserId: salesperson.id, createdAt: new Date(), updatedAt: new Date(),
    })

    const result = await new LeadConversionService().convert(42, {
      customer: { mode: 'create', name: '上海示例有限公司', type: 'enterprise', phone: '13800000000' },
      contact: { mode: 'create', name: '王经理', mobile: '13800000000' },
    }, salesperson)

    expect(lockSpy).toHaveBeenCalledWith(42, expect.anything())
    expect(customerCreate).toHaveBeenCalledWith(expect.objectContaining({
      name: '上海示例有限公司',
      type: 'enterprise',
      phone: '13800000000',
      sourceId: 11,
      ownerUserId: salesperson.id,
      poolStatus: 'owned',
      creatorId: salesperson.id,
    }), expect.anything())
    expect(contactCreate).toHaveBeenCalledWith(expect.objectContaining({
      customerId: 100,
      name: '王经理',
      mobile: '13800000000',
      isPrimary: 1,
    }), expect.anything())
    expect(leadUpdate).toHaveBeenCalledWith(42, expect.objectContaining({
      status: 'converted',
      convertedCustomerId: 100,
      convertedContactId: 200,
      convertedAt: expect.any(Date),
    }), expect.anything())
    expect(result.lead).toMatchObject({ status: 'converted', convertedCustomerId: 100, convertedContactId: 200 })
    expect(result.customer.id).toBe(100)
    expect(result.contact.id).toBe(200)
  })

  it('allows an existing contact only when it belongs to the chosen customer', async () => {
    vi.spyOn(dbManager, 'transaction').mockImplementation(async (callback: any) => callback({} as any))
    vi.spyOn(LeadRepository, 'findById').mockResolvedValue(buildLead())
    vi.spyOn(LeadRepository as any, 'lockQualifiedForConversionInTx').mockResolvedValue(buildLead())
    vi.spyOn(CustomerRepository, 'create').mockResolvedValue(buildCustomer({ id: 100 }))
    vi.spyOn(ContactRepository, 'create').mockResolvedValue(buildContact({ id: 200, customerId: 100 }))
    vi.spyOn(ContactRepository, 'setPrimaryInTx').mockResolvedValue(undefined)
    // 已存在的联系人 id=999，但属于 customer=999（与所选客户 100 不一致）
    vi.spyOn(ContactRepository, 'findById').mockResolvedValue(buildContact({ id: 999, customerId: 999 }))

    await expect(
      new LeadConversionService().convert(42, {
        customer: { mode: 'create', name: '上海示例有限公司', type: 'enterprise', phone: '13800000000' },
        contact: { mode: 'existing', contactId: 999 },
      }, salesperson),
    ).rejects.toMatchObject({ code: CrmErrorCode.CRM_LEAD_CONVERSION_SELECTION_INVALID })
  })

  it('rolls back customer/contact writes when lead conversion cannot complete', async () => {
    vi.spyOn(dbManager, 'transaction').mockImplementation(async (callback: any) => {
      try {
        return await callback({} as any)
      } catch (err) {
        throw err
      }
    })
    vi.spyOn(LeadRepository, 'findById').mockResolvedValue(buildLead())
    vi.spyOn(LeadRepository as any, 'lockQualifiedForConversionInTx').mockResolvedValue(buildLead())
    vi.spyOn(CustomerRepository, 'create').mockResolvedValue(buildCustomer({ id: 100 }))
    vi.spyOn(ContactRepository, 'create').mockResolvedValue(buildContact({ id: 200, customerId: 100 }))
    vi.spyOn(ContactRepository, 'setPrimaryInTx').mockResolvedValue(undefined)
    // 让最后的 leadUpdate 抛错，模拟事务回滚路径
    vi.spyOn(LeadRepository, 'update').mockImplementation(() => {
      throw new Error('boom')
    })
    vi.spyOn(LeadActivityRepository, 'create').mockResolvedValue({
      id: 1, leadId: 42, type: 'status_change', content: '', occurredAt: new Date(), nextFollowUpAt: null,
      operatorUserId: salesperson.id, createdAt: new Date(), updatedAt: new Date(),
    })

    await expect(
      new LeadConversionService().convert(42, {
        customer: { mode: 'create', name: '上海示例有限公司', type: 'enterprise', phone: '13800000000' },
        contact: { mode: 'create', name: '王经理', mobile: '13800000000' },
      }, salesperson),
    ).rejects.toThrow(/boom/)
  })

  it('returns a conflict when a second converter arrives after the first locks and converts', async () => {
    vi.spyOn(dbManager, 'transaction').mockImplementation(async (callback: any) => callback({} as any))
    vi.spyOn(LeadRepository, 'findById').mockResolvedValue(buildLead())
    // 锁内发现已不是 qualified → 返回 null
    vi.spyOn(LeadRepository as any, 'lockQualifiedForConversionInTx').mockResolvedValue(null)

    await expect(
      new LeadConversionService().convert(42, {
        customer: { mode: 'create', name: '上海示例有限公司', type: 'enterprise', phone: '13800000000' },
        contact: { mode: 'create', name: '王经理', mobile: '13800000000' },
      }, salesperson),
    ).rejects.toMatchObject({ code: CrmErrorCode.CRM_LEAD_CONVERSION_CONFLICT })
  })

  it('rejects conversion from a non-qualified lead', async () => {
    vi.spyOn(LeadRepository, 'findById').mockResolvedValue(buildLead({ status: 'processing' }))

    await expect(
      new LeadConversionService().convert(42, {
        customer: { mode: 'create', name: '上海示例有限公司', type: 'enterprise' },
        contact: { mode: 'create', name: '王经理' },
      }, salesperson),
    ).rejects.toMatchObject({ code: CrmErrorCode.CRM_LEAD_CONVERSION_NOT_QUALIFIED })
  })
})
