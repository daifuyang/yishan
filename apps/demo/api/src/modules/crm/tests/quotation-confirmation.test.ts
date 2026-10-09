import { afterEach, beforeEach, describe, expect, it, vi } from '../../../../test/runtime-fixture'
import { dbManager } from '@yishan/core-system-api/database'
import { QuotationService } from '../services/quotation.service.js'
import { ContractService } from '../services/contract.service.js'
import { CustomerService } from '../services/customer.service.js'
import { CustomerLifecycleService } from '../services/customer-lifecycle.service.js'
import { QuotationRepository, type QuotationRow } from '../repositories/quotation.repository.js'
import { ContractRepository, type ContractRow, type CreateContractInput } from '../repositories/contract.repository.js'
import { ActivityRepository } from '../repositories/activity.repository.js'

const user = { id: 7, roleCodes: ['super_admin'], deptIds: [10] }
const now = new Date('2026-10-07T12:00:00Z')
const quote: QuotationRow = {
  id: 2, quotationNo: 'Q-20261006-0001-R2', name: '项目报价', version: 2,
  seriesId: 'series-a', seriesNo: 'Q-20261006-0001', rootQuoteId: 1, sourceQuoteId: 1,
  customerId: 23, customerName: '测试客户', opportunityId: 1, opportunityName: '项目',
  contactId: 15, contactName: '联系人', ownerUserId: 8, ownerUserName: '销售', ownerDepartmentId: 10,
  status: 'sent', quoteDate: now, validUntil: now, netCents: 6600000, taxCents: 0,
  totalCents: 6400000, discountAmountCents: 200000, remark: '原始备注', creatorId: 8,
  createdAt: now, updaterId: 8, updatedAt: now, sentAt: now, acceptedAt: null, closedAt: null,
  hasShare: true, shareViewCount: 9, shareFirstViewedAt: now,
}
const contractInput: Omit<CreateContractInput, 'contractNo' | 'creatorId' | 'updaterId'> = {
  name: 'CRM 项目合同', customerId: 23, opportunityId: 1, quotationId: 2, contactId: 15,
  amountCents: 6400000, signedAt: now, effectiveAt: now, expiresAt: null, status: 'draft',
  ownerUserId: 7, ownerDepartmentId: 10, attachmentIds: null, description: '合同备注',
}
let current: QuotationRow
let contract: ContractRow | null
beforeEach(() => {
  current = { ...quote }; contract = null
  let queue = Promise.resolve()
  vi.spyOn(dbManager, 'transaction').mockImplementation(callback => {
    const next = queue.then(() => callback({} as Parameters<typeof callback>[0]))
    queue = next.then(() => undefined, () => undefined)
    return next
  })
  vi.spyOn(QuotationRepository, 'findByIdWithLock').mockImplementation(async () => ({ ...current }))
  vi.spyOn(QuotationRepository, 'latestBySeriesWithLock').mockImplementation(async () => ({ ...current }))
  vi.spyOn(QuotationRepository, 'update').mockImplementation(async (_id, patch) => { current = { ...current, ...patch }; return { ...current } })
  vi.spyOn(QuotationRepository, 'listItemsByQuotationId').mockResolvedValue([])
  vi.spyOn(QuotationRepository, 'createStatusLog').mockResolvedValue()
  vi.spyOn(QuotationRepository, 'findAcceptedIdsByOpportunity').mockResolvedValue([1])
  vi.spyOn(ActivityRepository, 'create').mockResolvedValue({ id: 1 } as Awaited<ReturnType<typeof ActivityRepository.create>>)
  vi.spyOn(ContractRepository, 'findByQuotationId').mockImplementation(async () => contract)
  vi.spyOn(ContractRepository, 'findById').mockImplementation(async () => contract)
  vi.spyOn(ContractRepository, 'countTodayByNoPrefix').mockResolvedValue(0)
  vi.spyOn(ContractRepository, 'create').mockImplementation(async input => {
    contract = { ...input, id: 31, createdAt: now, updatedAt: now, deletedAt: null }
    return { id: 31 }
  })
  vi.spyOn(CustomerService.prototype, 'detail').mockResolvedValue({ id: 23, relationshipStatus: 'following' } as Awaited<ReturnType<CustomerService['detail']>>)
  vi.spyOn(CustomerLifecycleService, 'recalculate').mockResolvedValue('following')
})
afterEach(() => vi.restoreAllMocks())

describe('销售确认报价', () => {
  it('confirms the current sent version and records its actor without superseding history', async () => {
    const result = await new QuotationService().acceptQuotation(2, user)
    expect(result.head).toMatchObject({ status: 'accepted', acceptedAt: expect.any(Date), acceptedBy: 7, totalCents: 6400000 })
    expect(QuotationRepository.update).toHaveBeenCalledTimes(1)
    expect(QuotationRepository.findAcceptedIdsByOpportunity).not.toHaveBeenCalled()
    expect(ActivityRepository.create).toHaveBeenCalledWith(expect.objectContaining({ type: 'quote_confirmed', metadata: expect.objectContaining({ quotationId: 2, version: 2, totalCents: 6400000 }), operatorUserId: 7 }), expect.anything())
  })
  it('serializes concurrent confirmation into one state change and one activity', async () => {
    const service = new QuotationService()
    const results = await Promise.all([service.acceptQuotation(2, user), service.acceptQuotation(2, user)])
    expect(results.map(r => r.head.status)).toEqual(['accepted', 'accepted'])
    expect(QuotationRepository.update).toHaveBeenCalledTimes(1)
    expect(QuotationRepository.createStatusLog).toHaveBeenCalledTimes(1)
    expect(ActivityRepository.create).toHaveBeenCalledTimes(1)
  })
  it.each(['draft', 'voided', 'rejected'] as const)('rejects confirmation of %s', async status => {
    current.status = status
    await expect(new QuotationService().acceptQuotation(2, user)).rejects.toThrow()
    expect(QuotationRepository.update).not.toHaveBeenCalled()
  })
  it('rejects confirmation of a historical version', async () => {
    vi.mocked(QuotationRepository.latestBySeriesWithLock).mockResolvedValue({ ...quote, id: 3, version: 3 })
    await expect(new QuotationService().acceptQuotation(2, user)).rejects.toThrow('历史版本')
    expect(QuotationRepository.update).not.toHaveBeenCalled()
  })
  it('enforces quotation data scope before confirming', async () => {
    await expect(new QuotationService().acceptQuotation(2, { id: 99, roleCodes: ['sales'], deptIds: [] })).rejects.toThrow('无权')
    expect(QuotationRepository.update).not.toHaveBeenCalled()
  })
  it('revokes a mistaken confirmation while retaining all view history and content', async () => {
    current.status = 'accepted'
    const result = await new QuotationService().revokeConfirmation(2, { reason: 'mistake', remark: '点错按钮' }, user)
    expect(result.head).toMatchObject({ status: 'sent', acceptedAt: null, acceptedBy: null, shareViewCount: 9, totalCents: 6400000, remark: '原始备注' })
    expect(ActivityRepository.create).toHaveBeenCalledWith(expect.objectContaining({ type: 'quote_confirmation_revoked', metadata: expect.objectContaining({ reason: '误操作', remark: '点错按钮' }) }), expect.anything())
  })
  it('refuses revocation after a contract has been created, including an archived contract', async () => {
    current.status = 'accepted'
    contract = { ...contractInput, id: 31, contractNo: 'CT-1', creatorId: 7, updaterId: 7, createdAt: now, updatedAt: now, deletedAt: now }
    await expect(new QuotationService().revokeConfirmation(2, { reason: 'mistake' }, user)).rejects.toThrow('合同')
    expect(QuotationRepository.update).not.toHaveBeenCalled()
  })
  it('refuses revocation of an unconfirmed version', async () => {
    await expect(new QuotationService().revokeConfirmation(2, { reason: 'mistake' }, user)).rejects.toThrow('已确认')
  })
})

describe('已确认报价生成合同', () => {
  it('rejects direct contract creation from an unconfirmed quote', async () => {
    await expect(new ContractService().create(contractInput, user)).rejects.toThrow('已确认')
    expect(ContractRepository.create).not.toHaveBeenCalled()
  })
  it('uses the submitted form and the source quote owner with one contract per version', async () => {
    current.status = 'accepted'
    const service = new ContractService()
    const results = await Promise.all([service.create(contractInput, user), service.create(contractInput, user)])
    expect(results.map(r => r.id)).toEqual([31, 31])
    expect(ContractRepository.create).toHaveBeenCalledTimes(1)
    expect(ContractRepository.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'CRM 项目合同', quotationId: 2, opportunityId: 1, contactId: 15, amountCents: 6400000, ownerUserId: 8, signedAt: now }), expect.anything())
    expect(ActivityRepository.create).toHaveBeenCalledWith(expect.objectContaining({ type: 'quote_contract_created', metadata: expect.objectContaining({ quotationId: 2, version: 2, contractId: 31 }) }), expect.anything())
  })
  it('rejects a forged customer relationship', async () => {
    current.status = 'accepted'
    await expect(new ContractService().create({ ...contractInput, customerId: 99 }, user)).rejects.toThrow('不一致')
    expect(ContractRepository.create).not.toHaveBeenCalled()
  })
  it('rejects a contract from a quote outside the salesperson scope', async () => {
    current.status = 'accepted'
    await expect(new ContractService().create(contractInput, { id: 99, roleCodes: ['sales'], deptIds: [] })).rejects.toThrow('无权')
    expect(ContractRepository.create).not.toHaveBeenCalled()
  })
  it('rejects a new contract from a historical confirmed version', async () => {
    current.status = 'accepted'
    vi.mocked(QuotationRepository.latestBySeriesWithLock).mockResolvedValue({ ...quote, id: 3, version: 3 })
    await expect(new ContractService().create(contractInput, user)).rejects.toThrow('历史版本')
    expect(ContractRepository.create).not.toHaveBeenCalled()
  })
  it('does not allow revocation to race past contract creation', async () => {
    current.status = 'accepted'
    const results = await Promise.allSettled([
      new ContractService().create(contractInput, user),
      new QuotationService().revokeConfirmation(2, { reason: 'mistake' }, user),
    ])
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1)
    expect(contract ? current.status : 'sent').toBe(current.status)
  })
})
