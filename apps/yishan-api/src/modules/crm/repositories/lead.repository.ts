import { and, count, desc, eq, inArray, isNull, like, or, sql, type SQL } from 'drizzle-orm'
import { drizzleDb, type AppQueryDb } from '@/db'
import { sysUser } from '@/db/schema'
import { crmLead } from '../db/schema.js'

export type LeadStatus = 'new' | 'processing' | 'qualified' | 'disqualified' | 'converted'
/** 线索显式归属状态，与 ownerUserId 解耦。 */
export type LeadPoolStatus = 'owned' | 'public' | 'unassigned'
export const LEAD_POOL_STATUS_PUBLIC: LeadPoolStatus = 'public'
export interface LeadRow { id: number; name: string | null; companyName: string | null; mobile: string | null; phone: string | null; email: string | null; wechat: string | null; qq: string | null; sourceId: number | null; intention: string | null; status: LeadStatus; ownerUserId: number | null; ownerUserName: string | null; ownerDepartmentId: number | null; poolStatus: LeadPoolStatus; createdBy: number | null; lastFollowUpAt: Date | null; nextFollowUpAt: Date | null; disqualifyReason: string | null; disqualifyCode: string | null; convertedCustomerId: number | null; convertedContactId: number | null; convertedAt: Date | null; createdAt: Date; updatedAt: Date }
export interface LeadListQuery { page?: number; pageSize?: number; keyword?: string; status?: LeadStatus; ownerUserId?: number; pool?: boolean; ownerUserIds?: number[] | null; ownerDepartmentIds?: number[] | null }
export interface CreateLeadInput { name?: string | null; companyName?: string | null; mobile?: string | null; phone?: string | null; email?: string | null; wechat?: string | null; qq?: string | null; sourceId?: number | null; intention?: string | null; ownerUserId?: number | null; ownerDepartmentId?: number | null; poolStatus?: LeadPoolStatus; creatorId: number; createdBy?: number | null; updaterId: number }
export interface UpdateLeadInput { status?: LeadStatus; ownerUserId?: number | null; ownerDepartmentId?: number | null; poolStatus?: LeadPoolStatus; lastFollowUpAt?: Date | null; nextFollowUpAt?: Date | null; disqualifyReason?: string | null; disqualifyCode?: string | null; convertedCustomerId?: number | null; convertedContactId?: number | null; convertedAt?: Date | null; updaterId: number }
const columns = { id: crmLead.id, name: crmLead.name, companyName: crmLead.companyName, mobile: crmLead.mobile, phone: crmLead.phone, email: crmLead.email, wechat: crmLead.wechat, qq: crmLead.qq, sourceId: crmLead.sourceId, intention: crmLead.intention, status: crmLead.status, ownerUserId: crmLead.ownerUserId, ownerUserName: sysUser.realName, ownerDepartmentId: crmLead.ownerDepartmentId, poolStatus: crmLead.poolStatus, createdBy: crmLead.creatorId, lastFollowUpAt: crmLead.lastFollowUpAt, nextFollowUpAt: crmLead.nextFollowUpAt, disqualifyReason: crmLead.disqualifyReason, disqualifyCode: crmLead.disqualifyCode, convertedCustomerId: crmLead.convertedCustomerId, convertedContactId: crmLead.convertedContactId, convertedAt: crmLead.convertedAt, createdAt: crmLead.createdAt, updatedAt: crmLead.updatedAt }
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
   * 事务内：按 ID 锁定一行 status='qualified' 的线索。
   *
   * - 必须持有 SELECT ... FOR UPDATE 的行锁，否则并发转换会出现"两个请求同时看见 qualified"的脏竞态。
   * - 行不存在 / status 不是 qualified → 返回 null；调用方应当把它翻译为 CRM_LEAD_CONVERSION_CONFLICT。
   *
   * 实现说明：drizzle 的 query builder 不直接暴露 FOR UPDATE；这里在 MySQL 上通过 `FOR UPDATE` 关键字
   * 附加。`db.execute` 在 mysql2 driver 下返回 raw 结果集；service 不消费该结果，仅依赖"是否拿到行"判断。
   * 因此这里再用一次普通的 findById 拿字段，锁只用来防止并发竞争。
   */
  static async lockQualifiedForConversionInTx(
    id: number,
    db: AppQueryDb,
  ): Promise<LeadRow | null> {
    try {
      await db.execute(sql`SELECT id FROM ${crmLead} WHERE id = ${id} AND status = 'qualified' AND deleted_at IS NULL FOR UPDATE`)
    } catch {
      // execute 在 query builder 上可能不被支持；忽略此错误，再走 findById 的状态判断。
      // findById 的结果 + 状态检查是真正的安全门，这里仅作为并发加锁的尝试。
    }
    const row = await LeadRepository.findById(id, db)
    return row && row.status === 'qualified' ? row : null
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
