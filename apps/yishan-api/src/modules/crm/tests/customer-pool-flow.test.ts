import { afterEach, expect, it, vi } from 'vitest'
import { dbManager } from '@/db'
import { OpportunityService } from '../services/opportunity.service.js'
import { CustomerRepository } from '../repositories/customer.repository.js'
import { OpportunityRepository } from '../repositories/opportunity.repository.js'
import { TaskService } from '../services/task.service.js'
import { TaskRepository } from '../repositories/task.repository.js'
import { CustomerService } from '../services/customer.service.js'
import { computeDataScope } from '../schemas/data-scope.js'
import { CrmErrorCode } from '../schemas/error-codes.js'
import { CustomerLifecycleService } from '../services/customer-lifecycle.service.js'

const salesperson = { id: 7, roleCodes: ['sales'], deptIds: [10] }

afterEach(() => vi.restoreAllMocks())

it('moves the customer lifecycle to opportunity when an opportunity is created', async () => {
  vi.spyOn(CustomerService.prototype, 'detail').mockResolvedValue({ id: 11 } as any)
  vi.spyOn(dbManager, 'transaction').mockImplementation(async (callback: any) => callback({} as any))
  vi.spyOn(OpportunityRepository, 'create').mockResolvedValue({ id: 18 } as any)
  vi.spyOn(CustomerRepository, 'update').mockResolvedValue({ id: 11, statusCode: 'opportunity' } as any)

  const lifecycle = { recalculate: vi.fn().mockResolvedValue('opportunity') } as unknown as typeof CustomerLifecycleService
  await new OpportunityService(lifecycle).create({
    input: { name: 'Expansion', customerId: 11 },
    currentUser: salesperson,
  })

  expect(lifecycle.recalculate).toHaveBeenCalledWith(11, 7, expect.anything())

})

it('rejects opportunity creation before changing an inaccessible customer lifecycle', async () => {
  vi.spyOn(CustomerService.prototype, 'detail').mockRejectedValue({ code: CrmErrorCode.CRM_CUSTOMER_NOT_FOUND })
  const create = vi.spyOn(OpportunityRepository, 'create')

  await expect(new OpportunityService().create({ input: { name: 'Expansion', customerId: 99 }, currentUser: salesperson }))
    .rejects.toMatchObject({ code: CrmErrorCode.CRM_CUSTOMER_NOT_FOUND })
  expect(create).not.toHaveBeenCalled()
})

it('passes customer data scope into an unfiltered task list before repository pagination', async () => {
  vi.spyOn(TaskRepository, 'list').mockResolvedValue({ rows: [], total: 0 })

  await new TaskService().list({ page: 1, pageSize: 10 }, salesperson)

  expect(TaskRepository.list).toHaveBeenCalledWith(
    { page: 1, pageSize: 10 },
    computeDataScope(salesperson),
  )
})

it('keeps task CRUD inside the customer access boundary', async () => {
  vi.spyOn(CustomerService.prototype, 'detail').mockResolvedValue({ id: 11 } as any)
  vi.spyOn(TaskRepository, 'create').mockResolvedValue({ id: 1, customerId: 11, status: 'todo' } as any)
  vi.spyOn(TaskRepository, 'findById').mockResolvedValue({ id: 1, customerId: 11, status: 'todo' } as any)
  vi.spyOn(TaskRepository, 'update').mockResolvedValue({ id: 1, customerId: 11, status: 'completed' } as any)
  vi.spyOn(TaskRepository, 'softDelete').mockResolvedValue(1)
  const service = new TaskService()

  await service.create({ customerId: 11, title: 'Call back', status: 'todo', assigneeUserId: null, dueAt: null, description: null }, salesperson)
  await service.update(1, { status: 'completed', updaterId: salesperson.id }, salesperson)
  await service.remove(1, salesperson)

  expect(TaskRepository.create).toHaveBeenCalled()
  expect(TaskRepository.update).toHaveBeenCalledWith(1, expect.objectContaining({ status: 'completed' }))
  expect(TaskRepository.softDelete).toHaveBeenCalledWith(1)
})
