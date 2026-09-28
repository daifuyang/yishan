import { BusinessError } from '@/exceptions/business-error.js'
import { dbManager, drizzleDb } from '@/db'
import type { DataScopeUser } from '../schemas/data-scope.js'
import { CrmErrorCode } from '../schemas/error-codes.js'
import { ContractService } from './contract.service.js'
import { ContractRepository } from '../repositories/contract.repository.js'
import { PaymentRepository, type PaymentListQuery, type PaymentRow, type UpdatePaymentInput } from '../repositories/payment.repository.js'
import { computeDataScope } from '../schemas/data-scope.js'

export class PaymentService {
  async list(query: PaymentListQuery, currentUser: DataScopeUser) {
    const result = await PaymentRepository.list({ ...query, paidFrom: query.paidFrom ? new Date(query.paidFrom) : undefined, paidTo: query.paidTo ? new Date(query.paidTo) : undefined }, computeDataScope(currentUser))
    return { items: result.rows, total: result.total, page: query.page ?? 1, pageSize: query.pageSize ?? 10 }
  }
  async listByContract(contractId: number, currentUser: DataScopeUser) { const contract = await new ContractService().detail(contractId, currentUser); const items = await PaymentRepository.listByContractId(contractId); const receivedCents = items.reduce((total, payment) => total + payment.amountCents, 0); return { items, receivedCents, remainingCents: Math.max(0, contract.amountCents - receivedCents) } }
  /**
   * 客户级回款汇总：聚合该客户所有非作废合同的合同金额 / 已回款 / 待回款。
   * 服务于 Drawer「回款 Tab」顶部轻量摘要。
   */
  async getCustomerPaymentSummary(customerId: number, currentUser: DataScopeUser): Promise<{ totalContractCents: number; paidCents: number; outstandingCents: number }> {
    // 走 customer 仓库的方法 + Payment 列表，避免再开新路由。
    const summary = { totalContractCents: 0, paidCents: 0, outstandingCents: 0 }
    const customer = await new ContractService().detail(customerId, currentUser)
    if (!customer) return summary
    // 直接通过 repository 查全客户的合同（service 里 detail 已校验权限，再做 list 即可）
    const { ContractRepository } = await import('../repositories/contract.repository.js')
    const contracts = await ContractRepository.list({ customerId, page: 1, pageSize: 1000 }, computeDataScope(currentUser))
    let total = 0
    let paid = 0
    for (const c of contracts.rows) {
      if (c.deletedAt) continue
      total += c.amountCents
      const payments = await PaymentRepository.listByContractId(c.id)
      const cPaid = payments.reduce((s, p) => s + p.amountCents, 0)
      paid += cPaid
    }
    summary.totalContractCents = total
    summary.paidCents = paid
    summary.outstandingCents = Math.max(0, total - paid)
    return summary
  }
  async create(
    contractId: number,
    input: {
      amountCents: number
      paidAt: string | Date
      methodCode?: string
      transactionNo?: string | null
      remark?: string | null
    },
    currentUser: DataScopeUser,
  ): Promise<PaymentRow> {
    await new ContractService().detail(contractId, currentUser)
    this.assertAmount(input.amountCents)
    return dbManager.transaction(async (tx) => {
      const contract = await ContractRepository.findByIdWithLock(contractId, tx)
      if (!contract) throw new BusinessError(CrmErrorCode.CRM_CONTRACT_NOT_FOUND, '合同不存在')
      const payments = await PaymentRepository.listByContractId(contractId, tx)
      this.assertWithinContract(
        contract.amountCents,
        payments.reduce((total, payment) => total + payment.amountCents, 0) + input.amountCents,
      )
      const baseNo = await PaymentRepository.nextPaymentNo(tx)
      try {
        return await PaymentRepository.create(
          {
            paymentNo: baseNo,
            contractId,
            customerId: contract.customerId,
            amountCents: input.amountCents,
            paidAt: new Date(input.paidAt),
            methodCode: input.methodCode ?? 'other',
            transactionNo: input.transactionNo ?? null,
            status: 'confirmed',
            remark: input.remark ?? null,
            creatorId: currentUser.id,
            updaterId: currentUser.id,
          },
          tx,
        )
      } catch (error: unknown) {
        // 同毫秒撞唯一键时重试一次。
        const code = (error as { code?: string })?.code
        if (code !== 'ER_DUP_ENTRY') throw error
        const retryNo = await PaymentRepository.nextPaymentNo(tx)
        return await PaymentRepository.create(
          {
            paymentNo: retryNo,
            contractId,
            customerId: contract.customerId,
            amountCents: input.amountCents,
            paidAt: new Date(input.paidAt),
            methodCode: input.methodCode ?? 'other',
            transactionNo: input.transactionNo ?? null,
            status: 'confirmed',
            remark: input.remark ?? null,
            creatorId: currentUser.id,
            updaterId: currentUser.id,
          },
          tx,
        )
      }
    })
  }
  async update(id: number, input: UpdatePaymentInput, currentUser: DataScopeUser): Promise<PaymentRow> {
    const payment = await PaymentRepository.findById(id)
    if (!payment) throw new BusinessError(CrmErrorCode.CRM_PAYMENT_NOT_FOUND, '回款不存在')
    await new ContractService().detail(payment.contractId, currentUser)
    if (input.amountCents !== undefined) this.assertAmount(input.amountCents)
    return dbManager.transaction(async (tx) => {
      const contract = await ContractRepository.findByIdWithLock(payment.contractId, tx)
      if (!contract) throw new BusinessError(CrmErrorCode.CRM_CONTRACT_NOT_FOUND, '合同不存在')
      const payments = await PaymentRepository.listByContractId(payment.contractId, tx)
      const total = payments.reduce(
        (sum, item) => sum + (item.id === id ? input.amountCents ?? item.amountCents : item.amountCents),
        0,
      )
      this.assertWithinContract(contract.amountCents, total)
      const updated = await PaymentRepository.update(id, { ...input, updaterId: currentUser.id }, tx)
      if (!updated) throw new BusinessError(CrmErrorCode.CRM_PAYMENT_NOT_FOUND, '回款不存在')
      return updated
    })
  }
  async remove(id: number, currentUser: DataScopeUser): Promise<void> {
    const payment = await PaymentRepository.findById(id)
    if (!payment) throw new BusinessError(CrmErrorCode.CRM_PAYMENT_NOT_FOUND, '回款不存在')
    await new ContractService().detail(payment.contractId, currentUser)
    if (await PaymentRepository.softDelete(id) === 0)
      throw new BusinessError(CrmErrorCode.CRM_PAYMENT_NOT_FOUND, '回款不存在')
  }
  private assertAmount(amountCents: number) {
    if (!Number.isSafeInteger(amountCents) || amountCents <= 0)
      throw new BusinessError(CrmErrorCode.CRM_PAYMENT_AMOUNT_INVALID, '回款金额必须是正整分')
  }
  private assertWithinContract(amountCents: number, receivedCents: number) {
    if (receivedCents > amountCents)
      throw new BusinessError(CrmErrorCode.CRM_PAYMENT_AMOUNT_INVALID, '回款金额不能超过合同金额')
  }
}

// Avoid unused import warning when no callers use drizzleDb.
void drizzleDb
