/** CRM persistence boundary.  Keep SQL/Drizzle details out of the service layer. */
import { and, asc, count, desc, eq, gte, inArray, isNull, like, lte, ne, or, sql } from 'drizzle-orm'
import { drizzleDb, type AppQueryDb } from '@/db'
import {
  iximeiCrmCustomer, iximeiCrmCustomerStatus, iximeiCrmDispatch, iximeiCrmDispatchFollowLog,
  iximeiCrmDispatchReply, iximeiCrmDispatchStatus, iximeiCrmHospital, iximeiCrmHospitalAccount,
  iximeiCrmMemberBrowse, iximeiCrmMemberCustomer, iximeiCrmMemberRemark, sysRegion, sysUser,
} from '@/db/schema'

type Paging = { page: number; pageSize: number }
type DateFilter = { startTime?: string; endTime?: string }
const active = (table: { deletedAt: any }) => isNull(table.deletedAt)
const pageQuery = (query: any, paging: Paging) => paging.pageSize === 0 ? query : query.limit(paging.pageSize).offset((paging.page - 1) * paging.pageSize)

export class CrmRepository {
  static async listHospitals(query: { keyword?: string; status?: string } & Paging) {
    const conditions = [active(iximeiCrmHospital)]
    if (query.status !== undefined) conditions.push(eq(iximeiCrmHospital.status, Number(query.status)))
    if (query.keyword) conditions.push(or(like(iximeiCrmHospital.hospitalName, `%${query.keyword}%`), like(iximeiCrmHospital.hospitalPhone, `%${query.keyword}%`), like(iximeiCrmHospital.hospitalSelling, `%${query.keyword}%`))!)
    const where = and(...conditions)
    const [list, rows] = await Promise.all([
      pageQuery(drizzleDb.select().from(iximeiCrmHospital).where(where).orderBy(desc(iximeiCrmHospital.createdAt)), query),
      drizzleDb.select({ total: count() }).from(iximeiCrmHospital).where(where),
    ])
    return { list: await Promise.all(list.map((item) => this.hospitalDetail(item))), total: Number(rows[0]?.total ?? 0) }
  }

  static async findHospital(id: number) {
    const [row] = await drizzleDb.select().from(iximeiCrmHospital).where(and(eq(iximeiCrmHospital.id, id), active(iximeiCrmHospital))).limit(1)
    return row ? this.hospitalDetail(row) : null
  }

  private static async hospitalDetail(hospital: typeof iximeiCrmHospital.$inferSelect) {
    const [account, accounts] = await Promise.all([
      hospital.accountUserId ? drizzleDb.select({ id: sysUser.id, username: sysUser.username, email: sysUser.email, status: sysUser.status }).from(sysUser).where(eq(sysUser.id, hospital.accountUserId)).limit(1) : [],
      drizzleDb.select({ id: iximeiCrmHospitalAccount.id, role: iximeiCrmHospitalAccount.role }).from(iximeiCrmHospitalAccount).where(and(eq(iximeiCrmHospitalAccount.hospitalId, hospital.id), active(iximeiCrmHospitalAccount))),
    ])
    return { ...hospital, account: account[0] ?? null, accounts, accountCount: accounts.length }
  }

  static async createHospital(input: typeof iximeiCrmHospital.$inferInsert, db: AppQueryDb = drizzleDb) {
    const result = await db.insert(iximeiCrmHospital).values(input)
    return this.findHospital(Number(result[0].insertId))
  }
  static async updateHospital(id: number, input: Partial<typeof iximeiCrmHospital.$inferInsert>, db: AppQueryDb = drizzleDb) {
    await db.update(iximeiCrmHospital).set({ ...input, version: sql`${iximeiCrmHospital.version} + 1` }).where(eq(iximeiCrmHospital.id, id))
    return this.findHospital(id)
  }

  static async ensureDefaultStatuses(db: AppQueryDb = drizzleDb) {
    for (const [id, name] of [[1, '资料录入'], [2, '待跟进'], [3, '重单'], [4, '已手术'], [5, '无效用户']] as const) {
      await db.insert(iximeiCrmCustomerStatus).values({ id, name, sortOrder: id, status: 1 }).onDuplicateKeyUpdate({ set: { name, sortOrder: id, status: 1 } })
    }
    for (const [id, name] of [[1, '待回复'], [2, '已联系'], [3, '已到院'], [4, '已成交'], [5, '未成交'], [6, '重单']] as const) {
      await db.insert(iximeiCrmDispatchStatus).values({ id, name, sortOrder: id }).onDuplicateKeyUpdate({ set: { id } })
    }
  }
  static listCustomerStatuses() { return drizzleDb.select().from(iximeiCrmCustomerStatus).where(eq(iximeiCrmCustomerStatus.status, 1)).orderBy(asc(iximeiCrmCustomerStatus.sortOrder)) }
  static listDispatchStatuses() { return drizzleDb.select().from(iximeiCrmDispatchStatus).where(eq(iximeiCrmDispatchStatus.status, 1)).orderBy(asc(iximeiCrmDispatchStatus.sortOrder)) }

  static async listCustomers(query: { keyword?: string; statusId?: number; ownerUserId?: number } & DateFilter & Paging) {
    const conditions = [active(iximeiCrmCustomer)]
    if (query.ownerUserId) conditions.push(eq(iximeiCrmCustomer.ownerUserId, query.ownerUserId))
    if (query.statusId) conditions.push(eq(iximeiCrmCustomer.statusId, Number(query.statusId)))
    if (query.startTime) conditions.push(gte(iximeiCrmCustomer.createdAt, new Date(query.startTime)))
    if (query.endTime) conditions.push(lte(iximeiCrmCustomer.createdAt, new Date(query.endTime)))
    if (query.keyword) conditions.push(or(like(iximeiCrmCustomer.mobile, `%${query.keyword}%`), like(iximeiCrmCustomer.name, `%${query.keyword}%`), like(iximeiCrmCustomer.numberId, `%${query.keyword}%`))!)
    const where = and(...conditions)
    const [list, rows] = await Promise.all([pageQuery(drizzleDb.select().from(iximeiCrmCustomer).where(where).orderBy(desc(iximeiCrmCustomer.createdAt)), query), drizzleDb.select({ total: count() }).from(iximeiCrmCustomer).where(where)])
    return { list: await Promise.all(list.map((row) => this.customerDetail(row))), total: Number(rows[0]?.total ?? 0) }
  }
  static async findCustomer(id: number, includeDispatches = false) {
    const [row] = await drizzleDb.select().from(iximeiCrmCustomer).where(and(eq(iximeiCrmCustomer.id, id), active(iximeiCrmCustomer))).limit(1)
    return row ? this.customerDetail(row, includeDispatches) : null
  }
  private static async customerDetail(customer: typeof iximeiCrmCustomer.$inferSelect, includeDispatches = false) {
    const [status, owner] = await Promise.all([
      drizzleDb.select().from(iximeiCrmCustomerStatus).where(eq(iximeiCrmCustomerStatus.id, customer.statusId)).limit(1),
      drizzleDb.select({ id: sysUser.id, username: sysUser.username, realName: sysUser.realName }).from(sysUser).where(eq(sysUser.id, customer.ownerUserId)).limit(1),
    ])
    const dispatches = includeDispatches ? await this.dispatchesForCustomer(customer.id) : undefined
    return { ...customer, status: status[0] ?? null, owner: owner[0] ?? null, ...(includeDispatches ? { dispatches } : {}) }
  }
  static async createCustomer(input: typeof iximeiCrmCustomer.$inferInsert, db: AppQueryDb = drizzleDb) { const r = await db.insert(iximeiCrmCustomer).values(input); return this.findCustomer(Number(r[0].insertId)) }
  static async updateCustomer(id: number, input: Partial<typeof iximeiCrmCustomer.$inferInsert>, db: AppQueryDb = drizzleDb) { await db.update(iximeiCrmCustomer).set({ ...input, version: sql`${iximeiCrmCustomer.version} + 1` }).where(eq(iximeiCrmCustomer.id, id)); return this.findCustomer(id) }
  static async nextCustomerNumber(db: AppQueryDb = drizzleDb) { const [row] = await db.select({ id: iximeiCrmCustomer.id }).from(iximeiCrmCustomer).orderBy(desc(iximeiCrmCustomer.id)).limit(1); return `VIP${String((row?.id ?? 0) + 1).padStart(12, '0')}` }

  static async dispatchCustomer(customerId: number, hospitalIds: number[], statusId: number, actorId: number, replyContent: string) {
    const dispatchIds = await drizzleDb.transaction(async (tx) => {
      const ids: number[] = []
      for (const hospitalId of hospitalIds) {
        const result = await tx.insert(iximeiCrmDispatch).values({ customerId, hospitalId, statusId, finishedAt: new Date(), creatorId: actorId, updaterId: actorId })
        const dispatchId = Number(result[0].insertId)
        await tx.insert(iximeiCrmDispatchReply).values({ dispatchId, userId: actorId, content: replyContent })
        ids.push(dispatchId)
      }
      await tx.update(iximeiCrmCustomer).set({ statusId: 2, updaterId: actorId }).where(eq(iximeiCrmCustomer.id, customerId))
      return ids
    })
    return Promise.all(dispatchIds.map((dispatchId) => this.findDispatch(dispatchId)))
  }

  static async listMembers(query: { keyword?: string; ownerUserId?: number } & Paging) {
    const conditions = [active(iximeiCrmMemberCustomer)]
    if (query.ownerUserId) conditions.push(eq(iximeiCrmMemberCustomer.ownerUserId, query.ownerUserId))
    if (query.keyword) conditions.push(or(like(iximeiCrmMemberCustomer.mobile, `%${query.keyword}%`), like(iximeiCrmMemberCustomer.name, `%${query.keyword}%`), like(iximeiCrmMemberCustomer.numberId, `%${query.keyword}%`))!)
    const where = and(...conditions)
    const [list, rows] = await Promise.all([pageQuery(drizzleDb.select().from(iximeiCrmMemberCustomer).where(where).orderBy(desc(iximeiCrmMemberCustomer.createdAt)), query), drizzleDb.select({ total: count() }).from(iximeiCrmMemberCustomer).where(where)])
    return { list: await Promise.all(list.map((row) => this.memberDetail(row))), total: Number(rows[0]?.total ?? 0) }
  }
  static async findMember(id: number) { const [row] = await drizzleDb.select().from(iximeiCrmMemberCustomer).where(and(eq(iximeiCrmMemberCustomer.id, id), active(iximeiCrmMemberCustomer))).limit(1); return row ? this.memberDetail(row, true) : null }
  private static async memberDetail(member: typeof iximeiCrmMemberCustomer.$inferSelect, all = false) {
    const [owner, remarkRows, browseRows, remarksCount, browsesCount] = await Promise.all([
      drizzleDb.select({ id: sysUser.id, username: sysUser.username, realName: sysUser.realName }).from(sysUser).where(eq(sysUser.id, member.ownerUserId)).limit(1),
      all ? drizzleDb.select().from(iximeiCrmMemberRemark).where(eq(iximeiCrmMemberRemark.memberId, member.id)).orderBy(desc(iximeiCrmMemberRemark.createdAt)) : [],
      all ? drizzleDb.select().from(iximeiCrmMemberBrowse).where(eq(iximeiCrmMemberBrowse.memberId, member.id)).orderBy(desc(iximeiCrmMemberBrowse.createdAt)).limit(1) : [],
      drizzleDb.select({ total: count() }).from(iximeiCrmMemberRemark).where(eq(iximeiCrmMemberRemark.memberId, member.id)), drizzleDb.select({ total: count() }).from(iximeiCrmMemberBrowse).where(eq(iximeiCrmMemberBrowse.memberId, member.id)),
    ])
    return { ...member, owner: owner[0] ?? null, ...(all ? { remarks: remarkRows, browses: browseRows } : {}), _count: { remarks: Number(remarksCount[0]?.total ?? 0), browses: Number(browsesCount[0]?.total ?? 0) } }
  }
  static async createMember(input: typeof iximeiCrmMemberCustomer.$inferInsert, db: AppQueryDb = drizzleDb) { const r = await db.insert(iximeiCrmMemberCustomer).values(input); return this.findMember(Number(r[0].insertId)) }
  static async updateMember(id: number, input: Partial<typeof iximeiCrmMemberCustomer.$inferInsert>, db: AppQueryDb = drizzleDb) { await db.update(iximeiCrmMemberCustomer).set({ ...input, version: sql`${iximeiCrmMemberCustomer.version} + 1` }).where(eq(iximeiCrmMemberCustomer.id, id)); return this.findMember(id) }
  static async nextMemberNumber(db: AppQueryDb = drizzleDb) { const [row] = await db.select({ id: iximeiCrmMemberCustomer.id }).from(iximeiCrmMemberCustomer).orderBy(desc(iximeiCrmMemberCustomer.id)).limit(1); return `VIP${String((row?.id ?? 0) + 1).padStart(12, '0')}` }
  static addMemberRemark(memberId: number, userId: number, content: string) { return drizzleDb.insert(iximeiCrmMemberRemark).values({ memberId, userId, content }) }
  static recordMemberBrowse(memberId: number, userId: number) { return drizzleDb.insert(iximeiCrmMemberBrowse).values({ memberId, userId, action: 'view' }) }

  static async listDispatches(query: { keyword?: string; statusId?: number; hospitalIds?: number[] } & DateFilter & Paging) {
    const conditions = [active(iximeiCrmDispatch)]
    if (query.statusId) conditions.push(eq(iximeiCrmDispatch.statusId, query.statusId))
    if (query.hospitalIds) conditions.push(inArray(iximeiCrmDispatch.hospitalId, query.hospitalIds))
    if (query.startTime) conditions.push(gte(iximeiCrmDispatch.createdAt, new Date(query.startTime)))
    if (query.endTime) conditions.push(lte(iximeiCrmDispatch.createdAt, new Date(query.endTime)))
    if (query.keyword) {
      const matchedCustomers = await drizzleDb.select({ id: iximeiCrmCustomer.id }).from(iximeiCrmCustomer).where(or(like(iximeiCrmCustomer.mobile, `%${query.keyword}%`), like(iximeiCrmCustomer.name, `%${query.keyword}%`), like(iximeiCrmCustomer.numberId, `%${query.keyword}%`)))
      const matchedHospitals = await drizzleDb.select({ id: iximeiCrmHospital.id }).from(iximeiCrmHospital).where(like(iximeiCrmHospital.hospitalName, `%${query.keyword}%`))
      conditions.push(or(inArray(iximeiCrmDispatch.customerId, matchedCustomers.map((x) => x.id).length ? matchedCustomers.map((x) => x.id) : [-1]), inArray(iximeiCrmDispatch.hospitalId, matchedHospitals.map((x) => x.id).length ? matchedHospitals.map((x) => x.id) : [-1]))!)
    }
    const where = and(...conditions)
    const [list, rows] = await Promise.all([pageQuery(drizzleDb.select().from(iximeiCrmDispatch).where(where).orderBy(desc(iximeiCrmDispatch.createdAt)), query), drizzleDb.select({ total: count() }).from(iximeiCrmDispatch).where(where)])
    return { list: await Promise.all(list.map((row) => this.dispatchDetail(row))), total: Number(rows[0]?.total ?? 0) }
  }
  static async findDispatch(id: number) { const [row] = await drizzleDb.select().from(iximeiCrmDispatch).where(and(eq(iximeiCrmDispatch.id, id), active(iximeiCrmDispatch))).limit(1); return row ? this.dispatchDetail(row, true) : null }
  private static async dispatchDetail(dispatch: typeof iximeiCrmDispatch.$inferSelect, all = false) {
    const [customer, hospital, status, replies, logs] = await Promise.all([
      this.findCustomer(dispatch.customerId), this.findHospital(dispatch.hospitalId), drizzleDb.select().from(iximeiCrmDispatchStatus).where(eq(iximeiCrmDispatchStatus.id, dispatch.statusId)).limit(1),
      all ? drizzleDb.select().from(iximeiCrmDispatchReply).where(eq(iximeiCrmDispatchReply.dispatchId, dispatch.id)).orderBy(asc(iximeiCrmDispatchReply.createdAt)) : [], all ? drizzleDb.select().from(iximeiCrmDispatchFollowLog).where(eq(iximeiCrmDispatchFollowLog.dispatchId, dispatch.id)).orderBy(asc(iximeiCrmDispatchFollowLog.createdAt)) : [],
    ])
    const userIds = [...new Set([...replies, ...logs].map((item) => item.userId))]
    const [users, hospitalAccounts] = await Promise.all([
      userIds.length ? drizzleDb.select({ id: sysUser.id, username: sysUser.username, realName: sysUser.realName }).from(sysUser).where(inArray(sysUser.id, userIds)) : [],
      userIds.length ? drizzleDb.select({ userId: iximeiCrmHospitalAccount.userId }).from(iximeiCrmHospitalAccount).where(and(eq(iximeiCrmHospitalAccount.hospitalId, dispatch.hospitalId), inArray(iximeiCrmHospitalAccount.userId, userIds), active(iximeiCrmHospitalAccount))) : [],
    ])
    const usersById = new Map(users.map((user) => [user.id, user] as const))
    const hospitalUserIds = new Set(hospitalAccounts.map((account) => account.userId))
    return {
      ...dispatch,
      customer,
      hospital,
      status: status[0] ?? null,
      ...(all
        ? {
            replies: replies.map((reply) => ({ ...reply, user: usersById.get(reply.userId) ?? null, authorType: hospitalUserIds.has(reply.userId) ? 'hospital' : 'service' })),
            logs: logs.map((log) => ({ ...log, user: usersById.get(log.userId) ?? null })),
          }
        : {}),
    }
  }
  static async dispatchesForCustomer(customerId: number) { const rows = await drizzleDb.select().from(iximeiCrmDispatch).where(eq(iximeiCrmDispatch.customerId, customerId)).orderBy(desc(iximeiCrmDispatch.createdAt)); return Promise.all(rows.map((row) => this.dispatchDetail(row))) }
  static async updateDispatch(id: number, input: Partial<typeof iximeiCrmDispatch.$inferInsert>) { await drizzleDb.update(iximeiCrmDispatch).set({ ...input, version: sql`${iximeiCrmDispatch.version} + 1` }).where(eq(iximeiCrmDispatch.id, id)); return this.findDispatch(id) }
  static async replyDispatch(id: number, input: Partial<typeof iximeiCrmDispatch.$inferInsert>, userId: number, content?: string) { return drizzleDb.transaction(async (tx) => { if (Object.keys(input).length) await tx.update(iximeiCrmDispatch).set(input).where(eq(iximeiCrmDispatch.id, id)); if (content) { const r = await tx.insert(iximeiCrmDispatchReply).values({ dispatchId: id, userId, content }); return r } return this.findDispatch(id) }) }
  static addDispatchLog(dispatchId: number, userId: number, content: string) { return drizzleDb.insert(iximeiCrmDispatchFollowLog).values({ dispatchId, userId, content }) }

  static accessibleHospitalIds(userId: number) { return drizzleDb.select({ hospitalId: iximeiCrmHospitalAccount.hospitalId }).from(iximeiCrmHospitalAccount).innerJoin(iximeiCrmHospital, eq(iximeiCrmHospitalAccount.hospitalId, iximeiCrmHospital.id)).where(and(eq(iximeiCrmHospitalAccount.userId, userId), eq(iximeiCrmHospitalAccount.status, 1), active(iximeiCrmHospitalAccount), active(iximeiCrmHospital), eq(iximeiCrmHospital.status, 1))) }
  static listHospitalAccounts(hospitalId: number) { return drizzleDb.select({ id: iximeiCrmHospitalAccount.id, hospitalId: iximeiCrmHospitalAccount.hospitalId, userId: iximeiCrmHospitalAccount.userId, role: iximeiCrmHospitalAccount.role, status: iximeiCrmHospitalAccount.status, remark: iximeiCrmHospitalAccount.remark, createdAt: iximeiCrmHospitalAccount.createdAt, user: { id: sysUser.id, username: sysUser.username, realName: sysUser.realName, phone: sysUser.phone, email: sysUser.email, status: sysUser.status } }).from(iximeiCrmHospitalAccount).innerJoin(sysUser, eq(iximeiCrmHospitalAccount.userId, sysUser.id)).where(and(eq(iximeiCrmHospitalAccount.hospitalId, hospitalId), active(iximeiCrmHospitalAccount))).orderBy(desc(iximeiCrmHospitalAccount.createdAt)) }
  static findHospitalAccount(hospitalId: number, userId: number) { return drizzleDb.select().from(iximeiCrmHospitalAccount).where(and(eq(iximeiCrmHospitalAccount.hospitalId, hospitalId), eq(iximeiCrmHospitalAccount.userId, userId), active(iximeiCrmHospitalAccount))).limit(1) }
  static countOwners(hospitalId: number) { return drizzleDb.select({ total: count() }).from(iximeiCrmHospitalAccount).where(and(eq(iximeiCrmHospitalAccount.hospitalId, hospitalId), eq(iximeiCrmHospitalAccount.role, 'owner'), active(iximeiCrmHospitalAccount))) }
  static findUser(id: number) { return drizzleDb.select().from(sysUser).where(and(eq(sysUser.id, id), active(sysUser))).limit(1) }
  static findOtherUserByUsername(username: string, userId: number) { return drizzleDb.select({ id: sysUser.id }).from(sysUser).where(and(eq(sysUser.username, username), active(sysUser), ne(sysUser.id, userId))).limit(1) }
  static async createHospitalAccount(hospitalId: number, user: typeof sysUser.$inferInsert, account: typeof iximeiCrmHospitalAccount.$inferInsert) { return drizzleDb.transaction(async (tx) => { const userResult = await tx.insert(sysUser).values(user); const userId = Number(userResult[0].insertId); await tx.insert(iximeiCrmHospitalAccount).values({ ...account, hospitalId, userId }); return { ...(await this.findHospitalAccount(hospitalId, userId))[0], user: { id: userId, username: user.username, realName: user.realName, phone: user.phone, email: user.email, status: String(user.status ?? 1) } } }) }
  static async assignHospitalAccount(input: typeof iximeiCrmHospitalAccount.$inferInsert) { const result = await drizzleDb.insert(iximeiCrmHospitalAccount).values(input); return (await drizzleDb.select().from(iximeiCrmHospitalAccount).where(eq(iximeiCrmHospitalAccount.id, Number(result[0].insertId))).limit(1))[0] }
  static async updateUser(id: number, input: Partial<typeof sysUser.$inferInsert>) { await drizzleDb.update(sysUser).set(input).where(eq(sysUser.id, id)) }
  static async updateHospitalAccount(id: number, input: Partial<typeof iximeiCrmHospitalAccount.$inferInsert>) { await drizzleDb.update(iximeiCrmHospitalAccount).set(input).where(eq(iximeiCrmHospitalAccount.id, id)); return (await drizzleDb.select().from(iximeiCrmHospitalAccount).where(eq(iximeiCrmHospitalAccount.id, id)).limit(1))[0] }
  static listRegions(parentId: number) { return drizzleDb.select().from(sysRegion).where(eq(sysRegion.parentCode, parentId)).orderBy(asc(sysRegion.code)) }
  static bindWechatOpenid(hospitalId: number, openid: string) { return this.updateHospital(hospitalId, { wechatOpenid: openid }) }
}
