import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { dbManager } from '@/db'
import { CustomerLifecycleService } from '../services/customer-lifecycle.service.js'
import { CustomerService } from '../services/customer.service.js'
import { ActivityService } from '../services/activity.service.js'
import { ContractService } from '../services/contract.service.js'
import { CustomerRepository } from '../repositories/customer.repository.js'
import { ContractRepository } from '../repositories/contract.repository.js'
import { DirectCloseRepository } from '../repositories/direct-close.repository.js'
import { OpportunityRepository } from '../repositories/opportunity.repository.js'
import { ActivityRepository } from '../repositories/activity.repository.js'
import { CrmErrorCode } from '../schemas/error-codes.js'

const salesperson = { id: 7, roleCodes: ['sales'], deptIds: [10] }

function customer(overrides: Record<string, unknown> = {}) {
  return {
    id: 11,
    code: null,
    name: 'Acme',
    type: 'enterprise',
    statusCode: 'following',
    relationshipStatus: 'following',
    sourceId: null,
    sourceCode: null,
    level: null,
    levelCode: null,
    industry: null,
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
    creatorId: 7,
    createdAt: new Date(),
    updaterId: 7,
    updatedAt: new Date(),
    ...overrides,
  } as any
}

afterEach(() => vi.restoreAllMocks())

beforeEach(() => {
  vi.spyOn(DirectCloseRepository, 'hasActiveByCustomerId').mockResolvedValue(false)
})

describe('CustomerLifecycleService projected status', () => {
  it('projects a won opportunity to the customer won lifecycle', async () => {
    vi.spyOn(OpportunityRepository, 'listStagesByCustomerId').mockResolvedValue(['won'] as any)
    vi.spyOn(ContractRepository, 'hasQualifyingContractByCustomerId').mockResolvedValue(false)
    vi.spyOn(CustomerRepository, 'findById').mockResolvedValue(customer())
    const update = vi.spyOn(CustomerRepository, 'updateLifecycle').mockResolvedValue(customer())

    await expect(CustomerLifecycleService.recalculate(11, 7, {} as any)).resolves.toBe('won')
    expect(update).toHaveBeenCalledWith(11, expect.objectContaining({ statusCode: 'won' }), expect.anything())
  })

  it('does not project a draft contract as customer', async () => {
    vi.spyOn(OpportunityRepository, 'listStagesByCustomerId').mockResolvedValue([])
    vi.spyOn(ContractRepository, 'hasQualifyingContractByCustomerId').mockResolvedValue(false)
    vi.spyOn(CustomerRepository, 'findById').mockResolvedValue(customer())
    vi.spyOn(CustomerRepository, 'updateLifecycle').mockResolvedValue(customer())

    await expect(CustomerLifecycleService.recalculate(11, 7, {} as any)).resolves.toBe('following')
  })
})

describe('CustomerService relationship transitions', () => {
  it('blocks marking a customer lost while an active opportunity exists', async () => {
    vi.spyOn(CustomerRepository, 'findById').mockResolvedValue(customer())
    vi.spyOn(OpportunityRepository, 'listStagesByCustomerId').mockResolvedValue(['proposal'] as any)
    vi.spyOn(ContractRepository, 'hasQualifyingContractByCustomerId').mockResolvedValue(false)

    await expect(new CustomerService().transitionRelationshipStatus({
      id: 11,
      target: 'lost',
      reasonCode: 'no_need',
      currentUser: salesperson,
    })).rejects.toMatchObject({ code: CrmErrorCode.CRM_CUSTOMER_STATUS_TRANSITION_INVALID })
  })

  it('blocks marking a customer lost while an active no-contract close exists', async () => {
    vi.spyOn(CustomerRepository, 'findById').mockResolvedValue(customer())
    vi.spyOn(OpportunityRepository, 'listStagesByCustomerId').mockResolvedValue(['lost'] as any)
    vi.spyOn(ContractRepository, 'hasQualifyingContractByCustomerId').mockResolvedValue(false)
    vi.spyOn(DirectCloseRepository, 'hasActiveByCustomerId').mockResolvedValue(true)

    await expect(new CustomerService().transitionRelationshipStatus({
      id: 11,
      target: 'lost',
      reasonCode: 'no_need',
      currentUser: salesperson,
    })).rejects.toMatchObject({ code: CrmErrorCode.CRM_CUSTOMER_STATUS_TRANSITION_INVALID })
  })

  it('requires a remark when reactivating a lost customer', async () => {
    vi.spyOn(CustomerRepository, 'findById').mockResolvedValue(customer({ statusCode: 'lost', relationshipStatus: 'lost' }))

    await expect(new CustomerService().transitionRelationshipStatus({
      id: 11,
      target: 'following',
      currentUser: salesperson,
    })).rejects.toMatchObject({ code: CrmErrorCode.CRM_CUSTOMER_STATUS_TRANSITION_INVALID })
  })

  it('writes an auditable status change when a relationship transition succeeds', async () => {
    vi.spyOn(CustomerRepository, 'findById').mockResolvedValue(customer())
    vi.spyOn(dbManager, 'transaction').mockImplementation(async (fn: any) => fn({} as any))
    vi.spyOn(OpportunityRepository, 'listStagesByCustomerId').mockResolvedValue([])
    vi.spyOn(ContractRepository, 'hasQualifyingContractByCustomerId').mockResolvedValue(false)
    vi.spyOn(CustomerRepository, 'updateLifecycle').mockResolvedValue(customer({ relationshipStatus: 'potential', statusCode: 'potential' }))
    const activity = vi.spyOn(ActivityRepository, 'create').mockResolvedValue({} as any)

    await new CustomerService().transitionRelationshipStatus({
      id: 11,
      target: 'potential',
      remark: '重新评估',
      currentUser: salesperson,
    })

    expect(activity).toHaveBeenCalledWith(expect.objectContaining({
      customerId: 11,
      type: 'status_change',
      metadata: expect.objectContaining({ from: 'following', to: 'potential', source: 'relationship_transition' }),
    }), expect.anything())
  })
})

describe('CustomerLifecycleService follow-up projection', () => {
  it('promotes a potential customer to following after the first valid follow-up', async () => {
    vi.spyOn(CustomerRepository, 'findById').mockResolvedValue(customer({ statusCode: 'potential', relationshipStatus: 'potential' }))
    vi.spyOn(dbManager, 'transaction').mockImplementation(async (fn: any) => fn({} as any))
    vi.spyOn(ActivityRepository, 'create').mockResolvedValue({ id: 1 } as any)
    vi.spyOn(ActivityRepository, 'listByCustomerId').mockResolvedValue([])
    vi.spyOn(ActivityRepository, 'computeFollowUpState').mockResolvedValue({ lastFollowUpAt: new Date(), nextFollowUpAt: null })
    vi.spyOn(CustomerRepository, 'update').mockResolvedValue(customer())
    const lifecycleUpdate = vi.spyOn(CustomerRepository, 'updateLifecycle').mockResolvedValue(customer({ statusCode: 'following', relationshipStatus: 'following' }))
    vi.spyOn(OpportunityRepository, 'listStagesByCustomerId').mockResolvedValue([])
    vi.spyOn(ContractRepository, 'hasQualifyingContractByCustomerId').mockResolvedValue(false)

    await new ActivityService().create(11, { type: 'phone', content: '首次沟通' }, salesperson)

    expect(lifecycleUpdate).toHaveBeenCalledWith(11, expect.objectContaining({ relationshipStatus: 'following' }), expect.anything())
  })
})

describe('lost customer commercial guards', () => {
  it('rejects contract creation for a lost customer before writing a contract', async () => {
    vi.spyOn(CustomerService.prototype, 'detail').mockResolvedValue(customer({ statusCode: 'lost', relationshipStatus: 'lost' }))
    const create = vi.spyOn(ContractRepository, 'create')

    await expect(new ContractService().create({
      name: '续约合同', customerId: 11, opportunityId: null, quotationId: null, contactId: null,
      amountCents: 10_000, signedAt: null, effectiveAt: null, expiresAt: null,
      status: 'draft', ownerUserId: 7, ownerDepartmentId: 10, attachmentIds: null, description: null,
    }, salesperson)).rejects.toMatchObject({ code: CrmErrorCode.CRM_CUSTOMER_LOST })
    expect(create).not.toHaveBeenCalled()
  })
})
