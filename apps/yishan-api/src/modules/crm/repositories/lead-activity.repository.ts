import { desc, eq } from 'drizzle-orm'
import { drizzleDb, type AppQueryDb } from '@/db'
import { sysUser } from '@/db/schema'
import { crmLeadActivity } from '../db/schema.js'

export interface LeadActivityRow {
  id: number
  leadId: number
  type: string
  content: string
  occurredAt: Date
  nextFollowUpAt: Date | null
  operatorUserId: number
  createdAt: Date
  updatedAt: Date
}

export interface LeadActivityRowWithOperator extends LeadActivityRow {
  operatorUserName: string | null
}

export interface CreateLeadActivityInput {
  leadId: number
  type: string
  content: string
  occurredAt?: Date
  nextFollowUpAt?: Date | null
  operatorUserId: number
}

const columns = {
  id: crmLeadActivity.id,
  leadId: crmLeadActivity.leadId,
  type: crmLeadActivity.type,
  content: crmLeadActivity.content,
  occurredAt: crmLeadActivity.occurredAt,
  nextFollowUpAt: crmLeadActivity.nextFollowUpAt,
  operatorUserId: crmLeadActivity.operatorUserId,
  createdAt: crmLeadActivity.createdAt,
  updatedAt: crmLeadActivity.updatedAt,
}

export class LeadActivityRepository {
  static async listByLeadId(
    leadId: number,
    opts: { limit?: number } = {},
    db: AppQueryDb = drizzleDb,
  ): Promise<LeadActivityRowWithOperator[]> {
    const rows = await db
      .select({ ...columns, operatorUserName: sysUser.realName })
      .from(crmLeadActivity)
      .leftJoin(sysUser, eq(sysUser.id, crmLeadActivity.operatorUserId))
      .where(eq(crmLeadActivity.leadId, leadId))
      .orderBy(desc(crmLeadActivity.occurredAt))
      .limit(opts.limit ?? 100)
    return rows as LeadActivityRowWithOperator[]
  }

  static async create(
    input: CreateLeadActivityInput,
    db: AppQueryDb = drizzleDb,
  ): Promise<LeadActivityRow> {
    const [inserted] = await db.insert(crmLeadActivity).values({
      leadId: input.leadId,
      type: input.type,
      content: input.content,
      occurredAt: input.occurredAt ?? new Date(),
      nextFollowUpAt: input.nextFollowUpAt ?? null,
      operatorUserId: input.operatorUserId,
    }).$returningId()
    const [row] = await db.select(columns).from(crmLeadActivity).where(eq(crmLeadActivity.id, inserted.id)).limit(1)
    if (!row) throw new Error('Failed to read back created CRM lead activity')
    return row as LeadActivityRow
  }
}
