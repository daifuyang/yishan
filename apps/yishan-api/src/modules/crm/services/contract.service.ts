import { BusinessError } from '@/exceptions/business-error.js'
import { dbManager } from '@/db'
import { computeDataScope, type DataScopeUser } from '../schemas/data-scope.js'
import { CrmErrorCode } from '../schemas/error-codes.js'
import { isContractStatusCode } from '../domain/statuses.js'
import { CustomerService } from './customer.service.js'
import { CustomerLifecycleService } from './customer-lifecycle.service.js'
import { QuotationRepository } from '../repositories/quotation.repository.js'
import { ContractRepository, type ContractListQuery, type ContractRow, type CreateContractInput, type UpdateContractInput } from '../repositories/contract.repository.js'

export class ContractService {
  async list(query: ContractListQuery, currentUser: DataScopeUser) {
    const result = await ContractRepository.list(query, computeDataScope(currentUser))
    return { items: result.rows, total: result.total, page: query.page ?? 1, pageSize: query.pageSize ?? 10 }
  }
  async detail(id: number, currentUser: DataScopeUser): Promise<ContractRow> { return this.getAccessible(id, currentUser) }
  async create(input: Omit<CreateContractInput, 'contractNo' | 'creatorId' | 'updaterId'>, currentUser: DataScopeUser): Promise<ContractRow> {
    if (!Number.isSafeInteger(input.amountCents) || input.amountCents < 0) throw new BusinessError(CrmErrorCode.CRM_PAYMENT_AMOUNT_INVALID, '合同金额必须是非负整分')
    if (!isContractStatusCode(input.status)) throw new BusinessError(CrmErrorCode.CRM_CONTRACT_STATUS_INVALID, '合同状态无效')
    await new CustomerService().detail(input.customerId, currentUser)
    return dbManager.transaction(async (tx) => {
      const created = await this.createWithUniqueNo({ ...input, creatorId: currentUser.id, updaterId: currentUser.id }, tx)
      const contract = await ContractRepository.findById(created.id, tx)
      if (!contract) throw new BusinessError(CrmErrorCode.CRM_CONTRACT_NOT_FOUND, '合同不存在')
      await CustomerLifecycleService.recalculate(contract.customerId, currentUser.id, tx)
      return contract
    })
  }
  async createFromQuotation(quotationId: number, currentUser: DataScopeUser): Promise<ContractRow> {
    return dbManager.transaction(async (tx) => {
      const quotation = await QuotationRepository.findByIdWithLock(quotationId, tx)
      if (!quotation || quotation.status !== 'accepted') throw new BusinessError(CrmErrorCode.CRM_CONTRACT_QUOTATION_INVALID, '仅已接受报价可生成合同')
      await new CustomerService({ db: tx }).detail(quotation.customerId, currentUser)
      const existing = await ContractRepository.findByQuotationId(quotationId, tx)
      if (existing) return existing
      const created = await this.createWithUniqueNo({
        name: quotation.quotationNo, customerId: quotation.customerId,
        opportunityId: quotation.opportunityId, quotationId: quotation.id, amountCents: quotation.totalCents,
        signedAt: null, effectiveAt: null, expiresAt: null, status: 'draft', ownerUserId: quotation.ownerUserId,
        ownerDepartmentId: currentUser.deptIds?.[0] ?? null, attachmentIds: null, description: quotation.remark,
        creatorId: currentUser.id, updaterId: currentUser.id,
      }, tx)
      await CustomerLifecycleService.recalculate(quotation.customerId, currentUser.id, tx)
      const contract = await ContractRepository.findById(created.id, tx)
      if (!contract) throw new BusinessError(CrmErrorCode.CRM_CONTRACT_NOT_FOUND, '合同不存在')
      return contract
    })
  }
  async update(id: number, input: UpdateContractInput, currentUser: DataScopeUser): Promise<ContractRow> {
    const existing = await this.getAccessible(id, currentUser)
    if (input.status !== undefined && !isContractStatusCode(input.status)) throw new BusinessError(CrmErrorCode.CRM_CONTRACT_STATUS_INVALID, '合同状态无效')
    const updated = await dbManager.transaction(async (tx) => {
      const row = await ContractRepository.update(id, { ...input, updaterId: currentUser.id }, tx)
      if (!row) throw new BusinessError(CrmErrorCode.CRM_CONTRACT_NOT_FOUND, 'contract not found')
      await CustomerLifecycleService.recalculate(existing.customerId, currentUser.id, tx)
      return row
    })
    if (!updated) throw new BusinessError(CrmErrorCode.CRM_CONTRACT_NOT_FOUND, '合同不存在')
    return updated
  }
  async remove(id: number, currentUser: DataScopeUser): Promise<void> {
    const existing = await this.getAccessible(id, currentUser)
    await dbManager.transaction(async (tx) => {
      if (await ContractRepository.softDelete(id, tx) === 0) {
        throw new BusinessError(CrmErrorCode.CRM_CONTRACT_NOT_FOUND, '合同不存在')
      }
      await CustomerLifecycleService.recalculate(existing.customerId, currentUser.id, tx)
    })
  }
  private async getAccessible(id: number, currentUser: DataScopeUser): Promise<ContractRow> { const contract = await ContractRepository.findById(id); if (!contract) throw new BusinessError(CrmErrorCode.CRM_CONTRACT_NOT_FOUND, '合同不存在'); await new CustomerService().detail(contract.customerId, currentUser); return contract }
  private async createWithUniqueNo(input: Omit<CreateContractInput, 'contractNo'>, tx: any): Promise<{ id: number }> { const baseNo = await this.nextNo(tx); for (let attempt = 0; attempt < 3; attempt += 1) { try { return await ContractRepository.create({ ...input, contractNo: attempt === 0 ? baseNo : `${baseNo}-${attempt}` }, tx) } catch (error: any) { if (error?.code !== 'ER_DUP_ENTRY' || attempt === 2) throw error } } throw new Error('unreachable') }
  private async nextNo(tx: any): Promise<string> { const now = new Date(); const day = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`; const prefix = `CT-${day}-`; return `${prefix}${String((await ContractRepository.countTodayByNoPrefix(prefix, tx)) + 1).padStart(3, '0')}` }
}
