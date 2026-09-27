import { aliasedTable, and, count, desc, eq, inArray, isNull, like, or, sql, type SQL } from 'drizzle-orm'
import { drizzleDb, type AppQueryDb } from '@/db'
import { sysUser } from '@/db/schema'
import { crmOpportunity, crmOpportunityProductIntent, crmProduct } from '../db/schema.js'

export type OpportunityStage = 'requirement' | 'proposal' | 'negotiation' | 'won' | 'lost'
export type OpportunityLostReason = 'price' | 'competitor' | 'budget_cancelled' | 'demand_cancelled' | 'postponed' | 'unreachable' | 'other'
export interface OpportunityProductIntent { id: number; name: string; code: string }
export interface OpportunityRow {
  id: number; name: string; customerId: number; primaryContactId: number | null; ownerId: number | null; ownerName: string | null; ownerDepartmentId: number | null
  stage: OpportunityStage; stageEnteredAt: Date; amountCents: number | null; expectedCloseDate: Date | null; requirement: string | null; nextAction: string | null; nextFollowUpAt: Date | null; remark: string | null
  lostReason: OpportunityLostReason | null; wonAt: Date | null; lostAt: Date | null; version: number; creatorId: number | null; createdAt: Date; updaterId: number | null; updatedAt: Date; deletedAt: Date | null; products: OpportunityProductIntent[]
}
export interface OpportunityListQuery { page?: number; pageSize?: number; keyword?: string; customerId?: number; primaryContactId?: number; stage?: OpportunityStage; ownerId?: number; ownerIds?: number[] | null; ownerDepartmentIds?: number[] | null }
export interface CreateOpportunityInput { name: string; customerId: number; primaryContactId?: number | null; ownerId: number; ownerDepartmentId?: number | null; stage: OpportunityStage; amountCents?: number | null; expectedCloseDate?: Date | null; requirement?: string | null; nextAction?: string | null; nextFollowUpAt?: Date | null; remark?: string | null; creatorId: number; updaterId: number }
export interface UpdateOpportunityInput { name?: string; primaryContactId?: number | null; ownerId?: number; ownerDepartmentId?: number | null; amountCents?: number | null; expectedCloseDate?: Date | null; requirement?: string | null; nextAction?: string | null; nextFollowUpAt?: Date | null; remark?: string | null; updaterId: number }

const owner = aliasedTable(sysUser, 'crm_opportunity_owner')
const baseColumns = { id: crmOpportunity.id, name: crmOpportunity.name, customerId: crmOpportunity.customerId, primaryContactId: crmOpportunity.primaryContactId, ownerId: crmOpportunity.ownerId, ownerName: owner.realName, ownerDepartmentId: crmOpportunity.ownerDepartmentId, stage: crmOpportunity.stage, stageEnteredAt: crmOpportunity.stageEnteredAt, amountCents: crmOpportunity.amountCents, expectedCloseDate: crmOpportunity.expectedCloseDate, requirement: crmOpportunity.requirement, nextAction: crmOpportunity.nextAction, nextFollowUpAt: crmOpportunity.nextFollowUpAt, remark: crmOpportunity.remark, lostReason: crmOpportunity.lostReason, wonAt: crmOpportunity.wonAt, lostAt: crmOpportunity.lostAt, version: crmOpportunity.version, creatorId: crmOpportunity.creatorId, createdAt: crmOpportunity.createdAt, updaterId: crmOpportunity.updaterId, updatedAt: crmOpportunity.updatedAt, deletedAt: crmOpportunity.deletedAt }

export function buildOpportunityListWhere(q: OpportunityListQuery): SQL | undefined {
  const clauses: SQL[] = [isNull(crmOpportunity.deletedAt)]
  if (q.keyword) clauses.push(like(crmOpportunity.name, `%${q.keyword}%`))
  if (q.customerId !== undefined) clauses.push(eq(crmOpportunity.customerId, q.customerId))
  if (q.primaryContactId !== undefined) clauses.push(eq(crmOpportunity.primaryContactId, q.primaryContactId))
  if (q.stage) clauses.push(eq(crmOpportunity.stage, q.stage))
  if (q.ownerId !== undefined) clauses.push(eq(crmOpportunity.ownerId, q.ownerId))
  if (q.ownerIds !== null && q.ownerIds !== undefined) clauses.push(q.ownerIds.length ? inArray(crmOpportunity.ownerId, q.ownerIds) : sql`1 = 0`)
  if (q.ownerDepartmentIds?.length) clauses.push(or(inArray(crmOpportunity.ownerDepartmentId, q.ownerDepartmentIds), ...(q.ownerIds?.length ? [inArray(crmOpportunity.ownerId, q.ownerIds)] : []))!)
  return and(...clauses)
}

export class OpportunityRepository {
  static async listStagesByCustomerId(customerId: number, db: AppQueryDb = drizzleDb): Promise<OpportunityStage[]> {
    const rows = await db.select({ stage: crmOpportunity.stage }).from(crmOpportunity).where(and(eq(crmOpportunity.customerId, customerId), isNull(crmOpportunity.deletedAt)))
    return rows.map((row) => row.stage as OpportunityStage)
  }
  static async list(q: OpportunityListQuery, db: AppQueryDb = drizzleDb): Promise<{ rows: OpportunityRow[]; total: number }> {
    const where = buildOpportunityListWhere(q); const page = q.page ?? 1; const pageSize = q.pageSize ?? 20
    const [rows, totals] = await Promise.all([db.select(baseColumns).from(crmOpportunity).leftJoin(owner, eq(owner.id, crmOpportunity.ownerId)).where(where).orderBy(desc(crmOpportunity.updatedAt)).limit(pageSize).offset((page - 1) * pageSize), db.select({ total: count() }).from(crmOpportunity).where(where)])
    return { rows: await this.withProducts(rows as Omit<OpportunityRow, 'products'>[], db), total: Number(totals[0]?.total ?? 0) }
  }
  static async findById(id: number, db: AppQueryDb = drizzleDb): Promise<OpportunityRow | null> {
    const [row] = await db.select(baseColumns).from(crmOpportunity).leftJoin(owner, eq(owner.id, crmOpportunity.ownerId)).where(and(eq(crmOpportunity.id, id), isNull(crmOpportunity.deletedAt))).limit(1)
    return row ? (await this.withProducts([row as Omit<OpportunityRow, 'products'>], db))[0] ?? null : null
  }
  static async findByIdForUpdate(id: number, db: AppQueryDb = drizzleDb): Promise<OpportunityRow | null> { return this.findById(id, db) }
  static async create(input: CreateOpportunityInput, db: AppQueryDb = drizzleDb): Promise<OpportunityRow> {
    const [inserted] = await db.insert(crmOpportunity).values({ ...input, primaryContactId: input.primaryContactId ?? null, ownerDepartmentId: input.ownerDepartmentId ?? null, amountCents: input.amountCents ?? null, expectedCloseDate: input.expectedCloseDate ?? null, requirement: input.requirement ?? null, nextAction: input.nextAction ?? null, nextFollowUpAt: input.nextFollowUpAt ?? null, remark: input.remark ?? null }).$returningId()
    const row = await this.findById(inserted.id, db); if (!row) throw new Error('Unable to read created opportunity'); return row
  }
  static async update(id: number, input: UpdateOpportunityInput, db: AppQueryDb = drizzleDb): Promise<OpportunityRow | null> { await db.update(crmOpportunity).set({ ...input, updatedAt: new Date() }).where(and(eq(crmOpportunity.id, id), isNull(crmOpportunity.deletedAt))); return this.findById(id, db) }
  static async updateStage(id: number, stage: OpportunityStage, lostReason: OpportunityLostReason | null, updaterId: number, db: AppQueryDb = drizzleDb): Promise<OpportunityRow | null> { const now = new Date(); await db.update(crmOpportunity).set({ stage, lostReason, stageEnteredAt: now, wonAt: stage === 'won' ? now : null, lostAt: stage === 'lost' ? now : null, updaterId, updatedAt: now }).where(and(eq(crmOpportunity.id, id), isNull(crmOpportunity.deletedAt))); return this.findById(id, db) }
  static async replaceProductIntents(opportunityId: number, productIds: number[], db: AppQueryDb = drizzleDb): Promise<void> { await db.delete(crmOpportunityProductIntent).where(eq(crmOpportunityProductIntent.opportunityId, opportunityId)); const ids = [...new Set(productIds)]; if (ids.length) await db.insert(crmOpportunityProductIntent).values(ids.map((productId) => ({ opportunityId, productId }))) }
  static async softDelete(id: number, db: AppQueryDb = drizzleDb): Promise<number> { const result = await db.update(crmOpportunity).set({ deletedAt: new Date(), updatedAt: new Date() }).where(and(eq(crmOpportunity.id, id), isNull(crmOpportunity.deletedAt))); return Number((result as any)[0]?.affectedRows ?? 0) }
  private static async withProducts(rows: Omit<OpportunityRow, 'products'>[], db: AppQueryDb): Promise<OpportunityRow[]> { if (!rows.length) return []; const intents = await db.select({ opportunityId: crmOpportunityProductIntent.opportunityId, id: crmProduct.id, name: crmProduct.name, code: crmProduct.code }).from(crmOpportunityProductIntent).innerJoin(crmProduct, eq(crmProduct.id, crmOpportunityProductIntent.productId)).where(inArray(crmOpportunityProductIntent.opportunityId, rows.map((row) => row.id))); return rows.map((row) => ({ ...row, stage: row.stage as OpportunityStage, lostReason: row.lostReason as OpportunityLostReason | null, products: intents.filter((intent) => intent.opportunityId === row.id).map(({ id, name, code }) => ({ id, name, code })) })) }
}
