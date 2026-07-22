import {
  TodosRepository,
  type CreateTodoInput,
  type TodoRow,
  type TodoStatus,
  type UpdateTodoInput,
} from '../repositories/todos.repository.js'
import type { AppQueryDb } from '@/db'

/**
 * Todos Service：业务编排。
 *
 * 演示要点：
 *   - 服务层拿 db 句柄（构造注入）而不是 import drizzleDb 常量
 *   - 服务层调 repository，不接触 SQL / drizzle 算子
 *   - 路由层只调 service
 */

export class TodosService {
  constructor(private readonly db: AppQueryDb) {}

  async list(): Promise<{ total: number; items: TodoRow[] }> {
    const items = await TodosRepository.list(this.db)
    return { total: items.length, items }
  }

  async findById(id: number): Promise<TodoRow> {
    const row = await TodosRepository.findById(id, this.db)
    if (!row) {
      throw new Error('Todo not found')
    }
    return row
  }

  async create(input: CreateTodoInput): Promise<TodoRow> {
    const title = input.title?.trim() ?? ''
    if (title.length === 0) {
      throw new Error('Title cannot be empty')
    }
    const status = normalizeStatus(input.status)
    return TodosRepository.create(
      { title, description: input.description ?? '', status, dueAt: input.dueAt ?? null },
      this.db,
    )
  }

  async update(id: number, input: UpdateTodoInput): Promise<TodoRow> {
    if (input.title !== undefined) {
      const title = input.title.trim()
      if (title.length === 0) {
        throw new Error('Title cannot be empty')
      }
      input.title = title
    }
    if (input.status !== undefined) {
      input.status = normalizeStatus(input.status)
    }
    return TodosRepository.update(id, input, this.db)
  }

  async remove(id: number): Promise<void> {
    const existing = await TodosRepository.findById(id, this.db)
    if (!existing) {
      throw new Error('Todo not found')
    }
    await TodosRepository.remove(id, this.db)
  }
}

function normalizeStatus(input: unknown): TodoStatus {
  const n = Number(input ?? 0)
  if (n === 0 || n === 1 || n === 2) return n as TodoStatus
  throw new Error('Status must be 0, 1, or 2')
}
