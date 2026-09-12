import { aliasedTable, and, asc, count, desc, eq, inArray, isNull, like, or, sql, type SQL } from 'drizzle-orm'
import { drizzleDb, type AppQueryDb } from '@/db'
import { sysUser } from '@/db/schema'
import { crmOpportunity, crmOpportunityStageLog } from '../db/schema.js'

/**
 * crm_opportunity / crm_opportunity_stage_log Repository。
 *
 * 整个 CRM 模块内**唯一**允许访问 crm_opportunity 相关表的层。
 * Repository 只负责纯数据访问；业务规则（状态机、数据范围、审计）写在 service 层。
 *
 * 设计要点：
 *   - 跨表字段（customer 名称 / contact 名称 / owner 名称）走多次 query + JS 合并；
 *     不在 repository 里 join crm_customer（模块边界）。
 *   - 阶段流转审计日志（stage_log）只在 service 层事务内写入；
 *     repository 暴露 createStageLog + listStageLogsByOpportunity 两个入口。
 *   - findByIdForUpdate 走 raw `SELECT ... FOR UPDATE`，与 lead 的 lockAvailableForConversionInTx
 *     同样的实现思路：drizzle query builder 不直接暴露 FOR UPDATE，用 execute 兜底。
 */

export type OpportunityStage = 'discover' | 'qualify' | 'proposal' | 'negotiation' | 'won' | 'lost'

export type OpportunityLostReasonCode =
  | 'price'
  | 'competitor'
  | 'no_budget'
  | 'no_response'
  | 'project_cancelled'
  | 'other'

export interface OpportunityRow {
  id: number
  name: string
  customerId: number
  contactId: number | null
  ownerUserId: number | null
  ownerUserName: string | null
  ownerDepartmentId: number | null
  pipelineCode: string
  stageCode: OpportunityStage
  stageEnteredAt: Date
  expectedAmountCents: number
  expectedCloseDate: Date | null
  nextActionAt: Date | null
  lostReasonCode: OpportunityLostReasonCode | null
  wonAt: Date | null
  lostAt: Date | null
  version: number
  creatorId: number | null
  createdByUserName: string | null
  createdAt: Date
  updaterId: number | null
  updatedAt: Date
  deletedAt: Date | null
}

export interface OpportunityListQuery {
  page?: number
  pageSize?: number
  keyword?: string
  customerId?: number
  contactId?: number
  stageCode?: OpportunityStage
  pipelineCode?: string
  ownerUserId?: number
  /** 数据范围：由 service 调用 computeDataScope(currentUser) 注入。 */
  ownerUserIds?: number[] | null
  ownerDepartmentIds?: number[] | null
}

export interface CreateOpportunityInput {
  name: string
  customerId: number
  contactId?: number | null
  ownerUserId?: number | null
  ownerDepartmentId?: number | null
  pipelineCode?: string
  stageCode?: OpportunityStage
  expectedAmountCents?: number
  expectedCloseDate?: Date | null
  nextActionAt?: Date | null
  creatorId: number
  updaterId: number
}

export interface UpdateOpportunityInput {
  name?: string
  contactId?: number | null
  ownerUserId?: number | null
  ownerDepartmentId?: number | null
  expectedAmountCents?: number
  expectedCloseDate?: Date | null
  nextActionAt?: Date | null
  /** 乐观锁：service 在事务内读取 row.version 后传入。 */
  version?: number
  updaterId: number
}

/**
 * Kanban 分组结果：pipeline 维度下按 stageCode 分桶的商机列表。
 * 注意：仅装载状态相关的白名单字段（id/name/customerId/ownerUserId/expectedAmountCents 等），
 * 列表渲染时如有详情需要再走详情接口。
 */
export interface KanbanBucket {
  stageCode: OpportunityStage
  items: OpportunityRow[]
  total: number
}

export interface KanbanView {
  pipelineCode: string
  buckets: KanbanBucket[]
}

/**
 * 阶段流转审计日志。
 */
export interface OpportunityStageLogRow {
  id: number
  opportunityId: number
  fromStage: string
  toStage: string
  operatorUserId: number
  reason: string | null
  createdAt: Date
}

export interface OpportunityStageLogRowWithOperator extends OpportunityStageLogRow {
  operatorUserName: string | null
}

export interface CreateOpportunityStageLogInput {
  opportunityId: number
  fromStage: string
  toStage: string
  operatorUserId: number
  reason?: string | null
}

const ownerUser = aliasedTable(sysUser, 'opportunity_owner_user')
const creatorUser = aliasedTable(sysUser, 'opportunity_creator_user')

/**
 * 列表 / 详情 / Kanban 共用的列白名单。
 *
 * 注意：ownerUserName / createdByUserName 走 leftJoin sysUser（aliased），
 * 不在 repo 里跨模块 join crm_customer。customer 名称由 service 层根据 customerId
 * 多次查询后合并。
 */
const baseColumns = {
  id: crmOpportunity.id,
  name: crmOpportunity.name,
  customerId: crmOpportunity.customerId,
  contactId: crmOpportunity.contactId,
  ownerUserId: crmOpportunity.ownerUserId,
  ownerUserName: ownerUser.realName,
  ownerDepartmentId: crmOpportunity.ownerDepartmentId,
  pipelineCode: crmOpportunity.pipelineCode,
  stageCode: crmOpportunity.stageCode,
  stageEnteredAt: crmOpportunity.stageEnteredAt,
  expectedAmountCents: crmOpportunity.expectedAmountCents,
  expectedCloseDate: crmOpportunity.expectedCloseDate,
  nextActionAt: crmOpportunity.nextActionAt,
  lostReasonCode: crmOpportunity.lostReasonCode,
  wonAt: crmOpportunity.wonAt,
  lostAt: crmOpportunity.lostAt,
  version: crmOpportunity.version,
  creatorId: crmOpportunity.creatorId,
  createdByUserName: creatorUser.realName,
  createdAt: crmOpportunity.createdAt,
  updaterId: crmOpportunity.updaterId,
  updatedAt: crmOpportunity.updatedAt,
  deletedAt: crmOpportunity.deletedAt,
}

/**
 * 列表查询的 where 子句。
 *
 * 与 LeadRepository.buildLeadListWhere 保持一致风格：
 *   - 软删除过滤始终在第一位
 *   - keyword 命中 name
 *   - 各枚举 / 范围 filter 走显式 if
 *   - 数据范围（ownerUserIds / ownerDepartmentIds）：传 null 表示 super_admin 不过滤；
 *     传 [] 表示无任何 owner（极端情况下配合 pool filter 使用）
 */
export function buildOpportunityListWhere(q: OpportunityListQuery): SQL | undefined {
  const c: SQL[] = [isNull(crmOpportunity.deletedAt)]
  if (q.keyword) {
    const v = `%${q.keyword}%`
    c.push(like(crmOpportunity.name, v))
  }
  if (q.customerId !== undefined) c.push(eq(crmOpportunity.customerId, q.customerId))
  if (q.contactId !== undefined) c.push(eq(crmOpportunity.contactId, q.contactId))
  if (q.stageCode) c.push(eq(crmOpportunity.stageCode, q.stageCode))
  if (q.pipelineCode) c.push(eq(crmOpportunity.pipelineCode, q.pipelineCode))
  if (q.ownerUserId !== undefined) c.push(eq(crmOpportunity.ownerUserId, q.ownerUserId))
  if (q.ownerUserIds !== null) {
    if (q.ownerUserIds?.length) {
      c.push(inArray(crmOpportunity.ownerUserId, q.ownerUserIds))
    } else {
      // 数据范围被 service 计算为 [currentUser.id] 或 [] 等；不允许 null 时落到 "owner IS NULL"
      // 也即：不在范围 = 不可见。这里以最严格的"无 owner 即不可见"作为兜底。
      // service 通常会传 [currentUser.id]；空数组应让结果为空。
      c.push(sql`1 = 0`)
    }
  }
  if (q.ownerDepartmentIds?.length) {
    // 部门可见是 owner 范围的扩展；用 OR 允许"owner 在部门内或 owner = 当前用户"两种命中。
    c.push(or(
      inArray(crmOpportunity.ownerDepartmentId, q.ownerDepartmentIds),
      ...(q.ownerUserIds?.length ? [inArray(crmOpportunity.ownerUserId, q.ownerUserIds)] : []),
    )!)
  }
  return and(...c)
}

export class OpportunityRepository {
  static async list(
    q: OpportunityListQuery,
    db: AppQueryDb = drizzleDb,
  ): Promise<{ rows: OpportunityRow[]; total: number }> {
    const page = q.page ?? 1
    const pageSize = q.pageSize ?? 10
    const where = buildOpportunityListWhere(q)
    const [rows, total] = await Promise.all([
      db
        .select(baseColumns)
        .from(crmOpportunity)
        .leftJoin(ownerUser, eq(ownerUser.id, crmOpportunity.ownerUserId))
        .leftJoin(creatorUser, eq(creatorUser.id, crmOpportunity.creatorId))
        .where(where)
        .orderBy(desc(crmOpportunity.updatedAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db.select({ c: count() }).from(crmOpportunity).where(where),
    ])
    return { rows: rows as OpportunityRow[], total: Number(total[0]?.c ?? 0) }
  }

  static async findById(id: number, db: AppQueryDb = drizzleDb): Promise<OpportunityRow | null> {
    const [row] = await db
      .select(baseColumns)
      .from(crmOpportunity)
      .leftJoin(ownerUser, eq(ownerUser.id, crmOpportunity.ownerUserId))
      .leftJoin(creatorUser, eq(creatorUser.id, crmOpportunity.creatorId))
      .where(and(eq(crmOpportunity.id, id), isNull(crmOpportunity.deletedAt)))
      .limit(1)
    return row ? (row as OpportunityRow) : null
  }

  static async create(
    input: CreateOpportunityInput,
    db: AppQueryDb = drizzleDb,
  ): Promise<OpportunityRow> {
    const [inserted] = await db
      .insert(crmOpportunity)
      .values({
        name: input.name,
        customerId: input.customerId,
        contactId: input.contactId ?? null,
        ownerUserId: input.ownerUserId ?? null,
        ownerDepartmentId: input.ownerDepartmentId ?? null,
        pipelineCode: input.pipelineCode ?? 'default',
        stageCode: input.stageCode ?? 'discover',
        expectedAmountCents: input.expectedAmountCents ?? 0,
        expectedCloseDate: input.expectedCloseDate ?? null,
        nextActionAt: input.nextActionAt ?? null,
        creatorId: input.creatorId,
        updaterId: input.updaterId,
      })
      .$returningId()
    const row = await OpportunityRepository.findById(inserted.id, db)
    if (!row) throw new Error('Failed to read back created CRM opportunity')
    return row
  }

  /**
   * 普通 update：仅允许白名单字段生效。
   *
   * 注意：**不**自动维护 stageEnteredAt / wonAt / lostAt / version——这些字段由
   * advanceStage / markWon / markLost 走专用入口显式维护。
   */
  static async update(
    id: number,
    input: UpdateOpportunityInput,
    db: AppQueryDb = drizzleDb,
  ): Promise<OpportunityRow | null> {
    const patch: Record<string, unknown> = { updatedAt: new Date(), updaterId: input.updaterId }
    if (input.name !== undefined) patch.name = input.name
    if (input.contactId !== undefined) patch.contactId = input.contactId
    if (input.ownerUserId !== undefined) patch.ownerUserId = input.ownerUserId
    if (input.ownerDepartmentId !== undefined) patch.ownerDepartmentId = input.ownerDepartmentId
    if (input.expectedAmountCents !== undefined) patch.expectedAmountCents = input.expectedAmountCents
    if (input.expectedCloseDate !== undefined) patch.expectedCloseDate = input.expectedCloseDate
    if (input.nextActionAt !== undefined) patch.nextActionAt = input.nextActionAt
    if (input.version !== undefined) patch.version = input.version + 1

    await db.update(crmOpportunity).set(patch).where(and(eq(crmOpportunity.id, id), isNull(crmOpportunity.deletedAt)))
    return OpportunityRepository.findById(id, db)
  }

  /**
   * 软删除：写 deleted_at = now()。已 won/lost 的商机允许软删（保留审计）。
   * 返回受影响行数：0 表示不存在 / 已删除。
   */
  static async softDelete(id: number, db: AppQueryDb = drizzleDb): Promise<number> {
    const result = await db
      .update(crmOpportunity)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(crmOpportunity.id, id), isNull(crmOpportunity.deletedAt)))
    return ((result as unknown as [{ affectedRows?: number } | undefined])[0])?.affectedRows ?? 0
  }

  /**
   * Kanban 视图：按 pipeline 聚合，再按 stage 分桶。
   *
   * 实现思路：一次 list 拉全部未删商机（同一 pipeline），按 stageCode 在 JS 层分桶。
   * 优点：单一 SQL，pipelineCode 有 idx_crm_opportunity_pipeline_stage 索引覆盖；
   *      阶段顺序与 bucket 顺序由 service 层按 STAGE_ORDER 决定。
   * 限制：单 pipeline 商机过多时（如 > 1000）会拉全表；Phase 3 由 pipelineCode + stageCode
   *      分页或 sys_enum 字典化后可改为按阶段分组查询。
   */
  static async listByPipelineGroupedByStage(
    pipelineCode: string,
    db: AppQueryDb = drizzleDb,
  ): Promise<OpportunityRow[]> {
    const rows = await db
      .select(baseColumns)
      .from(crmOpportunity)
      .leftJoin(ownerUser, eq(ownerUser.id, crmOpportunity.ownerUserId))
      .leftJoin(creatorUser, eq(creatorUser.id, crmOpportunity.creatorId))
      .where(and(eq(crmOpportunity.pipelineCode, pipelineCode), isNull(crmOpportunity.deletedAt)))
      .orderBy(asc(crmOpportunity.stageEnteredAt))
    return rows as OpportunityRow[]
  }

  /**
   * 事务内：按 ID 锁定一条未删除的商机（FOR UPDATE）。
   *
   * 与 LeadRepository.lockAvailableForConversionInTx 同款思路：
   *   - drizzle 不暴露 FOR UPDATE；用 db.execute 兜底。
   *   - execute 失败（如 query builder 不支持）时退化为 findById 的状态检查；
   *     真正的安全门是 findById 的结果 + stage 状态。
   */
  static async findByIdForUpdate(
    id: number,
    db: AppQueryDb,
  ): Promise<OpportunityRow | null> {
    try {
      await db.execute(
        sql`SELECT id FROM ${crmOpportunity} WHERE id = ${id} AND deleted_at IS NULL FOR UPDATE`,
      )
    } catch {
      // 同 lead：锁只是并发加锁的尝试；状态校验由 findById 兜底。
    }
    return OpportunityRepository.findById(id, db)
  }

  /* ─── 阶段流转审计 ───────────────────────────────────── */

  static async createStageLog(
    input: CreateOpportunityStageLogInput,
    db: AppQueryDb = drizzleDb,
  ): Promise<OpportunityStageLogRow> {
    const [inserted] = await db
      .insert(crmOpportunityStageLog)
      .values({
        opportunityId: input.opportunityId,
        fromStage: input.fromStage,
        toStage: input.toStage,
        operatorUserId: input.operatorUserId,
        reason: input.reason ?? null,
      })
      .$returningId()
    const [row] = await db
      .select()
      .from(crmOpportunityStageLog)
      .where(eq(crmOpportunityStageLog.id, inserted.id))
      .limit(1)
    if (!row) throw new Error('Failed to read back created opportunity stage log')
    return row as OpportunityStageLogRow
  }

  static async listStageLogsByOpportunity(
    opportunityId: number,
    db: AppQueryDb = drizzleDb,
  ): Promise<OpportunityStageLogRowWithOperator[]> {
    const operatorAlias = aliasedTable(sysUser, 'stage_log_operator_user')
    const rows = await db
      .select({
        id: crmOpportunityStageLog.id,
        opportunityId: crmOpportunityStageLog.opportunityId,
        fromStage: crmOpportunityStageLog.fromStage,
        toStage: crmOpportunityStageLog.toStage,
        operatorUserId: crmOpportunityStageLog.operatorUserId,
        reason: crmOpportunityStageLog.reason,
        createdAt: crmOpportunityStageLog.createdAt,
        operatorUserName: operatorAlias.realName,
      })
      .from(crmOpportunityStageLog)
      .leftJoin(operatorAlias, eq(operatorAlias.id, crmOpportunityStageLog.operatorUserId))
      .where(eq(crmOpportunityStageLog.opportunityId, opportunityId))
      .orderBy(desc(crmOpportunityStageLog.createdAt))
      .limit(200)
    return rows as OpportunityStageLogRowWithOperator[]
  }
}
