import type { AppQueryDb } from '@/db'
import { CustomerRepository } from '../repositories/customer.repository.js'
import { OpportunityRepository } from '../repositories/opportunity.repository.js'
import type { CustomerStatusCode, RelationshipStatus } from '../domain/statuses.js'

/** Derives the customer lifecycle from all live sales records, never one mutation. */
export class CustomerLifecycleService {
  static async recalculate(customerId: number, updaterId: number, db: AppQueryDb): Promise<CustomerStatusCode> {
    const [customer, stages] = await Promise.all([
      CustomerRepository.findById(customerId, db),
      OpportunityRepository.listStagesByCustomerId(customerId, db),
    ])
    if (!customer) throw new Error(`CRM customer ${customerId} was not found during lifecycle recalculation`)
    const relationshipStatus = customer.relationshipStatus as RelationshipStatus
    const hasWonOpportunity = stages.includes('won')
    const statusCode: CustomerStatusCode = relationshipStatus === 'lost'
      ? 'lost'
      : hasWonOpportunity
        ? 'won'
        : relationshipStatus
    await CustomerRepository.updateLifecycle(customerId, { statusCode, updaterId }, db)
    return statusCode
  }
}
