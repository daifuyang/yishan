import { and, count, desc, eq, isNull, like } from 'drizzle-orm'
import { drizzleDb, type AppQueryDb } from '@/db'
import { crmTask } from '../db/schema.js'

export interface TaskRow { id: number; customerId: number; title: string; status: string; assigneeUserId: number | null; dueAt: Date | null; completedAt: Date | null; description: string | null; creatorId: number | null; updaterId: number | null; createdAt: Date; updatedAt: Date; deletedAt: Date | null }
export interface TaskListQuery { page?: number; pageSize?: number; customerId?: number; status?: string; keyword?: string; assigneeUserId?: number }
export type CreateTaskInput = Omit<TaskRow, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>
export type UpdateTaskInput = Partial<Pick<TaskRow, 'title' | 'status' | 'assigneeUserId' | 'dueAt' | 'completedAt' | 'description'>> & { updaterId: number }
function buildWhere(query: TaskListQuery) { const conditions: any[] = [isNull(crmTask.deletedAt)]; if (query.customerId !== undefined) conditions.push(eq(crmTask.customerId, query.customerId)); if (query.status) conditions.push(eq(crmTask.status, query.status)); if (query.assigneeUserId !== undefined) conditions.push(eq(crmTask.assigneeUserId, query.assigneeUserId)); if (query.keyword) conditions.push(like(crmTask.title, `%${query.keyword}%`)); return and(...conditions) }
export class TaskRepository {
  static async list(query: TaskListQuery, db: AppQueryDb = drizzleDb): Promise<{ rows: TaskRow[]; total: number }> { const page = query.page ?? 1; const pageSize = query.pageSize ?? 10; const where = buildWhere(query); const [rows, totals] = await Promise.all([db.select().from(crmTask).where(where).orderBy(desc(crmTask.dueAt)).limit(pageSize).offset((page - 1) * pageSize), db.select({ total: count() }).from(crmTask).where(where)]); return { rows: rows as TaskRow[], total: Number(totals[0]?.total ?? 0) } }
  static async findById(id: number, db: AppQueryDb = drizzleDb): Promise<TaskRow | null> { const rows = await db.select().from(crmTask).where(and(eq(crmTask.id, id), isNull(crmTask.deletedAt))).limit(1); return (rows[0] as TaskRow | undefined) ?? null }
  static async create(input: CreateTaskInput, db: AppQueryDb = drizzleDb): Promise<TaskRow> { const result = await db.insert(crmTask).values(input as any); const task = await TaskRepository.findById(Number(result[0].insertId), db); if (!task) throw new Error('Task insert did not return a row'); return task }
  static async update(id: number, input: UpdateTaskInput, db: AppQueryDb = drizzleDb): Promise<TaskRow | null> { await db.update(crmTask).set({ ...input, updatedAt: new Date() } as any).where(and(eq(crmTask.id, id), isNull(crmTask.deletedAt))); return TaskRepository.findById(id, db) }
  static async softDelete(id: number, db: AppQueryDb = drizzleDb): Promise<number> { const result = await db.update(crmTask).set({ deletedAt: new Date() }).where(and(eq(crmTask.id, id), isNull(crmTask.deletedAt))); return Number(result[0].affectedRows ?? 0) }
}
