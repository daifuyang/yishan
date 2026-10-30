import { and, asc, count, desc, eq, gte, inArray, isNull, like, lte, or } from 'drizzle-orm'
import { drizzleDb } from '@yishan/core-system-api/database'
import { crmCustomer, crmDispatch, crmDispatchFollowLog, crmDispatchMobileViewLog, crmDispatchReply, crmDispatchStatus, crmDispatchViewLog, crmHospital } from '../db/schema.js'
import { sysUser } from '@yishan/core-system-api/schema'

const active = (t: any) => isNull(t.deletedAt)
const page = (q: any, p: any) =>
  p.pageSize === 0 ? q : q.limit(p.pageSize).offset((p.page - 1) * p.pageSize)

export class DispatchesRepository {
  /**
   * q 支持的字段:
   *   statusId, hospitalIds, creatorUserIds, startTime, endTime, keyword,
   *   page, pageSize（分页）,
   *
   * - creatorUserIds: 客服只能查看自己创建的派单。
   */
  static async list(q: any) {
    const c: any[] = [active(crmDispatch)]

    if (q.statusId) c.push(eq(crmDispatch.statusId, q.statusId))
    if (q.hospitalIds?.length) c.push(inArray(crmDispatch.hospitalId, q.hospitalIds))
    if (q.creatorUserIds?.length) c.push(inArray(crmDispatch.creatorId, q.creatorUserIds))
    if (q.startTime) c.push(gte(crmDispatch.createdAt, new Date(q.startTime)))
    if (q.endTime) c.push(lte(crmDispatch.createdAt, new Date(q.endTime)))
    if (q.keyword) {
      const cs = await drizzleDb
        .select({ id: crmCustomer.id })
        .from(crmCustomer)
        .where(
          or(
            like(crmCustomer.mobile, `%${q.keyword}%`),
            like(crmCustomer.name, `%${q.keyword}%`),
            like(crmCustomer.numberId, `%${q.keyword}%`),
          )!,
        )
      const hs = await drizzleDb
        .select({ id: crmHospital.id })
        .from(crmHospital)
        .where(like(crmHospital.hospitalName, `%${q.keyword}%`))
      c.push(
        or(
          inArray(crmDispatch.customerId, cs.length ? cs.map((x) => x.id) : [-1]),
          inArray(crmDispatch.hospitalId, hs.length ? hs.map((x) => x.id) : [-1]),
        )!,
      )
    }

    const where = and(...c)
    const [items, totals] = await Promise.all([
      page(drizzleDb.select().from(crmDispatch).where(where).orderBy(desc(crmDispatch.createdAt)), q),
      drizzleDb.select({ total: count() }).from(crmDispatch).where(where),
    ])
    return {
      list: await Promise.all(items.map((x) => this.findById(x.id))),
      total: Number(totals[0]?.total ?? 0),
    }
  }

  static async findById(id: number) {
    const [d] = await drizzleDb
      .select()
      .from(crmDispatch)
      .where(and(eq(crmDispatch.id, id), active(crmDispatch)))
      .limit(1)
    if (!d) return null
    const [customer] = await drizzleDb
      .select()
      .from(crmCustomer)
      .where(eq(crmCustomer.id, d.customerId))
      .limit(1)
    const [hospital] = await drizzleDb
      .select()
      .from(crmHospital)
      .where(eq(crmHospital.id, d.hospitalId))
      .limit(1)
    const [status] = await drizzleDb
      .select()
      .from(crmDispatchStatus)
      .where(eq(crmDispatchStatus.id, d.statusId))
      .limit(1)
    const replies = await drizzleDb
      .select({
        id: crmDispatchReply.id,
        dispatchId: crmDispatchReply.dispatchId,
        userId: crmDispatchReply.userId,
        content: crmDispatchReply.content,
        createdAt: crmDispatchReply.createdAt,
        user: {
          id: sysUser.id,
          username: sysUser.username,
          realName: sysUser.realName,
        },
      })
      .from(crmDispatchReply)
      .leftJoin(sysUser, eq(sysUser.id, crmDispatchReply.userId))
      .where(eq(crmDispatchReply.dispatchId, id))
      .orderBy(asc(crmDispatchReply.createdAt))
    const logs = await drizzleDb
      .select()
      .from(crmDispatchFollowLog)
      .where(eq(crmDispatchFollowLog.dispatchId, id))
      .orderBy(asc(crmDispatchFollowLog.createdAt))
    // 一个医院只有一个登录账号，因此可用回复人和该医院账号的关系确定气泡方向。
    // 将这一语义由接口明确返回，前端无需猜测当前登录用户或角色。
    const repliesWithAuthorType = replies.map((reply) => ({
      ...reply,
      authorType:
        reply.userId === hospital?.accountUserId ? 'hospital' : 'service',
    }))
    return { ...d, customer: customer ?? null, hospital: hospital ?? null, status: status ?? null, replies: repliesWithAuthorType, logs }
  }

  static listStatuses() {
    return drizzleDb
      .select()
      .from(crmDispatchStatus)
      .where(eq(crmDispatchStatus.status, 1))
      .orderBy(asc(crmDispatchStatus.sortOrder))
  }

  static async update(id: number, input: any) {
    await drizzleDb.update(crmDispatch).set(input).where(eq(crmDispatch.id, id))
    return this.findById(id)
  }

  static async reply(id: number, input: any, userId: number, content?: string) {
    return drizzleDb.transaction(async (tx) => {
      if (Object.keys(input).length)
        await tx.update(crmDispatch).set(input).where(eq(crmDispatch.id, id))
      if (content)
        return tx.insert(crmDispatchReply).values({ dispatchId: id, userId, content })
      const [row] = await tx.select().from(crmDispatch).where(eq(crmDispatch.id, id)).limit(1)
      return row
    })
  }

  static addLog(id: number, userId: number, content: string) {
    return drizzleDb.insert(crmDispatchFollowLog).values({ dispatchId: id, userId, content })
  }

  // ── 客户手机号查看日志 ──

  /**
   * 记录一次"医院账号查看派单客户手机号明文"的事件。
   * viewer_user_id / viewer_username / viewer_hospital_name 直接冗余写入，
   * 避免后续审计时还要 join sys_user / crm_hospital。
   */
  static recordMobileView(input: {
    dispatchId: number
    viewerUserId: number
    viewerUsername: string
    viewerHospitalName?: string | null
    ipAddress?: string | null
  }) {
    return drizzleDb.insert(crmDispatchMobileViewLog).values({
      dispatchId: input.dispatchId,
      viewerUserId: input.viewerUserId,
      viewerUsername: input.viewerUsername,
      viewerHospitalName: input.viewerHospitalName ?? null,
      ipAddress: input.ipAddress ?? null,
    })
  }

  /** 列出一个派单的全部手机号查看记录（super_admin 在派单详情查看）。 */
  static listMobileViews(dispatchId: number) {
    return drizzleDb
      .select()
      .from(crmDispatchMobileViewLog)
      .where(eq(crmDispatchMobileViewLog.dispatchId, dispatchId))
      .orderBy(desc(crmDispatchMobileViewLog.createdAt))
  }

  // ── 派单「医院查看」留痕 ──

  static recordView(input: {
    dispatchId: number
    hospitalId: number
    viewerUserId: number
    viewerUsername: string
    viewerHospitalName?: string | null
    ipAddress?: string | null
  }) {
    return drizzleDb
      .insert(crmDispatchViewLog)
      .values({
        dispatchId: input.dispatchId,
        hospitalId: input.hospitalId,
        viewerUserId: input.viewerUserId,
        viewerUsername: input.viewerUsername,
        viewerHospitalName: input.viewerHospitalName ?? null,
        ipAddress: input.ipAddress ?? null,
      })
      .onDuplicateKeyUpdate({
        // 不更新任何字段；保留首次查看时间。
        set: { viewerUsername: input.viewerUsername },
      })
  }

  static listViewLogs(dispatchId: number) {
    return drizzleDb
      .select()
      .from(crmDispatchViewLog)
      .where(eq(crmDispatchViewLog.dispatchId, dispatchId))
      .orderBy(desc(crmDispatchViewLog.createdAt))
  }

  static listViewLogsByDispatchAndHospital(dispatchId: number, hospitalId: number) {
    return drizzleDb
      .select()
      .from(crmDispatchViewLog)
      .where(
        and(
          eq(crmDispatchViewLog.dispatchId, dispatchId),
          eq(crmDispatchViewLog.hospitalId, hospitalId),
        ),
      )
      .orderBy(asc(crmDispatchViewLog.createdAt))
  }

  static async exportAll(q: any) {
    const listResult = await this.list(q)
    return listResult.list.map((d: any) => ({
      id: d.id,
      customerName: d.customer?.name ?? '',
      customerMobile: d.customer?.mobile ?? '',
      hospitalName: d.hospital?.hospitalName ?? '',
      statusName: d.status?.name ?? '',
      receiveQq: d.receiveQq ?? '',
      receiveWechat: d.receiveWechat ?? '',
      createdAt: d.createdAt,
      finishedAt: d.finishedAt ?? '',
    }))
  }
}
export { active }
