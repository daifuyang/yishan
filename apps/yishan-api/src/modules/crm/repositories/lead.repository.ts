import { and, count, desc, eq, inArray, isNull, like, or, type SQL } from 'drizzle-orm'
import { drizzleDb, type AppQueryDb } from '@/db'
import { sysUser } from '@/db/schema'
import { crmLead } from '../db/schema.js'

export type LeadStatus = 'new' | 'processing' | 'qualified' | 'disqualified' | 'converted'
/** 线索显式归属状态，与 ownerUserId 解耦。 */
export type LeadPoolStatus = 'owned' | 'public' | 'unassigned'
export const LEAD_POOL_STATUS_PUBLIC: LeadPoolStatus = 'public'
export interface LeadRow { id: number; name: string | null; companyName: string | null; mobile: string | null; phone: string | null; email: string | null; wechat: string | null; qq: string | null; sourceId: number | null; intention: string | null; status: LeadStatus; ownerUserId: number | null; ownerUserName: string | null; ownerDepartmentId: number | null; poolStatus: LeadPoolStatus; createdBy: number | null; lastFollowUpAt: Date | null; nextFollowUpAt: Date | null; disqualifyReason: string | null; convertedCustomerId: number | null; convertedContactId: number | null; convertedAt: Date | null; createdAt: Date; updatedAt: Date }
export interface LeadListQuery { page?: number; pageSize?: number; keyword?: string; status?: LeadStatus; ownerUserId?: number; pool?: boolean; ownerUserIds?: number[] | null; ownerDepartmentIds?: number[] | null }
export interface CreateLeadInput { name?: string | null; companyName?: string | null; mobile?: string | null; phone?: string | null; email?: string | null; wechat?: string | null; qq?: string | null; sourceId?: number | null; intention?: string | null; ownerUserId?: number | null; ownerDepartmentId?: number | null; poolStatus?: LeadPoolStatus; creatorId: number; createdBy?: number | null; updaterId: number }
export interface UpdateLeadInput { status?: LeadStatus; ownerUserId?: number | null; ownerDepartmentId?: number | null; poolStatus?: LeadPoolStatus; lastFollowUpAt?: Date | null; nextFollowUpAt?: Date | null; disqualifyReason?: string | null; updaterId: number }
const columns = { id: crmLead.id, name: crmLead.name, companyName: crmLead.companyName, mobile: crmLead.mobile, phone: crmLead.phone, email: crmLead.email, wechat: crmLead.wechat, qq: crmLead.qq, sourceId: crmLead.sourceId, intention: crmLead.intention, status: crmLead.status, ownerUserId: crmLead.ownerUserId, ownerUserName: sysUser.realName, ownerDepartmentId: crmLead.ownerDepartmentId, poolStatus: crmLead.poolStatus, createdBy: crmLead.creatorId, lastFollowUpAt: crmLead.lastFollowUpAt, nextFollowUpAt: crmLead.nextFollowUpAt, disqualifyReason: crmLead.disqualifyReason, convertedCustomerId: crmLead.convertedCustomerId, convertedContactId: crmLead.convertedContactId, convertedAt: crmLead.convertedAt, createdAt: crmLead.createdAt, updatedAt: crmLead.updatedAt }
function whereFor(q: LeadListQuery): SQL | undefined {
  const c: SQL[] = [isNull(crmLead.deletedAt)]
  if (q.keyword) {
    const v = `%${q.keyword}%`
    c.push(or(like(crmLead.name, v), like(crmLead.companyName, v), like(crmLead.mobile, v), like(crmLead.email, v))!)
  }
  if (q.status) c.push(eq(crmLead.status, q.status))
  if (q.ownerUserId !== undefined) c.push(eq(crmLead.ownerUserId, q.ownerUserId))
  // 公海判定走显式 poolStatus，不再用 ownerUserId IS NULL 推导
  if (q.pool) c.push(eq(crmLead.poolStatus, LEAD_POOL_STATUS_PUBLIC))
  if (q.ownerUserIds !== null || q.ownerDepartmentIds !== null) {
    const visible: SQL[] = [eq(crmLead.poolStatus, LEAD_POOL_STATUS_PUBLIC)]
    if (q.ownerUserIds?.length) visible.push(inArray(crmLead.ownerUserId, q.ownerUserIds))
    if (q.ownerDepartmentIds?.length) visible.push(inArray(crmLead.ownerDepartmentId, q.ownerDepartmentIds))
    c.push(or(...visible)!)
  }
  return and(...c)
}
export class LeadRepository {
  static async list(q: LeadListQuery, db: AppQueryDb = drizzleDb): Promise<{ rows: LeadRow[]; total: number }> {
    const page = q.page ?? 1
    const pageSize = q.pageSize ?? 10
    const where = whereFor(q)
    const [rows, total] = await Promise.all([
      db.select(columns).from(crmLead).leftJoin(sysUser, eq(sysUser.id, crmLead.ownerUserId)).where(where).orderBy(desc(crmLead.updatedAt)).limit(pageSize).offset((page - 1) * pageSize),
      db.select({ c: count() }).from(crmLead).where(where),
    ])
    return { rows: rows as LeadRow[], total: Number(total[0]?.c ?? 0) }
  }
  static async findById(id: number, db: AppQueryDb = drizzleDb): Promise<LeadRow | null> {
    const [row] = await db.select(columns).from(crmLead).leftJoin(sysUser, eq(sysUser.id, crmLead.ownerUserId)).where(and(eq(crmLead.id, id), isNull(crmLead.deletedAt))).limit(1)
    return row ? row as LeadRow : null
  }
  static async create(input: CreateLeadInput, db: AppQueryDb = drizzleDb): Promise<LeadRow> {
    const [inserted] = await db.insert(crmLead).values({ ...input, status: 'new' }).$returningId()
    const row = await LeadRepository.findById(inserted.id, db)
    if (!row) throw new Error('Failed to read back created CRM lead')
    return row
  }
  static async update(id: number, input: UpdateLeadInput, db: AppQueryDb = drizzleDb): Promise<LeadRow | null> {
    await db.update(crmLead).set({ ...input, updatedAt: new Date() }).where(and(eq(crmLead.id, id), isNull(crmLead.deletedAt)))
    return LeadRepository.findById(id, db)
  }
  /**
   * 认领公海线索：要求 poolStatus='public'，且状态允许认领。
   * 成功后置 owned，与 createdBy 解耦——createdBy 始终指向最初创建人。
   */
  static async claimInTx(id: number, ownerUserId: number, ownerDepartmentId: number | null, updaterId: number, db: AppQueryDb): Promise<number> {
    const result = await db.update(crmLead)
      .set({ ownerUserId, ownerDepartmentId, poolStatus: 'owned', updaterId, updatedAt: new Date() })
      .where(and(
        eq(crmLead.id, id),
        eq(crmLead.poolStatus, LEAD_POOL_STATUS_PUBLIC),
        isNull(crmLead.deletedAt),
        or(eq(crmLead.status, 'new'), eq(crmLead.status, 'processing'))!,
      ))
    return ((result as unknown as [{ affectedRows?: number } | undefined])[0])?.affectedRows ?? 0
  }
}
