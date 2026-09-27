import { and, eq, isNull, sql } from 'drizzle-orm'
import { drizzleDb, type AppQueryDb } from '@/db'
import { crmDirectClose } from '../db/schema.js'

export type DirectCloseEvidenceType = 'payment_proof' | 'order_confirmation' | 'verbal_confirmation' | 'other'

export interface DirectCloseRow {
  id: number
  customerId: number
  opportunityId: number
  amountCents: number
  closedAt: Date
  evidenceType: DirectCloseEvidenceType
  attachmentIds: number[] | null
  remark: string | null
  revokedAt: Date | null
  revokedReason: string | null
  creatorId: number | null
  createdAt: Date
  updaterId: number | null
  updatedAt: Date
}

export interface CreateDirectCloseInput {
  customerId: number
  opportunityId: number
  amountCents: number
  closedAt: Date
  evidenceType: DirectCloseEvidenceType
  attachmentIds: number[] | null
  remark: string | null
  creatorId: number
  updaterId: number
}

export class DirectCloseRepository {
  static async findById(id: number, db: AppQueryDb = drizzleDb): Promise<DirectCloseRow | null> {
    const rows = await db.select().from(crmDirectClose).where(eq(crmDirectClose.id, id)).limit(1)
    return (rows[0] as DirectCloseRow | undefined) ?? null
  }

  static async findByIdForUpdate(id: number, db: AppQueryDb): Promise<DirectCloseRow | null> {
    await db.execute(sql`SELECT id FROM ${crmDirectClose} WHERE id = ${id} FOR UPDATE`)
    return DirectCloseRepository.findById(id, db)
  }

  static async findActiveByOpportunityId(opportunityId: number, db: AppQueryDb = drizzleDb): Promise<DirectCloseRow | null> {
    const rows = await db.select().from(crmDirectClose).where(and(
      eq(crmDirectClose.opportunityId, opportunityId),
      isNull(crmDirectClose.revokedAt),
    )).limit(1)
    return (rows[0] as DirectCloseRow | undefined) ?? null
  }

  static async hasActiveByCustomerId(customerId: number, db: AppQueryDb = drizzleDb): Promise<boolean> {
    const rows = await db.select({ id: crmDirectClose.id }).from(crmDirectClose).where(and(
      eq(crmDirectClose.customerId, customerId),
      isNull(crmDirectClose.revokedAt),
    )).limit(1)
    return rows.length > 0
  }

  static async create(input: CreateDirectCloseInput, db: AppQueryDb = drizzleDb): Promise<{ id: number }> {
    const result = await db.insert(crmDirectClose).values(input)
    return { id: Number(result[0].insertId) }
  }

  static async revoke(id: number, reason: string, updaterId: number, db: AppQueryDb = drizzleDb): Promise<DirectCloseRow | null> {
    await db.update(crmDirectClose).set({
      revokedAt: new Date(),
      revokedReason: reason,
      updaterId,
      updatedAt: new Date(),
    }).where(and(eq(crmDirectClose.id, id), isNull(crmDirectClose.revokedAt)))
    return DirectCloseRepository.findById(id, db)
  }
}
