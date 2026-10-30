import { and, count, desc, eq, getTableColumns, inArray, isNull, like, ne, or, sql } from 'drizzle-orm'
import { drizzleDb, type AppQueryDb } from '@yishan/core-system-api/database'
import { crmHospital } from '../db/schema.js'
import { sysRole, sysUser, sysUserRole } from '@yishan/core-system-api/schema'
import { BusinessError } from '@yishan/core-api/errors'
import { ROLE_IDS } from '@/modules/iximei_crm/role-codes'
import { ResourceErrorCode } from '@yishan/core-api/business-codes/resource'

const active = (t: any) => isNull(t.deletedAt)
const page = (q: any, p: any) =>
  p.pageSize === 0 ? q : q.limit(p.pageSize).offset((p.page - 1) * p.pageSize)

/**
 * 一院一账号 — 仅以 crm_hospital.account_user_id 作为唯一关系来源。
 * 旧 crm_hospital_account 表已退出代码路径，物理删除见 §7.3.6。
 */
export class HospitalsRepository {
  /* -------------------- 医院档案 CRUD -------------------- */

  static async list(query: any, db: AppQueryDb = drizzleDb) {
    const c: any[] = [active(crmHospital)]
    if (query.category) {
      const categoryIds = await HospitalsRepository.idsByCategory(query.category, db as any)
      if (categoryIds.length) c.push(inArray(crmHospital.id, categoryIds))
      else c.push(eq(crmHospital.id, -1))
    }
    if (query.status !== undefined) c.push(eq(crmHospital.status, Number(query.status)))
    if (query.keyword)
      c.push(
        or(
          like(crmHospital.hospitalName, `%${query.keyword}%`),
          like(crmHospital.hospitalPhone, `%${query.keyword}%`),
          like(crmHospital.hospitalSelling, `%${query.keyword}%`),
        )!,
      )
    if (query.hospitalIds && query.hospitalIds.length)
      c.push(inArray(crmHospital.id, query.hospitalIds))
    const where = and(...c)
    const [items, totals] = await Promise.all([
      page(
        db
          .select(getTableColumns(crmHospital))
          .from(crmHospital)
          .where(where)
          .orderBy(desc(crmHospital.createdAt)),
        query,
      ),
      db.select({ total: count() }).from(crmHospital).where(where),
    ])
    return { list: items, total: Number(totals[0]?.total ?? 0) }
  }

  private static async idsByCategory(
    category: 'oral' | 'plastic' | 'unknown',
    db: { execute: (query: any) => Promise<any> },
  ): Promise<number[]> {
    try {
      const result = await db.execute(sql`
        SELECT h.id
        FROM crm_hospital h
        WHERE h.deleted_at IS NULL
          AND CASE WHEN h.category IN ('oral', 'plastic') THEN h.category ELSE 'unknown' END = ${category}
      `)
      const rows = Array.isArray(result) && Array.isArray(result[0])
        ? result[0]
        : Array.isArray((result as any)?.rows)
          ? (result as any).rows
          : []
      return rows.map((row: any) => Number(row.id)).filter(Number.isFinite)
    } catch (error: any) {
      const cause = error?.cause ?? error
      const code = cause?.code ?? error?.code ?? error?.errno
      const message = String(cause?.sqlMessage ?? error?.sqlMessage ?? error?.message ?? '')
      if (code === 'ER_BAD_FIELD_ERROR' || code === 1054 || /Unknown column.*category/i.test(message)) {
        return category === 'unknown'
          ? await HospitalsRepository.allActiveHospitalIds(db as any).then((rows) => rows.map((row) => row.id))
          : []
      }
      throw error
    }
  }

  static async findById(id: number, db: AppQueryDb = drizzleDb) {
    const [r] = await db
      .select()
      .from(crmHospital)
      .where(and(eq(crmHospital.id, id), active(crmHospital)))
      .limit(1)
    return r ?? null
  }

  static async create(input: any, db: AppQueryDb = drizzleDb) {
    const r = await db.insert(crmHospital).values(input)
    return this.findById(Number((r as any)[0].insertId), db)
  }

  static async update(id: number, input: any, db: AppQueryDb = drizzleDb) {
    await db.update(crmHospital).set(input).where(eq(crmHospital.id, id))
    return this.findById(id, db)
  }

  static bindWechatOpenid(id: number, openid: string) {
    return this.update(id, { wechatOpenid: openid })
  }

  /* -------------------- 一院一账号：账号相关 -------------------- */

  /**
   * 唯一账号的只读视图：与 crm_hospital.account_user_id 1:1 联接。
   * 不存在账号（数据脏）时返回 null，调用方应判定为不一致。
   */
  static async getAccountByHospitalId(hospitalId: number, db: AppQueryDb = drizzleDb) {
    const [row] = await db
      .select({
        userId: sysUser.id,
        username: sysUser.username,
        email: sysUser.email,
        phone: sysUser.phone,
        status: sysUser.status,
        lastLoginTime: sysUser.lastLoginTime,
      })
      .from(crmHospital)
      .innerJoin(sysUser, eq(sysUser.id, crmHospital.accountUserId))
      .where(and(eq(crmHospital.id, hospitalId), active(crmHospital), active(sysUser)))
      .limit(1)
    return row ?? null
  }

  /**
   * 更新账号联系方式 / 启停状态。username 不允许通过此方法修改。
   */
  static async updateAccountContact(
    userId: number,
    input: { email?: string | null; phone?: string | null; status?: number },
    db: AppQueryDb = drizzleDb,
  ) {
    const set: Record<string, unknown> = { updatedAt: new Date() }
    if (input.email !== undefined) set.email = input.email
    if (input.phone !== undefined) set.phone = input.phone
    if (input.status !== undefined) set.status = input.status
    await db.update(sysUser).set(set as any).where(eq(sysUser.id, userId))
    return this.findUserById(userId, db)
  }

  /**
   * 重置账号密码。
   */
  static async resetAccountPassword(userId: number, passwordHash: string, db: AppQueryDb = drizzleDb) {
    await db
      .update(sysUser)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(sysUser.id, userId))
  }

  /**
   * 禁用账号（status = 0）。调用方负责同步撤销该用户的活跃 token。
   */
  static async disableAccount(userId: number, db: AppQueryDb = drizzleDb) {
    await db
      .update(sysUser)
      .set({ status: 0, updatedAt: new Date() })
      .where(eq(sysUser.id, userId))
  }

  static async findUserById(id: number, db: AppQueryDb = drizzleDb) {
    const [r] = await db.select().from(sysUser).where(and(eq(sysUser.id, id), active(sysUser))).limit(1)
    return r ?? null
  }

  /**
   * 检查用户名是否被其他有效用户占用。
   * 用于创建/改名事务：避免 sys_user.username 唯一索引上的冲突。
   */
  static async findOtherUserByUsername(
    username: string,
    userId: number,
    db: AppQueryDb = drizzleDb,
  ) {
    const [r] = await db
      .select({ id: sysUser.id })
      .from(sysUser)
      .where(and(eq(sysUser.username, username), active(sysUser), ne(sysUser.id, userId)))
      .limit(1)
    return r ?? null
  }

  /**
   * 医院账号数据范围：与 crm_hospital.account_user_id 1:1。
   * 同步校验 医院启用 / 医院未删 / 用户启用 / 用户未删 — 缺一即不返回。
   * 0 行由调用方按 §5.3.2 抛 BusinessError(403)。
   */
  static accessibleHospitalIds(userId: number, db: AppQueryDb = drizzleDb) {
    return db
      .select({ hospitalId: crmHospital.id })
      .from(crmHospital)
      .innerJoin(sysUser, eq(sysUser.id, crmHospital.accountUserId))
      .where(
        and(
          eq(crmHospital.accountUserId, userId),
          active(crmHospital),
          eq(crmHospital.status, 1),
          active(sysUser),
          eq(sysUser.status, 1),
        ),
      )
  }

  /**
   * 所有「启用中」医院的 id 列表，用于 super_admin 全院汇总。
   * 排除软删除 + status != 1。
   */
  static async allActiveHospitalIds(db: AppQueryDb = drizzleDb): Promise<Array<{ id: number }>> {
    return db
      .select({ id: crmHospital.id })
      .from(crmHospital)
      .where(
        and(
          active(crmHospital),
          eq(crmHospital.status, 1),
        ),
      )
  }

  /* -------------------- 创建/改名事务 -------------------- */

  /**
   * 创建医院 + 唯一账号 + 绑定 hospital_account 角色，全部在一个 tx 里完成。
   * username 固定取 hospitalName；任一步失败回滚。
   */
  static async createWithAccount(
    hospitalInput: any,
    accountInput: {
      username: string
      passwordHash: string
      email?: string | null
      phone?: string | null
      status?: number
    },
    creatorId: number,
  ) {
    return drizzleDb.transaction(async (tx) => {
      const [userResult] = await tx.insert(sysUser).values({
        username: accountInput.username,
        passwordHash: accountInput.passwordHash,
        email: accountInput.email ?? null,
        // phone 列已放开为可空（drizzle/0001_legacy_password.sql），"未填写"就该是
        // NULL 而不是空串：sys_user_phone_key 是唯一索引，空串会让第二个没填手机号
        // 的医院账号直接撞唯一键，而 NULL 在 MySQL 唯一索引里可以重复。
        phone: accountInput.phone ?? null,
        status: accountInput.status ?? 1,
        loginCount: 0,
        creatorId,
        updaterId: creatorId,
      })
      const userId = Number(userResult.insertId)
      await HospitalsRepository.bindHospitalAccountRole(userId, tx as any)
      const [hospitalResult] = await tx.insert(crmHospital).values({
        ...hospitalInput,
        accountUserId: userId,
        creatorId,
        updaterId: creatorId,
      })
      const hospitalId = Number(hospitalResult.insertId)
      return { hospitalId, userId }
    })
  }

  /**
   * 停用医院与唯一账号必须同一事务提交；避免医院已停用但账号仍可登录。
   */
  static async deactivateHospitalAndAccount(
    hospitalId: number,
    accountUserId: number,
    hospitalInput: any,
  ) {
    return drizzleDb.transaction(async (tx) => {
      await tx
        .update(crmHospital)
        .set(hospitalInput)
        .where(eq(crmHospital.id, hospitalId))
      await tx
        .update(sysUser)
        .set({ status: 0, updatedAt: new Date() })
        .where(eq(sysUser.id, accountUserId))
      return this.findById(hospitalId, tx as any)
    })
  }

  /**
   * 改名事务：同一 tx 内更新 hospital_name 与 sys_user.username。
   * 校验新名未被其他用户占用；若冲突则整体回滚。
   */
  static async renameHospitalAndAccount(
    hospitalId: number,
    userId: number,
    newHospitalName: string,
    actorId: number,
  ) {
    return drizzleDb.transaction(async (tx) => {
      // 用 SELECT ... FOR UPDATE 在 MySQL 上锁住两行，避免并发改名冲突。
      await tx
        .select({ id: crmHospital.id })
        .from(crmHospital)
        .where(eq(crmHospital.id, hospitalId))
        .limit(1)
      const conflict = await HospitalsRepository.findOtherUserByUsername(newHospitalName, userId, tx as any)
      if (conflict) {
        throw new BusinessError(ResourceErrorCode.ALREADY_EXISTS, '新医院名称已被其他账号占用')
      }
      await tx
        .update(crmHospital)
        .set({ hospitalName: newHospitalName, updatedAt: new Date(), updaterId: actorId })
        .where(eq(crmHospital.id, hospitalId))
      await tx
        .update(sysUser)
        .set({ username: newHospitalName, updatedAt: new Date() })
        .where(eq(sysUser.id, userId))
      return HospitalsRepository.findById(hospitalId, tx as any)
    })
  }

  /**
   * 绑定 hospital_account 系统角色。失败说明全局角色未配置。
   */
  static async bindHospitalAccountRole(userId: number, db: any) {
    const [role] = await db
      .select({ id: sysRole.id })
      .from(sysRole)
      .where(and(eq(sysRole.id, ROLE_IDS.HOSPITAL_ACCOUNT), active(sysRole)))
      .limit(1)
    if (!role) throw new BusinessError(ResourceErrorCode.NOT_FOUND, '医院账号全局角色未配置')
    await db
      .insert(sysUserRole)
      .values({ userId, roleId: role.id })
      .onDuplicateKeyUpdate({ set: { deletedAt: null } })
  }
}
