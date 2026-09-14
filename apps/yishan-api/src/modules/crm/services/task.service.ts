import { BusinessError } from '@/exceptions/business-error.js'
import type { DataScopeUser } from '../schemas/data-scope.js'
import { CrmErrorCode } from '../schemas/error-codes.js'
import { isTaskStatusCode } from '../domain/statuses.js'
import { CustomerService } from './customer.service.js'
import { TaskRepository, type CreateTaskInput, type TaskListQuery, type TaskRow, type UpdateTaskInput } from '../repositories/task.repository.js'

export class TaskService {
  async list(query: TaskListQuery, currentUser: DataScopeUser) { if (query.customerId !== undefined) await new CustomerService().detail(query.customerId, currentUser); const result = await TaskRepository.list(query); return { items: result.rows, total: result.total, page: query.page ?? 1, pageSize: query.pageSize ?? 10 } }
  async detail(id: number, currentUser: DataScopeUser): Promise<TaskRow> { const task = await TaskRepository.findById(id); if (!task) throw new BusinessError(CrmErrorCode.CRM_TASK_NOT_FOUND, '任务不存在'); await new CustomerService().detail(task.customerId, currentUser); return task }
  async create(input: Omit<CreateTaskInput, 'creatorId' | 'updaterId' | 'completedAt'>, currentUser: DataScopeUser): Promise<TaskRow> { await new CustomerService().detail(input.customerId, currentUser); if (!isTaskStatusCode(input.status)) throw new BusinessError(CrmErrorCode.CRM_TASK_STATUS_INVALID, '任务状态无效'); return TaskRepository.create({ ...input, completedAt: input.status === 'completed' ? new Date() : null, creatorId: currentUser.id, updaterId: currentUser.id }) }
  async update(id: number, input: UpdateTaskInput, currentUser: DataScopeUser): Promise<TaskRow> { await this.detail(id, currentUser); if (input.status !== undefined && !isTaskStatusCode(input.status)) throw new BusinessError(CrmErrorCode.CRM_TASK_STATUS_INVALID, '任务状态无效'); const updated = await TaskRepository.update(id, { ...input, completedAt: input.status === 'completed' ? new Date() : input.status ? null : input.completedAt, updaterId: currentUser.id }); if (!updated) throw new BusinessError(CrmErrorCode.CRM_TASK_NOT_FOUND, '任务不存在'); return updated }
  async remove(id: number, currentUser: DataScopeUser) { await this.detail(id, currentUser); if (await TaskRepository.softDelete(id) === 0) throw new BusinessError(CrmErrorCode.CRM_TASK_NOT_FOUND, '任务不存在') }
}
