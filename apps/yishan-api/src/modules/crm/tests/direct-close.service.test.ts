import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { dbManager } from '@/db'
import { DirectCloseService } from '../services/direct-close.service.js'
import { OpportunityRepository } from '../repositories/opportunity.repository.js'
import { DirectCloseRepository } from '../repositories/direct-close.repository.js'
import { ActivityRepository } from '../repositories/activity.repository.js'
import { CustomerLifecycleService } from '../services/customer-lifecycle.service.js'
import { CustomerService } from '../services/customer.service.js'
import { CrmErrorCode } from '../schemas/error-codes.js'

const salesperson = { id: 7, roleCodes: ['sales'], deptIds: [10] }

function opportunity(stage: 'won' | 'proposal' = 'won') {
  return {
    id: 21,
    customerId: 11,
    ownerId: 7,
    ownerDepartmentId: 10,
    stage,
  } as any
}

function directClose(overrides: Record<string, unknown> = {}) {
  return {
    id: 31,
    customerId: 11,
    opportunityId: 21,
    amountCents: 50_000,
    closedAt: new Date('2026-09-14T10:00:00Z'),
    evidenceType: 'payment_proof',
    attachmentIds: [101],
    remark: null,
    revokedAt: null,
    revokedReason: null,
    creatorId: 7,
    updaterId: 7,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as any
}

beforeEach(() => {
  vi.spyOn(dbManager, 'transaction').mockImplementation(async (callback: any) => callback({} as any))
  vi.spyOn(ActivityRepository, 'create').mockResolvedValue({} as any)
  vi.spyOn(CustomerLifecycleService, 'recalculate').mockResolvedValue('won')
  vi.spyOn(CustomerService.prototype, 'detail').mockResolvedValue({ id: 11, relationshipStatus: 'following' } as any)
})

afterEach(() => vi.restoreAllMocks())

describe('DirectCloseService', () => {
  it('rejects confirmation from an opportunity that is not won', async () => {
    vi.spyOn(OpportunityRepository, 'findByIdForUpdate').mockResolvedValue(opportunity('proposal'))

    await expect(new DirectCloseService().confirm(21, {
      amountCents: 50_000,
      closedAt: new Date('2026-09-14T10:00:00Z'),
      evidenceType: 'payment_proof',
      attachmentIds: [101],
    }, salesperson)).rejects.toMatchObject({ code: CrmErrorCode.CRM_DIRECT_CLOSE_OPPORTUNITY_NOT_WON })
  })

  it('requires evidence attachment or remark when confirming a won opportunity', async () => {
    vi.spyOn(OpportunityRepository, 'findByIdForUpdate').mockResolvedValue(opportunity('won'))

    await expect(new DirectCloseService().confirm(21, {
      amountCents: 50_000,
      closedAt: new Date('2026-09-14T10:00:00Z'),
      evidenceType: 'verbal_confirmation',
      attachmentIds: [],
      remark: '   ',
    }, salesperson)).rejects.toMatchObject({ code: CrmErrorCode.CRM_DIRECT_CLOSE_EVIDENCE_REQUIRED })
  })

  it('projects a confirmed close as customer and restores opportunity when revoked', async () => {
    vi.spyOn(OpportunityRepository, 'findByIdForUpdate').mockResolvedValue(opportunity('won'))
    vi.spyOn(DirectCloseRepository, 'findActiveByOpportunityId').mockResolvedValue(null)
    vi.spyOn(DirectCloseRepository, 'create').mockResolvedValue({ id: 31 } as any)
    vi.spyOn(DirectCloseRepository, 'findByIdForUpdate').mockResolvedValue(directClose())
    vi.spyOn(DirectCloseRepository, 'findById').mockResolvedValueOnce(directClose()).mockResolvedValueOnce(directClose())
    vi.spyOn(DirectCloseRepository, 'revoke').mockResolvedValue(directClose({ revokedAt: new Date(), revokedReason: '录入错误' }))
    const lifecycle = vi.spyOn(CustomerLifecycleService, 'recalculate').mockResolvedValueOnce('won').mockResolvedValueOnce('opportunity')

    const confirmed = await new DirectCloseService().confirm(21, {
      amountCents: 50_000,
      closedAt: new Date('2026-09-14T10:00:00Z'),
      evidenceType: 'payment_proof',
      attachmentIds: [101],
    }, salesperson)
    const revoked = await new DirectCloseService().revoke(31, { reason: '录入错误' }, salesperson)

    expect(confirmed.statusCode).toBe('won')
    expect(revoked.statusCode).toBe('opportunity')
    expect(lifecycle).toHaveBeenNthCalledWith(1, 11, 7, expect.anything())
    expect(lifecycle).toHaveBeenNthCalledWith(2, 11, 7, expect.anything())
    expect(ActivityRepository.create).toHaveBeenCalledWith(expect.objectContaining({
      customerId: 11,
      type: 'status_change',
      metadata: expect.objectContaining({ source: 'direct_close_confirmed', directCloseId: 31 }),
    }), expect.anything())
    expect(ActivityRepository.create).toHaveBeenCalledWith(expect.objectContaining({
      metadata: expect.objectContaining({ source: 'direct_close_revoked', directCloseId: 31, reason: '录入错误' }),
    }), expect.anything())
  })
})
