import type { AppQueryDb } from '@/db'
import { CustomerRepository } from '../repositories/customer.repository.js'
import { ContractRepository } from '../repositories/contract.repository.js'
import { OpportunityRepository } from '../repositories/opportunity.repository.js'
import type { CustomerStatusCode } from '../domain/statuses.js'

/** Derives the customer lifecycle from all live sales records, never one mutation. */
export class CustomerLifecycleService {
  static async recalculate(customerId: number, updaterId: number, db: AppQueryDb): Promise<CustomerStatusCode> {
    const [stages, hasContract] = await Promise.all([
      OpportunityRepository.listStagesByCustomerId(customerId, db),
      ContractRepository.existsByCustomerId(customerId, db),
    ])
    const statusCode: CustomerStatusCode = hasContract || stages.includes('won')
      ? 'customer'
      : stages.some((stage) => stage !== 'lost')
        ? 'opportunity'
        : stages.length > 0
          ? 'lost'
          : 'potential'
    await CustomerRepository.update(customerId, { statusCode, updaterId }, db)
    return statusCode
  }
}
