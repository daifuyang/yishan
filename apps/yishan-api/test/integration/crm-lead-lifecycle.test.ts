/**
 * 线索生命周期真实 MySQL 集成测试。
 *
 * 仅在 YISHAN_RUN_INTEGRATION=1 + YISHAN_TEST_MYSQL_URL 启用时执行；
 * 通过 LeadService / LeadConversionService 走完整事务链路，验证：
 *   - new → processing → qualified → converted 一次跑通；
 *   - owner / pool 变化不改变 status（qualified 的 lead 被退回公海后仍是 qualified）；
 *   - 仅 qualified 可 convert；其他任何状态 + 不一致的现有联系人全部拒绝。
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { setupIntegration, type IntegrationContext } from './_setup.js'

const ctx: IntegrationContext = await setupIntegration()

interface LoadedServices {
  leadService: any
  leadConversionService: any
  leadRepository: any
  customerRepository: any
  contactRepository: any
  leadActivityService: any
}

const services: LoadedServices = ctx.skip
  ? ({} as LoadedServices)
  : await (async () => {
      const [leadMod, leadConversionMod, leadRepoMod, customerRepoMod, contactRepoMod, leadActivityMod] =
        await Promise.all([
          import('../../src/modules/crm/services/lead.service.js'),
          import('../../src/modules/crm/services/lead-conversion.service.js'),
          import('../../src/modules/crm/repositories/lead.repository.js'),
          import('../../src/modules/crm/repositories/customer.repository.js'),
          import('../../src/modules/crm/repositories/contact.repository.js'),
          import('../../src/modules/crm/services/lead-activity.service.js'),
        ])
      return {
        leadService: new leadMod.LeadService(),
        leadConversionService: new leadConversionMod.LeadConversionService(),
        leadRepository: leadRepoMod.LeadRepository,
        customerRepository: customerRepoMod.CustomerRepository,
        contactRepository: contactRepoMod.ContactRepository,
        leadActivityService: new leadActivityMod.LeadActivityService(),
      }
    })()

describe.runIf(!ctx.skip)('integration: crm lead lifecycle', () => {
  beforeAll(async () => {
    await ctx.resetSchema?.()
  })

  afterAll(async () => {
    await ctx.closeDb?.()
  })

  it('runs new → processing → qualified → converted and links the resulting customer and contact', async () => {
    const salesperson = { id: 7, roleCodes: ['sales'], deptIds: [10] }
    const unique = Date.now()

    // 1) create
    const lead = await services.leadService.create({
      input: {
        name: `集成测试联系人${unique}`,
        companyName: `集成测试公司${unique}`,
        mobile: `138${String(unique).slice(-8)}`,
        email: `it${unique}@example.com`,
        intention: 'integration scenario',
      },
      currentUser: salesperson,
    })
    expect(lead.status).toBe('new')

    // 2) follow up → status advances to processing
    const created = await services.leadActivityService.create(
      lead.id,
      { type: 'phone', content: '首次电话跟进，预算已确认', occurredAt: new Date() },
      salesperson,
    )
    expect(created.lead.status).toBe('processing')

    // 3) qualify
    const qualified = await services.leadService.qualify({
      leadId: lead.id,
      evidence: '客户已确认预算 30 万',
      nextAction: '下周安排现场演示',
      currentUser: salesperson,
    })
    expect(qualified.status).toBe('qualified')

    // 4) preview + convert
    const preview = await services.leadConversionService.preview(lead.id, salesperson)
    expect(preview.lead.id).toBe(lead.id)
    expect(preview.lead.status).toBe('qualified')

    const converted = await services.leadConversionService.convert(
      lead.id,
      {
        customer: {
          mode: 'create',
          name: qualified.companyName ?? `集成测试公司${unique}`,
          type: 'enterprise',
          phone: qualified.mobile,
        },
        contact: {
          mode: 'create',
          name: qualified.name ?? `集成测试联系人${unique}`,
          mobile: qualified.mobile,
          email: qualified.email,
        },
      },
      salesperson,
    )
    expect(converted.lead.status).toBe('converted')
    expect(converted.lead.convertedCustomerId).toBe(converted.customer.id)
    expect(converted.lead.convertedContactId).toBe(converted.contact.id)
    expect(converted.contact.customerId).toBe(converted.customer.id)
    expect(converted.contact.isPrimary).toBe(1)

    // 5) GET 后能看到状态保持 converted
    const reloaded = await services.leadRepository.findById(lead.id)
    expect(reloaded?.status).toBe('converted')
  })

  it('keeps owner/pool movement independent from a qualified lead status', async () => {
    const salesperson = { id: 7, roleCodes: ['sales'], deptIds: [10] }
    const other = { id: 9, roleCodes: ['sales'], deptIds: [10] }
    const unique = Date.now() + 1

    const lead = await services.leadService.create({
      input: {
        name: `集成测试${unique}`,
        companyName: `集成测试公司${unique}`,
        mobile: `139${String(unique).slice(-8)}`,
        email: `it2${unique}@example.com`,
      },
      currentUser: salesperson,
    })
    await services.leadService.qualify({
      leadId: lead.id,
      evidence: 'demo',
      nextAction: 'demo',
      currentUser: salesperson,
    })

    // 退回公海 → owner 变 null，poolStatus=public，status 仍为 qualified
    const returned = await services.leadService.assign({
      leadId: lead.id,
      targetUserId: null,
      currentUser: salesperson,
    })
    expect(returned.status).toBe('qualified')
    expect(returned.poolStatus).toBe('public')

    // 另一名销售领取 → ownerUserId 更新，status 仍 qualified
    const claimed = await services.leadService.claim({ leadId: lead.id, currentUser: other })
    expect(claimed.status).toBe('qualified')
    expect(claimed.ownerUserId).toBe(other.id)
  })

  it('rejects conversion from every status except qualified and preserves a qualified lead after a failed selection', async () => {
    const salesperson = { id: 7, roleCodes: ['sales'], deptIds: [10] }
    const unique = Date.now() + 2

    // new 状态：直接转换必须被拒绝
    const newLead = await services.leadService.create({
      input: {
        name: `new ${unique}`,
        mobile: `137${String(unique).slice(-8)}`,
      },
      currentUser: salesperson,
    })
    await expect(
      services.leadConversionService.convert(
        newLead.id,
        {
          customer: { mode: 'create', name: 'C', type: 'enterprise' },
          contact: { mode: 'create', name: 'P' },
        },
        salesperson,
      ),
    ).rejects.toMatchObject({ code: 33410 })

    // processing 状态：拒绝
    await services.leadActivityService.create(
      newLead.id,
      { type: 'phone', content: 'first follow-up' },
      salesperson,
    )
    await expect(
      services.leadConversionService.convert(
        newLead.id,
        {
          customer: { mode: 'create', name: 'C2', type: 'enterprise' },
          contact: { mode: 'create', name: 'P2' },
        },
        salesperson,
      ),
    ).rejects.toMatchObject({ code: 33410 })

    // disqualified 状态：拒绝
    await services.leadService.disqualify({
      leadId: newLead.id,
      code: 'no_demand',
      reason: 'integration test disqualify',
      currentUser: salesperson,
    })
    await expect(
      services.leadConversionService.convert(
        newLead.id,
        {
          customer: { mode: 'create', name: 'C3', type: 'enterprise' },
          contact: { mode: 'create', name: 'P3' },
        },
        salesperson,
      ),
    ).rejects.toMatchObject({ code: 33410 })
  })

  it('qualifies + mismatched existing contact selection rejects conversion', async () => {
    const salesperson = { id: 7, roleCodes: ['sales'], deptIds: [10] }
    const unique = Date.now() + 3
    const lead = await services.leadService.create({
      input: {
        name: `qualified ${unique}`,
        companyName: `qualified Co ${unique}`,
        mobile: `136${String(unique).slice(-8)}`,
      },
      currentUser: salesperson,
    })
    await services.leadService.qualify({
      leadId: lead.id,
      evidence: 'evidence',
      nextAction: 'next',
      currentUser: salesperson,
    })

    // 直接构造一个客户 + 一个属于别人的联系人
    const customer = await services.customerRepository.create({
      name: `existing customer ${unique}`,
      type: 'enterprise',
      phone: `135${String(unique).slice(-8)}`,
      ownerUserId: salesperson.id,
      ownerDepartmentId: salesperson.deptIds?.[0] ?? null,
      poolStatus: 'owned',
      creatorId: salesperson.id,
      updaterId: salesperson.id,
    })
    const otherCustomer = await services.customerRepository.create({
      name: `other customer ${unique}`,
      type: 'enterprise',
      phone: `134${String(unique).slice(-8)}`,
      ownerUserId: salesperson.id,
      ownerDepartmentId: salesperson.deptIds?.[0] ?? null,
      poolStatus: 'owned',
      creatorId: salesperson.id,
      updaterId: salesperson.id,
    })
    const contact = await services.contactRepository.create({
      customerId: otherCustomer.id,
      name: 'Other Contact',
      mobile: `133${String(unique).slice(-8)}`,
      creatorId: salesperson.id,
      updaterId: salesperson.id,
    })

    await expect(
      services.leadConversionService.convert(
        lead.id,
        {
          customer: { mode: 'existing', customerId: customer.id },
          contact: { mode: 'existing', contactId: contact.id },
        },
        salesperson,
      ),
    ).rejects.toMatchObject({ code: 33411 })

    // qualified 仍保持
    const reloaded = await services.leadRepository.findById(lead.id)
    expect(reloaded?.status).toBe('qualified')
  })
})
