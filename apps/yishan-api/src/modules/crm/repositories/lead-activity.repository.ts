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
  /**
   * 接受 ISO 字符串或 Date。
   *
   * HTTP body 经 TypeBox 解析后总是字符串（`LeadActivityCreateReqSchema`），
   * service 层在进入仓储之前已经统一 `new Date(...)` 归一化；此处再宽到
   * `string | Date` 让 service 的入参类型能直接接 route 透传的 body。
   * repo 内的 `new Date()` 是防御性兜底：未来若有人绕过 service 直接调用
   * repo 也不会再次踩 `value.toISOString is not a function` 的坑。
   */
  occurredAt?: string | Date
  nextFollowUpAt?: string | Date | null
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
    // 防御性归一化：service 进来的应当已是 Date，但仓储是 datetime 列的最后一道门，
    // 不依赖 caller 兜底，避免字符串直传 Drizzle 时调 toISOString 抛错。
    const occurredAt = input.occurredAt ? new Date(input.occurredAt) : new Date()
    const nextFollowUpAt = input.nextFollowUpAt ? new Date(input.nextFollowUpAt) : null
    const [inserted] = await db.insert(crmLeadActivity).values({
      leadId: input.leadId,
      type: input.type,
      content: input.content,
      occurredAt,
      nextFollowUpAt,
      operatorUserId: input.operatorUserId,
    }).$returningId()
    const [row] = await db.select(columns).from(crmLeadActivity).where(eq(crmLeadActivity.id, inserted.id)).limit(1)
    if (!row) throw new Error('Failed to read back created CRM lead activity')
    return row as LeadActivityRow
  }
}
