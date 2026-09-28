import { aliasedTable, and, count, desc, eq, isNull, like } from 'drizzle-orm'
import { drizzleDb, type AppQueryDb } from '@/db'
import { sysUser } from '@/db/schema'
import { crmCustomer, crmTask } from '../db/schema.js'
import { buildListWhere } from './customer.repository.js'
import type { ScopeContext } from '../schemas/data-scope.js'

export interface TaskRow {
  id: number
  customerId: number
  title: string
  status: string
  priority: string
  assigneeUserId: number | null
  dueAt: Date | null
  completedAt: Date | null
  description: string | null
  creatorId: number | null
  updaterId: number | null
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}
export interface TaskListQuery {
  page?: number
  pageSize?: number
  keyword?: string
  customerId?: number
  status?: string
  assigneeUserId?: number
}
export type CreateTaskInput = Omit<TaskRow, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>
export type UpdateTaskInput = Partial<
  Pick<TaskRow, 'title' | 'status' | 'priority' | 'assigneeUserId' | 'dueAt' | 'completedAt' | 'description'>
> & { updaterId: number }

function buildWhere(query: TaskListQuery) {
  const conditions: any[] = [isNull(crmTask.deletedAt)]
  if (query.keyword) conditions.push(like(crmTask.title, `%${query.keyword}%`))
  if (query.customerId !== undefined) conditions.push(eq(crmTask.customerId, query.customerId))
  if (query.status) conditions.push(eq(crmTask.status, query.status))
  if (query.assigneeUserId !== undefined) conditions.push(eq(crmTask.assigneeUserId, query.assigneeUserId))
  return and(...conditions)
}

// 为 sys_user 起两个别名表：creator / assignee
const sysUserAsCreator = aliasedTable(sysUser, 'sys_user_creator')
const sysUserAsAssignee = aliasedTable(sysUser, 'sys_user_assignee')

const taskBaseColumns = {
  id: crmTask.id,
  customerId: crmTask.customerId,
  title: crmTask.title,
  status: crmTask.status,
  priority: crmTask.priority,
  assigneeUserId: crmTask.assigneeUserId,
  dueAt: crmTask.dueAt,
  completedAt: crmTask.completedAt,
  description: crmTask.description,
  creatorId: crmTask.creatorId,
  createdAt: crmTask.createdAt,
  updaterId: crmTask.updaterId,
  updatedAt: crmTask.updatedAt,
}

export class TaskRepository {
  static async list(
    query: TaskListQuery,
    scope: ScopeContext,
    db: AppQueryDb = drizzleDb,
  ): Promise<{ rows: TaskRow[]; total: number }> {
    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 10
    const where = and(buildWhere(query), buildListWhere(scope))
    const [rows, totals] = await Promise.all([
      db.select({
        ...taskBaseColumns,
        assigneeName: sysUserAsAssignee.realName,
        creatorName: sysUserAsCreator.realName,
      })
        .from(crmTask)
        .innerJoin(crmCustomer, eq(crmTask.customerId, crmCustomer.id))
        .leftJoin(sysUserAsAssignee, eq(sysUserAsAssignee.id, crmTask.assigneeUserId))
        .leftJoin(sysUserAsCreator, eq(sysUserAsCreator.id, crmTask.creatorId))
        .where(where)
        .orderBy(desc(crmTask.dueAt), desc(crmTask.id))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db.select({ total: count() })
        .from(crmTask)
        .innerJoin(crmCustomer, eq(crmTask.customerId, crmCustomer.id))
        .where(where),
    ])
    return {
      rows: rows.map((row: any) => row.crm_task ?? row) as TaskRow[],
      total: Number(totals[0]?.total ?? 0),
    }
  }
  static async findById(id: number, db: AppQueryDb = drizzleDb): Promise<TaskRow | null> {
    const rows = await db
      .select(taskBaseColumns)
      .from(crmTask)
      .where(and(eq(crmTask.id, id), isNull(crmTask.deletedAt)))
      .limit(1)
    return (rows[0] as TaskRow | undefined) ?? null
  }
  static async create(input: CreateTaskInput, db: AppQueryDb = drizzleDb): Promise<TaskRow> {
    const result = await db.insert(crmTask).values(input as any)
    const task = await TaskRepository.findById(Number(result[0].insertId), db)
    if (!task) throw new Error('Task insert did not return a row')
    return task
  }
  static async update(
    id: number,
    input: UpdateTaskInput,
    db: AppQueryDb = drizzleDb,
  ): Promise<TaskRow | null> {
    await db
      .update(crmTask)
      .set({ ...input, updatedAt: new Date() } as any)
      .where(and(eq(crmTask.id, id), isNull(crmTask.deletedAt)))
    return TaskRepository.findById(id, db)
  }
  static async softDelete(id: number, db: AppQueryDb = drizzleDb): Promise<number> {
    const result = await db
      .update(crmTask)
      .set({ deletedAt: new Date() })
      .where(and(eq(crmTask.id, id), isNull(crmTask.deletedAt)))
    return Number(result[0]?.affectedRows ?? 0)
  }
}