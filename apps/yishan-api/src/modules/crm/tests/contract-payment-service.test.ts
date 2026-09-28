import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OpportunityRepository } from '../repositories/opportunity.repository.js'
import { dbManager } from '@/db'
import { ContractService } from '../services/contract.service.js'
import { PaymentService } from '../services/payment.service.js'
import { ContractRepository } from '../repositories/contract.repository.js'
import { DirectCloseRepository } from '../repositories/direct-close.repository.js'
import { PaymentRepository } from '../repositories/payment.repository.js'
import { QuotationRepository } from '../repositories/quotation.repository.js'
import { CustomerRepository } from '../repositories/customer.repository.js'
import { CustomerService } from '../services/customer.service.js'
import { CustomerLifecycleService } from '../services/customer-lifecycle.service.js'
import { CrmErrorCode } from '../schemas/error-codes.js'
import { getTableConfig } from 'drizzle-orm/mysql-core'
import { crmContract } from '../db/schema.js'

const salesperson = { id: 7, roleCodes: ['sales'], deptIds: [10] }

afterEach(() => vi.restoreAllMocks())
beforeEach(() => {
  vi.spyOn(OpportunityRepository, 'listStagesByCustomerId').mockResolvedValue([])
  vi.spyOn(ContractRepository, 'hasQualifyingContractByCustomerId').mockResolvedValue(false)
  vi.spyOn(DirectCloseRepository, 'hasActiveByCustomerId').mockResolvedValue(false)
  vi.spyOn(CustomerRepository, 'findById').mockResolvedValue({ id: 11, relationshipStatus: 'following' } as any)
  vi.spyOn(CustomerRepository, 'updateLifecycle').mockResolvedValue({ id: 11, statusCode: 'following', relationshipStatus: 'following' } as any)
})

describe('CRM contract and payment lifecycle', () => {
  it('recalculates customer lifecycle after updating a contract', async () => {
    const contract = { id: 31, customerId: 11, ownerUserId: 7, ownerDepartmentId: 10, amountCents: 100_000, status: 'draft' }
    vi.spyOn(CustomerService.prototype, 'detail').mockResolvedValue({ id: 11 } as any)
    vi.spyOn(ContractRepository, 'findById').mockResolvedValue(contract as any)
    vi.spyOn(ContractRepository, 'update').mockResolvedValue({ ...contract, status: 'completed' } as any)
    const recalculate = vi.spyOn(CustomerLifecycleService, 'recalculate').mockResolvedValue('won')
    vi.spyOn(dbManager, 'transaction').mockImplementation(async (callback: any) => callback({} as any))

    await new ContractService().update(31, { status: 'completed', updaterId: 7 } as any, salesperson)

    expect(recalculate).toHaveBeenCalledWith(11, 7, expect.anything())
  })

  it('recalculates customer lifecycle after removing a contract', async () => {
    const contract = { id: 31, customerId: 11, ownerUserId: 7, ownerDepartmentId: 10, amountCents: 100_000, status: 'draft' }
    vi.spyOn(CustomerService.prototype, 'detail').mockResolvedValue({ id: 11 } as any)
    vi.spyOn(ContractRepository, 'findById').mockResolvedValue(contract as any)
    vi.spyOn(ContractRepository, 'softDelete').mockResolvedValue(1)
    const recalculate = vi.spyOn(CustomerLifecycleService, 'recalculate').mockResolvedValue('potential')
    vi.spyOn(dbManager, 'transaction').mockImplementation(async (callback: any) => callback({} as any))

    await new ContractService().remove(31, salesperson)

    expect(recalculate).toHaveBeenCalledWith(11, 7, expect.anything())
  })

  it('keeps quotation linkage unique at the schema boundary, including soft-deleted contracts', () => {
    const config = getTableConfig(crmContract)
    expect(config.indexes.some((index) => index.config.name === 'uniq_crm_contract_quotation_id')).toBe(true)
  })

  it('propagates a contract row-lock failure instead of reading unlocked data', async () => {
    const lockError = Object.assign(new Error('deadlock'), { code: 'ER_LOCK_DEADLOCK' })
    const db = { execute: vi.fn().mockRejectedValue(lockError) }

    await expect(ContractRepository.findByIdWithLock(31, db as any)).rejects.toBe(lockError)
  })

  it('rejects a contract detail when its owning customer is outside the caller scope', async () => {
    vi.spyOn(ContractRepository, 'findById').mockResolvedValue({ id: 31, customerId: 99, ownerUserId: 7, ownerDepartmentId: 10 } as any)
    vi.spyOn(CustomerService.prototype, 'detail').mockRejectedValue({ code: CrmErrorCode.CRM_CUSTOMER_NOT_FOUND })

    await expect(new ContractService().detail(31, salesperson)).rejects.toMatchObject({ code: CrmErrorCode.CRM_CUSTOMER_NOT_FOUND })
  })

  it('creates a customer-owned contract from an accepted quotation', async () => {
    vi.spyOn(CustomerService.prototype, 'detail').mockResolvedValue({ id: 11 } as any)
    vi.spyOn(dbManager, 'transaction').mockImplementation(async (callback: any) => callback({} as any))
    vi.spyOn(QuotationRepository, 'findByIdWithLock').mockResolvedValue({
      id: 23,
      quotationNo: 'QT-20260914-001',
      customerId: 11,
      opportunityId: 12,
      ownerUserId: 7,
      ownerDepartmentId: 10,
      status: 'accepted',
      totalCents: 100_000,
    } as any)
    const create = vi.spyOn(ContractRepository, 'create').mockResolvedValue({ id: 31 } as any)
    vi.spyOn(ContractRepository, 'findById').mockResolvedValue({
      id: 31,
      contractNo: 'CT-20260914-001',
      name: 'QT-20260914-001',
      customerId: 11,
      amountCents: 100_000,
      status: 'draft',
    } as any)
    vi.spyOn(ContractRepository, 'countTodayByNoPrefix').mockResolvedValue(0)
    vi.spyOn(ContractRepository, 'findByQuotationId').mockResolvedValue(null)
    vi.mocked(CustomerRepository.updateLifecycle).mockResolvedValue({ id: 11, statusCode: 'following' } as any)

    const contract = await new ContractService().createFromQuotation(23, salesperson)

    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      customerId: 11,
      opportunityId: 12,
      quotationId: 23,
      amountCents: 100_000,
      ownerUserId: 7,
    }), expect.anything())
    expect(contract.customerId).toBe(11)
    expect(contract.amountCents).toBe(100_000)
  })

  it('returns the existing contract when the quotation was already converted', async () => {
    vi.spyOn(CustomerService.prototype, 'detail').mockResolvedValue({ id: 11 } as any)
    vi.spyOn(dbManager, 'transaction').mockImplementation(async (callback: any) => callback({} as any))
    vi.spyOn(QuotationRepository, 'findByIdWithLock').mockResolvedValue({ id: 23, ownerUserId: 7, status: 'accepted' } as any)
    const existing = { id: 31, quotationId: 23, customerId: 11, ownerUserId: 7, ownerDepartmentId: 10, amountCents: 100_000 }
    vi.spyOn(ContractRepository as any, 'findByQuotationId').mockResolvedValue(existing)
    const create = vi.spyOn(ContractRepository, 'create')

    await expect(new ContractService().createFromQuotation(23, salesperson)).resolves.toBe(existing)
    expect(create).not.toHaveBeenCalled()
  })

  it('reports received and remaining cents from active payment entries', async () => {
    vi.spyOn(CustomerService.prototype, 'detail').mockResolvedValue({ id: 11 } as any)
    vi.spyOn(ContractRepository, 'findById').mockResolvedValue({
      id: 31,
      customerId: 11,
      ownerUserId: 7,
      ownerDepartmentId: 10,
      amountCents: 100_000,
    } as any)
    vi.spyOn(PaymentRepository, 'listByContractId').mockResolvedValue([
      { id: 1, contractId: 31, customerId: 11, amountCents: 20_000 },
      { id: 2, contractId: 31, customerId: 11, amountCents: 30_000 },
    ] as any)

    const summary = await new PaymentService().listByContract(31, salesperson)

    expect(summary.receivedCents).toBe(50_000)
    expect(summary.remainingCents).toBe(50_000)
  })

  it('lists payments with pagination through the scoped repository query', async () => {
    const list = vi.spyOn(PaymentRepository, 'list').mockResolvedValue({
      rows: [{ id: 2, contractId: 31, customerId: 11, amountCents: 20_000, contractNo: 'CT-001', contractName: 'CRM', customerName: 'Acme' } as any],
      total: 3,
    })

    const result = await new PaymentService().list({ page: 2, pageSize: 1, keyword: 'Acme', paidFrom: new Date('2026-01-01T00:00:00.000Z') }, salesperson)

    expect(result).toMatchObject({ items: expect.any(Array), total: 3, page: 2, pageSize: 1 })
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ page: 2, pageSize: 1, keyword: 'Acme' }), expect.objectContaining({ ownerUserIds: [7] }))
  })

  it('rejects a payment that would exceed the contract amount', async () => {
    vi.spyOn(ContractService.prototype, 'detail').mockResolvedValue({ id: 31, customerId: 11, amountCents: 100_000 } as any)
    vi.spyOn(dbManager, 'transaction').mockImplementation(async (callback: any) => callback({} as any))
    vi.spyOn(ContractRepository, 'findByIdWithLock').mockResolvedValue({ id: 31, customerId: 11, amountCents: 100_000 } as any)
    vi.spyOn(PaymentRepository, 'listByContractId').mockResolvedValue([{ id: 1, contractId: 31, amountCents: 80_000 }] as any)

    await expect(new PaymentService().create(31, {
      amountCents: 30_000, paidAt: new Date(), methodCode: 'bank_transfer',
    }, salesperson)).rejects.toMatchObject({ code: CrmErrorCode.CRM_PAYMENT_AMOUNT_INVALID })
  })

  it('locks the contract before reading payments and writing a payment', async () => {
    const calls: string[] = []
    vi.spyOn(ContractService.prototype, 'detail').mockResolvedValue({ id: 31, customerId: 11, amountCents: 100_000 } as any)
    vi.spyOn(dbManager, 'transaction').mockImplementation(async (callback: any) => callback({} as any))
    vi.spyOn(ContractRepository as any, 'findByIdWithLock').mockImplementation(async () => { calls.push('lock'); return { id: 31, customerId: 11, amountCents: 100_000 } })
    vi.spyOn(PaymentRepository, 'listByContractId').mockImplementation(async () => { calls.push('payments'); return [{ id: 1, contractId: 31, amountCents: 50_000 }] as any })
    vi.spyOn(PaymentRepository, 'create').mockImplementation(async () => { calls.push('create'); return { id: 2, contractId: 31, amountCents: 20_000 } as any })

    await new PaymentService().create(31, { amountCents: 20_000, paidAt: new Date(), methodCode: 'bank_transfer' }, salesperson)

    expect(calls).toEqual(['lock', 'payments', 'create'])
  })

  it('retries a duplicate generated contract number inside the transaction', async () => {
    vi.spyOn(CustomerService.prototype, 'detail').mockResolvedValue({ id: 11 } as any)
    vi.spyOn(dbManager, 'transaction').mockImplementation(async (callback: any) => callback({} as any))
    const count = vi.spyOn(ContractRepository, 'countTodayByNoPrefix').mockResolvedValue(0)
    vi.spyOn(ContractRepository, 'create').mockRejectedValueOnce({ code: 'ER_DUP_ENTRY' }).mockResolvedValueOnce({ id: 32 } as any)
    vi.spyOn(ContractRepository, 'findById').mockResolvedValue({ id: 32, customerId: 11 } as any)
    vi.spyOn(CustomerRepository, 'update').mockResolvedValue({ id: 11, statusCode: 'customer' } as any)

    await expect(new ContractService().create({
      name: 'Renewal', customerId: 11, opportunityId: null, quotationId: null, contactId: null, amountCents: 1_000,
      signedAt: null, effectiveAt: null, expiresAt: null, status: 'draft', ownerUserId: 7,
      ownerDepartmentId: 10, attachmentIds: null, description: null,
    }, salesperson)).resolves.toMatchObject({ id: 32 })
    expect(ContractRepository.create).toHaveBeenCalledTimes(2)
    expect(count).toHaveBeenCalledTimes(1)
    const candidates = vi.mocked(ContractRepository.create).mock.calls.map(([input]) => input.contractNo)
    expect(candidates[0]).not.toBe(candidates[1])
  })
})
