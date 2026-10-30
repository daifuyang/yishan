import { and, count, desc, eq, gte, lte, like, inArray, isNull, isNotNull, or, notExists } from 'drizzle-orm'
import { drizzleDb, type AppQueryDb } from '@yishan/core-system-api/database'
import { sysUser } from '@yishan/core-system-api/schema'
import {
  crmMemberBrowse, crmMemberCustomer, crmMemberRemark,
  crmMemberTag, crmMemberTagRelation, crmFollowUpRecord,
  crmMemberAssignmentHistory, crmCustomer,
} from '../db/schema.js'
import { todayYmd, formatBusinessNumber } from './_number-id.js'

const active = (t: any) => isNull(t.deletedAt)
const page = (q: any, p: any) => p.pageSize === 0 ? q : q.limit(p.pageSize).offset((p.page - 1) * p.pageSize)

// 关键词精确匹配：手机号 / 会员编号 / 姓名 任一字段完全相等
// 不再使用 LIKE 模糊搜索，避免输入"138"命中所有含 138 的手机号
const buildKeywordExactMatch = (keyword: string) =>
  or(
    eq(crmMemberCustomer.mobile, keyword),
    eq(crmMemberCustomer.numberId, keyword),
    eq(crmMemberCustomer.name, keyword),
  )!

export class MembersRepository {

  // ── 列表 ──

  static async list(q: any) {
    const c: any[] = [active(crmMemberCustomer)]

    // 会员状态过滤
    if (q.memberStatus) {
      c.push(eq(crmMemberCustomer.memberStatus, q.memberStatus))
    } else {
      // 默认只看 active
      c.push(eq(crmMemberCustomer.memberStatus, 'active'))
    }

    // 数据权限 / 归属客服
    if (q.ownerUserId) c.push(eq(crmMemberCustomer.ownerUserId, q.ownerUserId))

    // 阶段
    if (q.stage) c.push(eq(crmMemberCustomer.memberStage, q.stage))

    // 业务类别
    if (q.businessCategory) c.push(eq(crmMemberCustomer.businessCategory, q.businessCategory))

    // 意向等级
    if (q.intentionLevel) c.push(eq(crmMemberCustomer.intentionLevel, q.intentionLevel))

    // 下次跟进时间范围
    if (q.nextFollowUpStart) c.push(gte(crmMemberCustomer.nextFollowUpAt, new Date(q.nextFollowUpStart)))
    if (q.nextFollowUpEnd) c.push(lte(crmMemberCustomer.nextFollowUpAt, new Date(q.nextFollowUpEnd)))

    // 创建时间范围
    if (q.createdStart) c.push(gte(crmMemberCustomer.createdAt, new Date(q.createdStart)))
    if (q.createdEnd) c.push(lte(crmMemberCustomer.createdAt, new Date(q.createdEnd)))

    // 是否逾期（下次跟进时间已过且未完成）
    if (q.isOverdue === 1) {
      c.push(isNotNull(crmMemberCustomer.nextFollowUpAt))
      c.push(lte(crmMemberCustomer.nextFollowUpAt, new Date()))
    }

    // 关键词搜索（精确匹配：手机号 / 会员编号 / 姓名 必须完全相等）
    if (q.keyword) {
      const kw = String(q.keyword).trim()
      if (kw) c.push(buildKeywordExactMatch(kw))
    }

    const where = and(...c)

    const [items, totals] = await Promise.all([
      page(
        drizzleDb.select()
          .from(crmMemberCustomer)
          .where(where)
          .orderBy(desc(crmMemberCustomer.createdAt)),
        q,
      ),
      drizzleDb.select({ total: count() }).from(crmMemberCustomer).where(where),
    ])

    // 批量加载每个会员的 owner 信息
    const ownerIds: number[] = items.map((i: any) => i.ownerUserId).filter(Boolean)
    const owners = ownerIds.length
      ? await drizzleDb.select({ id: sysUser.id, username: sysUser.username, realName: sysUser.realName })
          .from(sysUser).where(inArray(sysUser.id, ownerIds))
      : []
    const ownerMap = new Map(owners.map((o: any) => [o.id, o]))

    return {
      list: items.map((i: any) => ({
        ...i,
        owner: ownerMap.get(i.ownerUserId) ?? null,
      })),
      total: Number(totals[0]?.total ?? 0),
    }
  }

  // ── 概览统计 ──

  static async overview(dates: {
    todayStart: Date;
    todayEnd: Date;
    monthStart: Date;
    monthEnd: Date;
    now: Date;
    ownerUserId?: number;
  }) {
    const c: any[] = [active(crmMemberCustomer), eq(crmMemberCustomer.memberStatus, 'active')]
    if (dates.ownerUserId) c.push(eq(crmMemberCustomer.ownerUserId, dates.ownerUserId))
    const baseWhere = and(...c)

    const [total, todayNew, pendingCount, monthDispatched, monthConverted] = await Promise.all([
      // total active members
      drizzleDb.select({ v: count() }).from(crmMemberCustomer).where(baseWhere).then(r => Number(r[0]?.v ?? 0)),
      // today new
      drizzleDb.select({ v: count() }).from(crmMemberCustomer)
        .where(and(baseWhere, gte(crmMemberCustomer.createdAt, dates.todayStart), lte(crmMemberCustomer.createdAt, dates.todayEnd)))
        .then(r => Number(r[0]?.v ?? 0)),
      // pending follow-up (has nextFollowUpAt set)
      drizzleDb.select({ v: count() }).from(crmMemberCustomer)
        .where(and(baseWhere, isNotNull(crmMemberCustomer.nextFollowUpAt)))
        .then(r => Number(r[0]?.v ?? 0)),
      // month dispatched (stage === 'dispatched')
      drizzleDb.select({ v: count() }).from(crmMemberCustomer)
        .where(and(baseWhere, eq(crmMemberCustomer.memberStage, 'dispatched'), gte(crmMemberCustomer.updatedAt, dates.monthStart), lte(crmMemberCustomer.updatedAt, dates.monthEnd)))
        .then(r => Number(r[0]?.v ?? 0)),
      // month converted (stage === 'converted')
      drizzleDb.select({ v: count() }).from(crmMemberCustomer)
        .where(and(baseWhere, eq(crmMemberCustomer.memberStage, 'converted'), gte(crmMemberCustomer.updatedAt, dates.monthStart), lte(crmMemberCustomer.updatedAt, dates.monthEnd)))
        .then(r => Number(r[0]?.v ?? 0)),
    ])

    // overdue: pending where nextFollowUpAt < now
    const overdueWhere = and(baseWhere, isNotNull(crmMemberCustomer.nextFollowUpAt), lte(crmMemberCustomer.nextFollowUpAt, dates.now))
    const [overdueFollowUp] = await drizzleDb.select({ v: count() }).from(crmMemberCustomer).where(overdueWhere)
    const overdue = Number(overdueFollowUp?.v ?? 0)

    return {
      total,
      todayNew,
      pendingFollowUp: pendingCount,
      overdueFollowUp: overdue,
      monthDispatched,
      monthConverted,
      monthConversionRate: monthDispatched > 0 ? Number((monthConverted / monthDispatched * 100).toFixed(1)) : null,
    }
  }

  // ── 详情 ──

  static async findById(id: number, opts?: { includeTags?: boolean; includeFollowUps?: boolean; includeDispatches?: boolean; includeAssignmentHistory?: boolean }) {
    const [row] = await drizzleDb.select()
      .from(crmMemberCustomer)
      .where(and(eq(crmMemberCustomer.id, id), active(crmMemberCustomer)))
      .limit(1)
    if (!row) return null

    // Load owner info
    const [owner] = await drizzleDb.select({ id: sysUser.id, username: sysUser.username, realName: sysUser.realName })
      .from(sysUser).where(eq(sysUser.id, row.ownerUserId)).limit(1)

    const result: any = { ...row, owner: owner ?? null, tags: [], followUps: [], dispatches: [], assignmentHistory: [] }

    // Tags
    if (opts?.includeTags) {
      const tagRels = await drizzleDb.select()
        .from(crmMemberTagRelation)
        .innerJoin(crmMemberTag, eq(crmMemberTagRelation.tagId, crmMemberTag.id))
        .where(and(
          eq(crmMemberTagRelation.memberId, id),
          isNull(crmMemberTag.deletedAt),
        ))
      result.tags = tagRels.map((r: any) => ({
        id: r.crm_member_tag.id,
        name: r.crm_member_tag.name,
        color: r.crm_member_tag.color,
      }))
    }

    // Follow-ups
    if (opts?.includeFollowUps) {
      const records = await drizzleDb.select()
        .from(crmFollowUpRecord)
        .where(eq(crmFollowUpRecord.memberId, id))
        .orderBy(desc(crmFollowUpRecord.createdAt))

      const opIds: number[] = records.map((r: any) => r.operatorUserId).filter(Boolean)
      const operators = opIds.length
        ? await drizzleDb.select({ id: sysUser.id, username: sysUser.username, realName: sysUser.realName })
            .from(sysUser).where(inArray(sysUser.id, opIds))
        : []
      const opMap = new Map(operators.map((o: any) => [o.id, o]))

      result.followUps = records.map((r: any) => ({
        ...r,
        operator: opMap.get(r.operatorUserId) ?? null,
      }))
    }

    // Assignment history
    if (opts?.includeAssignmentHistory) {
      const history = await drizzleDb.select()
        .from(crmMemberAssignmentHistory)
        .where(eq(crmMemberAssignmentHistory.memberId, id))
        .orderBy(desc(crmMemberAssignmentHistory.createdAt))

      const userIds: number[] = history.flatMap((h: any) => [h.fromUserId, h.toUserId, h.operatorUserId]).filter(Boolean)
      const users = userIds.length
        ? await drizzleDb.select({ id: sysUser.id, username: sysUser.username, realName: sysUser.realName })
            .from(sysUser).where(inArray(sysUser.id, userIds))
        : []
      const userMap = new Map(users.map((u: any) => [u.id, u]))

      result.assignmentHistory = history.map((h: any) => ({
        ...h,
        fromUser: h.fromUserId ? (userMap.get(h.fromUserId) ?? null) : null,
        toUser: userMap.get(h.toUserId) ?? null,
        operator: userMap.get(h.operatorUserId) ?? null,
      }))
    }

    return result
  }

  // ── 创建 / 更新 ──

  static async create(input: any, db: AppQueryDb = drizzleDb) {
    const r = await db.insert(crmMemberCustomer).values(input)
    return this.findById(Number(r[0].insertId), { includeTags: true })
  }

  static async update(id: number, input: any, db: AppQueryDb = drizzleDb) {
    await db.update(crmMemberCustomer).set(input).where(eq(crmMemberCustomer.id, id))
    return this.findById(id, { includeTags: true })
  }

  // ── 会员编号生成 ──

  // 会员编号生成（CUS + YYYYMMDD + 6 位 base36 随机，与客户共用命名空间）：
  // - 业务约定：历史 2 行 VIP 测试数据不动。
  // - 17 字符，daily unique 靠 UNIQUE 索引 + service 层 1062 重试兜底。
  // 纯函数同步返回——没有 SQL 不需要 async。
  static nextNumber(): string {
    return formatBusinessNumber(todayYmd())
  }

  // ── 通过手机号查会员 ──

  static async findByMobile(mobile: string) {
    const [r] = await drizzleDb.select()
      .from(crmMemberCustomer)
      .where(and(eq(crmMemberCustomer.mobile, mobile), active(crmMemberCustomer), eq(crmMemberCustomer.memberStatus, 'active')))
      .limit(1)
    if (!r) return null
    return this.findById(r.id, { includeTags: true })
  }

  // ── 通过 customerId 查会员 ──

  static async findByCustomerId(customerId: number) {
    const [r] = await drizzleDb.select()
      .from(crmMemberCustomer)
      .where(and(eq(crmMemberCustomer.customerId, customerId), active(crmMemberCustomer)))
      .limit(1)
    if (!r) return null
    return this.findById(r.id, { includeTags: true })
  }

  // ── 标签管理 ──

  static async listTags() {
    return drizzleDb.select()
      .from(crmMemberTag)
      .where(and(eq(crmMemberTag.status, 1), isNull(crmMemberTag.deletedAt)))
      .orderBy(desc(crmMemberTag.createdAt))
  }

  static async createTag(input: any) {
    const [existing] = await drizzleDb.select()
      .from(crmMemberTag)
      .where(eq(crmMemberTag.name, input.name))
      .limit(1)
    if (existing) {
      if (existing.deletedAt) {
        // Restore soft-deleted tag
        await drizzleDb.update(crmMemberTag)
          .set({ deletedAt: null, color: input.color ?? existing.color, status: 1 })
          .where(eq(crmMemberTag.id, existing.id))
        return drizzleDb.select().from(crmMemberTag).where(eq(crmMemberTag.id, existing.id)).limit(1).then(rows => rows[0])
      }
      return existing // Already exists
    }
    const r = await drizzleDb.insert(crmMemberTag).values(input)
    const [tag] = await drizzleDb.select().from(crmMemberTag).where(eq(crmMemberTag.id, Number(r[0].insertId))).limit(1)
    return tag
  }

  static async deleteTag(tagId: number) {
    await drizzleDb.update(crmMemberTag).set({ deletedAt: new Date() }).where(eq(crmMemberTag.id, tagId))
    // Also remove relations
    await drizzleDb.delete(crmMemberTagRelation).where(eq(crmMemberTagRelation.tagId, tagId))
  }

  // ── 会员标签关系 ──

  static async setMemberTags(memberId: number, tagIds: number[]) {
    // Remove existing
    await drizzleDb.delete(crmMemberTagRelation)
      .where(eq(crmMemberTagRelation.memberId, memberId))

    // Insert new (deduped)
    const uniqueIds = [...new Set(tagIds)]
    if (uniqueIds.length) {
      await drizzleDb.insert(crmMemberTagRelation)
        .values(uniqueIds.map(tagId => ({ memberId, tagId })))
    }
  }

  static async getMemberTagIds(memberId: number): Promise<number[]> {
    const rows = await drizzleDb.select()
      .from(crmMemberTagRelation)
      .where(eq(crmMemberTagRelation.memberId, memberId))
    return rows.map((r: any) => r.tagId)
  }

  static async batchSetMemberTags(memberIds: number[], tagIds: number[]) {
    const uniqueTagIds = [...new Set(tagIds)]
    // Get existing relations for these members
    const existing = await drizzleDb.select()
      .from(crmMemberTagRelation)
      .where(inArray(crmMemberTagRelation.memberId, memberIds))

    const existingMap = new Map<number, Set<number>>()
    for (const r of existing) {
      if (!existingMap.has(r.memberId)) existingMap.set(r.memberId, new Set())
      existingMap.get(r.memberId)!.add(r.tagId)
    }

    // For each member, insert only missing tags
    for (const memberId of memberIds) {
      const existingTags = existingMap.get(memberId) ?? new Set()
      const toAdd = uniqueTagIds.filter(tid => !existingTags.has(tid))
      if (toAdd.length) {
        await drizzleDb.insert(crmMemberTagRelation)
          .values(toAdd.map(tagId => ({ memberId, tagId })))
          .onDuplicateKeyUpdate({ set: { memberId } })
      }
    }
  }

  // ── 跟进记录 ──

  static async createFollowUp(input: any) {
    const r = await drizzleDb.insert(crmFollowUpRecord).values(input)
    const [record] = await drizzleDb.select().from(crmFollowUpRecord)
      .where(eq(crmFollowUpRecord.id, Number(r[0].insertId))).limit(1)
    return record
  }

  static async listFollowUps(memberId: number) {
    const records = await drizzleDb.select()
      .from(crmFollowUpRecord)
      .where(eq(crmFollowUpRecord.memberId, memberId))
      .orderBy(desc(crmFollowUpRecord.createdAt))

    const opIds = [...new Set(records.map((r: any) => r.operatorUserId).filter(Boolean))]
    const operators = opIds.length
      ? await drizzleDb.select({ id: sysUser.id, username: sysUser.username, realName: sysUser.realName })
          .from(sysUser).where(inArray(sysUser.id, opIds))
      : []
    const opMap = new Map(operators.map((o: any) => [o.id, o]))

    return records.map((r: any) => ({
      ...r,
      operator: opMap.get(r.operatorUserId) ?? null,
    }))
  }

  // ── 转交历史 ──

  static async createAssignmentRecord(input: any) {
    const r = await drizzleDb.insert(crmMemberAssignmentHistory).values(input)
    return Number(r[0].insertId)
  }

  // ── 备注 ──

  static addRemark(memberId: number, userId: number, content: string) {
    return drizzleDb.insert(crmMemberRemark).values({ memberId, userId, content })
  }

  // ── 浏览记录 ──

  static recordBrowse(memberId: number, userId: number) {
    return drizzleDb.insert(crmMemberBrowse).values({ memberId, userId, action: 'view' })
  }

  // ── 可选择的客户（未被转会员且活跃的客户） ──

  static async listSelectableCustomers(q: any) {
    const c: any[] = [isNull(crmCustomer.deletedAt)]

    // 数据权限：service 层已按 scope 解析出 ownerUserId，这里只负责落 SQL。
    // 之前这里漏了 owner 过滤，customer_service 会看到所有客服的客户。
    if (q.ownerUserId) c.push(eq(crmCustomer.ownerUserId, q.ownerUserId))

    // A.1: 优先按 mobile / name 精确/前缀匹配，再回退 keyword 模糊
    if (q.mobile && /^1[3-9]\d{9}$/.test(String(q.mobile))) {
      c.push(eq(crmCustomer.mobile, String(q.mobile)))
    } else if (q.name && typeof q.name === 'string') {
      c.push(like(crmCustomer.name, `${q.name}%`))
    } else if (q.keyword) {
      c.push(or(
        like(crmCustomer.name, `%${q.keyword}%`),
        like(crmCustomer.mobile, `%${q.keyword}%`),
        like(crmCustomer.numberId, `%${q.keyword}%`),
      )!)
    }

    // 排除已有活跃会员记录的客户。
    // 用关联子查询 + NOT EXISTS 而非 NOT IN：NOT IN 的子查询只要含一个 NULL
    // customer_id（直接新增的会员允许不关联客户），整个谓词就退化为 UNKNOWN，
    // 查询恒返回 0 行。NOT EXISTS 对 NULL 天然安全，且直接表达「该客户存在
    // 活跃会员」这一意图。
    const hasActiveMember = drizzleDb.select({ id: crmMemberCustomer.id })
      .from(crmMemberCustomer)
      .where(and(
        isNull(crmMemberCustomer.deletedAt),
        eq(crmMemberCustomer.memberStatus, 'active'),
        eq(crmMemberCustomer.customerId, crmCustomer.id), // 关联外查询的客户 id
      ))
    c.push(notExists(hasActiveMember))

    const where = and(...c)
    const [items, totals] = await Promise.all([
      page(
        drizzleDb.select()
          .from(crmCustomer)
          .where(where)
          .orderBy(desc(crmCustomer.createdAt)),
        q,
      ),
      drizzleDb.select({ total: count() }).from(crmCustomer).where(where),
    ])

    // Load owner info
    const ownerIds: number[] = items.map((i: any) => i.ownerUserId).filter(Boolean)
    const owners = ownerIds.length
      ? await drizzleDb.select({ id: sysUser.id, username: sysUser.username, realName: sysUser.realName })
          .from(sysUser).where(inArray(sysUser.id, ownerIds))
      : []
    const ownerMap = new Map(owners.map((o: any) => [o.id, o]))

    return {
      list: items.map((i: any) => ({
        ...i,
        owner: ownerMap.get(i.ownerUserId) ?? null,
      })),
      total: Number(totals[0]?.total ?? 0),
    }
  }
}
