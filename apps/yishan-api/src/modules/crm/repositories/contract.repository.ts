import { and, count, desc, eq, isNull, like, or } from 'drizzle-orm'
import { drizzleDb, type AppQueryDb } from '@/db'
import { crmContract } from '../db/schema.js'

export interface ContractRow {
  id: number; contractNo: string; name: string; customerId: number; opportunityId: number | null; quotationId: number | null
  amountCents: number; signedAt: Date | null; effectiveAt: Date | null; expiresAt: Date | null; status: string
  ownerUserId: number | null; ownerDepartmentId: number | null; attachmentIds: unknown; description: string | null
  creatorId: number | null; updaterId: number | null; createdAt: Date; updatedAt: Date; deletedAt: Date | null
}
export interface ContractListQuery { page?: number; pageSize?: number; keyword?: string; customerId?: number; status?: string; ownerUserIds?: number[] | null; ownerDepartmentIds?: number[] | null }
export type CreateContractInput = Omit<ContractRow, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>
export type UpdateContractInput = Partial<Omit<CreateContractInput, 'contractNo' | 'customerId' | 'quotationId' | 'creatorId'>> & { updaterId: number }

function buildWhere(query: ContractListQuery) {
  const conditions: any[] = [isNull(crmContract.deletedAt)]
  if (query.keyword) conditions.push(or(like(crmContract.name, `%${query.keyword}%`), like(crmContract.contractNo, `%${query.keyword}%`)))
  if (query.customerId !== undefined) conditions.push(eq(crmContract.customerId, query.customerId))
  if (query.status) conditions.push(eq(crmContract.status, query.status))
  if (query.ownerUserIds !== undefined && query.ownerUserIds !== null) {
    const ownerConditions: any[] = query.ownerUserIds.map((id) => eq(crmContract.ownerUserId, id))
    for (const id of query.ownerDepartmentIds ?? []) ownerConditions.push(eq(crmContract.ownerDepartmentId, id))
    conditions.push(or(...ownerConditions))
  }
  return and(...conditions)
}

export class ContractRepository {
  static async list(query: ContractListQuery, db: AppQueryDb = drizzleDb): Promise<{ rows: ContractRow[]; total: number }> {
    const page = query.page ?? 1; const pageSize = query.pageSize ?? 10; const where = buildWhere(query)
    const [rows, totalRows] = await Promise.all([
      db.select().from(crmContract).where(where).orderBy(desc(crmContract.createdAt)).limit(pageSize).offset((page - 1) * pageSize),
      db.select({ total: count() }).from(crmContract).where(where),
    ])
    return { rows: rows as ContractRow[], total: Number(totalRows[0]?.total ?? 0) }
  }
  static async findById(id: number, db: AppQueryDb = drizzleDb): Promise<ContractRow | null> {
    const rows = await db.select().from(crmContract).where(and(eq(crmContract.id, id), isNull(crmContract.deletedAt))).limit(1)
    return (rows[0] as ContractRow | undefined) ?? null
  }
  static async findByQuotationId(quotationId: number, db: AppQueryDb = drizzleDb): Promise<ContractRow | null> {
    const rows = await db.select().from(crmContract).where(and(eq(crmContract.quotationId, quotationId), isNull(crmContract.deletedAt))).limit(1)
    return (rows[0] as ContractRow | undefined) ?? null
  }
  static async create(input: CreateContractInput, db: AppQueryDb = drizzleDb): Promise<{ id: number }> {
    const result = await db.insert(crmContract).values(input as any)
    return { id: Number(result[0].insertId) }
  }
  static async update(id: number, input: UpdateContractInput, db: AppQueryDb = drizzleDb): Promise<ContractRow | null> {
    await db.update(crmContract).set({ ...input, updatedAt: new Date() } as any).where(and(eq(crmContract.id, id), isNull(crmContract.deletedAt)))
    return ContractRepository.findById(id, db)
  }
  static async softDelete(id: number, db: AppQueryDb = drizzleDb): Promise<number> {
    const result = await db.update(crmContract).set({ deletedAt: new Date() }).where(and(eq(crmContract.id, id), isNull(crmContract.deletedAt)))
    return Number(result[0].affectedRows ?? 0)
  }
  static async countTodayByNoPrefix(prefix: string, db: AppQueryDb = drizzleDb): Promise<number> {
    const rows = await db.select({ total: count() }).from(crmContract).where(like(crmContract.contractNo, `${prefix}%`))
    return Number(rows[0]?.total ?? 0)
  }
}
