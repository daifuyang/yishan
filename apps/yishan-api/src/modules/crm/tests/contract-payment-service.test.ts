import { afterEach, describe, expect, it, vi } from 'vitest'
import { dbManager } from '@/db'
import { ContractService } from '../services/contract.service.js'
import { PaymentService } from '../services/payment.service.js'
import { ContractRepository } from '../repositories/contract.repository.js'
import { PaymentRepository } from '../repositories/payment.repository.js'
import { QuotationRepository } from '../repositories/quotation.repository.js'
import { CustomerRepository } from '../repositories/customer.repository.js'

const salesperson = { id: 7, roleCodes: ['sales'], deptIds: [10] }

afterEach(() => vi.restoreAllMocks())

describe('CRM contract and payment lifecycle', () => {
  it('creates a customer-owned contract from an accepted quotation', async () => {
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
    vi.spyOn(CustomerRepository, 'update').mockResolvedValue({ id: 11, statusCode: 'customer' } as any)

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
    vi.spyOn(dbManager, 'transaction').mockImplementation(async (callback: any) => callback({} as any))
    vi.spyOn(QuotationRepository, 'findByIdWithLock').mockResolvedValue({ id: 23, ownerUserId: 7, status: 'accepted' } as any)
    const existing = { id: 31, quotationId: 23, customerId: 11, ownerUserId: 7, ownerDepartmentId: 10, amountCents: 100_000 }
    vi.spyOn(ContractRepository as any, 'findByQuotationId').mockResolvedValue(existing)
    const create = vi.spyOn(ContractRepository, 'create')

    await expect(new ContractService().createFromQuotation(23, salesperson)).resolves.toBe(existing)
    expect(create).not.toHaveBeenCalled()
  })

  it('reports received and remaining cents from active payment entries', async () => {
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
})
