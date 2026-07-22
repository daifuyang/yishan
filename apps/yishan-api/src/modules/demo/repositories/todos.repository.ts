import { desc, eq } from 'drizzle-orm'
import { drizzleDb, type AppQueryDb } from '@/db'
import { demoTodos } from '../db/schema.js'

/**
 * Todos Repository。
 *
 * 整个 demo 模块内**唯一**允许访问 demoTodos / drizzleDb 的层。
 * module.ts 与 todos.service.ts 都禁止直接导入 @/db 或 db/schema。
 */

export type TodoStatus = 0 | 1 | 2

export interface TodoRow {
  id: number
  title: string
  description: string
  status: TodoStatus
  dueAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateTodoInput {
  title: string
  description?: string
  status?: TodoStatus
  dueAt?: Date | null
}

export interface UpdateTodoInput {
  title?: string
  description?: string
  status?: TodoStatus
  dueAt?: Date | null
}

export class TodosRepository {
  static async list(db: AppQueryDb = drizzleDb): Promise<TodoRow[]> {
    const rows = await db
      .select()
      .from(demoTodos)
      .orderBy(desc(demoTodos.id))
    return rows as TodoRow[]
  }

  static async findById(id: number, db: AppQueryDb = drizzleDb): Promise<TodoRow | null> {
    const [row] = await db
      .select()
      .from(demoTodos)
      .where(eq(demoTodos.id, id))
      .limit(1)
    return (row as TodoRow | undefined) ?? null
  }

  static async create(input: CreateTodoInput, db: AppQueryDb = drizzleDb): Promise<TodoRow> {
    const [inserted] = await db.insert(demoTodos).values({
      title: input.title,
      description: input.description ?? '',
      status: input.status ?? 0,
      dueAt: input.dueAt ?? null,
    }).$returningId()

    const created = await TodosRepository.findById(inserted.id, db)
    if (!created) {
      throw new Error('Failed to read back created demo todo')
    }
    return created
  }

  static async update(id: number, input: UpdateTodoInput, db: AppQueryDb = drizzleDb): Promise<TodoRow> {
    const patch: Record<string, unknown> = {}
    if (input.title !== undefined) patch.title = input.title
    if (input.description !== undefined) patch.description = input.description
    if (input.status !== undefined) patch.status = input.status
    if (input.dueAt !== undefined) patch.dueAt = input.dueAt
    patch.updatedAt = new Date()
    await db.update(demoTodos).set(patch).where(eq(demoTodos.id, id))
    const updated = await TodosRepository.findById(id, db)
    if (!updated) {
      throw new Error('Failed to read back updated demo todo')
    }
    return updated
  }

  static async remove(id: number, db: AppQueryDb = drizzleDb): Promise<void> {
    await db.delete(demoTodos).where(eq(demoTodos.id, id))
  }
}
