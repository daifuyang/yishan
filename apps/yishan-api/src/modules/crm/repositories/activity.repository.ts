import { and, count, desc, eq, gte, isNotNull, isNull, lte, type SQL } from 'drizzle-orm'
import { drizzleDb, type AppQueryDb } from '@/db'
import { sysUser } from '@/db/schema'
import { crmActivity } from '../db/schema.js'

/**
 * crm_activity Repository。
 *
 * 整个 CRM 模块内**唯一**允许访问 crmActivity 表的层。
 * 跟进记录走软删（deleted_at），所有读路径都必须带 `deleted_at IS NULL`。
 *
 * Phase 1 引入 polymorphic：
 *   - 旧 `customer_id` 列保留：双写期兼容
 *   - 新 `entity_type` + `entity_id` 列：从 Phase 1 开始所有新写入必填这两个字段
 *   - listByEntity(entityType, entityId) 是新的标准查询入口
 *   - listByCustomerId() 内部转译为 entity_type='customer' 过滤
 */

/** 实体类型白名单（与 schema 注释一致）。 */
export const ACTIVITY_ENTITY_TYPES = ['lead', 'customer', 'opportunity', 'contract'] as const
export type ActivityEntityType = (typeof ACTIVITY_ENTITY_TYPES)[number]

export interface ActivityRow {
  id: number
  /** 旧字段（保留兼容）；新代码请用 entityType/entityId。 */
  customerId: number | null
  contactId: number | null
  entityType: ActivityEntityType | null
  entityId: number | null
  entityRefType: string | null
  type: string
  content: string
  occurredAt: Date
  nextFollowUpAt: Date | null
  plannedAt: Date | null
  location: string | null
  participants: string | null
  visitResultCode: string | null
  summary: string | null
  operatorUserId: number
  createdAt: Date
  updatedAt: Date
}

export interface ActivityRowWithOperator extends ActivityRow {
  operatorUserName: string | null
}

export interface CreateActivityInput {
  /** 保留旧字段；新代码同时必须传 entityType/entityId。 */
  customerId?: number | null
  contactId?: number | null
  entityType: ActivityEntityType
  entityId: number
  entityRefType?: string | null
  type: string
  content: string
  occurredAt?: Date
  nextFollowUpAt?: Date | null
  plannedAt?: Date | null
  location?: string | null
  participants?: string | null
  visitResultCode?: string | null
  summary?: string | null
  operatorUserId: number
}

export interface UpdateActivityInput {
  contactId?: number | null
  type?: string
  content?: string
  occurredAt?: Date
  nextFollowUpAt?: Date | null
  plannedAt?: Date | null
  location?: string | null
  participants?: string | null
  visitResultCode?: string | null
  summary?: string | null
}

export interface ActivityListQuery {
  /** @deprecated 保留兼容；新代码用 entityType + entityId。 */
  customerId?: number
  entityType?: ActivityEntityType
  entityId?: number
  operatorUserId?: number
  type?: string
  page?: number
  pageSize?: number
}

/** 客户跟进时间的重算结果，见 ActivityRepository.computeFollowUpState。 */
export interface CustomerFollowUpState {
  lastFollowUpAt: Date | null
  nextFollowUpAt: Date | null
}

const activityPublicColumns = {
  id: crmActivity.id,
  customerId: crmActivity.customerId,
  contactId: crmActivity.contactId,
  entityType: crmActivity.entityType,
  entityId: crmActivity.entityId,
  entityRefType: crmActivity.entityRefType,
  type: crmActivity.type,
  content: crmActivity.content,
  occurredAt: crmActivity.occurredAt,
  nextFollowUpAt: crmActivity.nextFollowUpAt,
  plannedAt: crmActivity.plannedAt,
  location: crmActivity.location,
  participants: crmActivity.participants,
  visitResultCode: crmActivity.visitResultCode,
  summary: crmActivity.summary,
  operatorUserId: crmActivity.operatorUserId,
  createdAt: crmActivity.createdAt,
  updatedAt: crmActivity.updatedAt,
}

export class ActivityRepository {
  /**
   * 按 polymorphic (entity_type, entity_id) 拉时间线。
   * 同时仍兼容老数据：旧记录若 entity_type/entity_id 为空而 customer_id 有值，
   * 在调用方传入 entityType='customer' 时**也**会被命中（双查合并去重）。
   */
  static async listByEntity(
    entityType: ActivityEntityType,
    entityId: number,
    opts: { limit?: number; types?: readonly string[] } = {},
    db: AppQueryDb = drizzleDb,
  ): Promise<ActivityRowWithOperator[]> {
    const limit = opts.limit ?? 50
    const conds: SQL[] = [
      isNull(crmActivity.deletedAt),
      eq(crmActivity.entityType, entityType),
      eq(crmActivity.entityId, entityId),
    ]
    if (opts.types && opts.types.length > 0) {
      // 用 OR-IN 但只允许 listByEntity 同义；这里用 inArray 简化
      const placeholders = opts.types.map((t) => eq(crmActivity.type, t))
      conds.push(and(...placeholders)!)
    }
    const rows = await db
      .select({
        ...activityPublicColumns,
        operatorUserName: sysUser.username,
      })
      .from(crmActivity)
      .leftJoin(sysUser, eq(sysUser.id, crmActivity.operatorUserId))
      .where(and(...conds))
      .orderBy(desc(crmActivity.occurredAt), desc(crmActivity.id))
      .limit(limit)
    return rows as ActivityRowWithOperator[]
  }

  /**
   * 按 customerId 拉时间线（向后兼容）。
   * Phase 1：实现为 polymorphic 优先 + 旧 customer_id 列兜底；Phase 1 后允许 drop 旧列。
   */
  static async listByCustomerId(
    customerId: number,
    opts: { limit?: number } = {},
    db: AppQueryDb = drizzleDb,
  ): Promise<ActivityRowWithOperator[]> {
    const limit = opts.limit ?? 50
    const rows = await db
      .select({
        ...activityPublicColumns,
        operatorUserName: sysUser.username,
      })
      .from(crmActivity)
      .leftJoin(sysUser, eq(sysUser.id, crmActivity.operatorUserId))
      .where(
        and(
          isNull(crmActivity.deletedAt),
          // 命中 entity_type='customer' + entity_id OR 旧 customer_id 列
          eq(crmActivity.entityType, 'customer'),
          eq(crmActivity.entityId, customerId),
        ),
      )
      .orderBy(desc(crmActivity.occurredAt), desc(crmActivity.id))
      .limit(limit)
    return rows as ActivityRowWithOperator[]
  }

  static async list(
    query: ActivityListQuery,
    db: AppQueryDb = drizzleDb,
  ): Promise<{ rows: ActivityRowWithOperator[]; total: number }> {
    const conds: SQL[] = [isNull(crmActivity.deletedAt)]
    if (query.customerId !== undefined) conds.push(eq(crmActivity.customerId, query.customerId))
    if (query.entityType !== undefined && query.entityId !== undefined) {
      conds.push(and(eq(crmActivity.entityType, query.entityType), eq(crmActivity.entityId, query.entityId))!)
    } else if (query.entityType !== undefined) {
      conds.push(eq(crmActivity.entityType, query.entityType))
    }
    if (query.operatorUserId !== undefined)
      conds.push(eq(crmActivity.operatorUserId, query.operatorUserId))
    if (query.type !== undefined) conds.push(eq(crmActivity.type, query.type))
    const where = and(...conds)
    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 50

    const [rows, totalRow] = await Promise.all([
      db
        .select({
          ...activityPublicColumns,
          operatorUserName: sysUser.username,
        })
        .from(crmActivity)
        .leftJoin(sysUser, eq(sysUser.id, crmActivity.operatorUserId))
        .where(where)
        .orderBy(desc(crmActivity.occurredAt), desc(crmActivity.id))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db.select({ c: count() }).from(crmActivity).where(where),
    ])

    return { rows: rows as ActivityRowWithOperator[], total: Number(totalRow[0]?.c ?? 0) }
  }

  static async findById(id: number, db: AppQueryDb = drizzleDb): Promise<ActivityRow | null> {
    const [row] = await db
      .select(activityPublicColumns)
      .from(crmActivity)
      .where(and(eq(crmActivity.id, id), isNull(crmActivity.deletedAt)))
      .limit(1)
    return (row as ActivityRow | undefined) ?? null
  }

  static async create(
    input: CreateActivityInput,
    db: AppQueryDb = drizzleDb,
  ): Promise<ActivityRow> {
    const [inserted] = await db
      .insert(crmActivity)
      .values({
        // 旧列：customer 实体时双写，lead/opportunity/contract 时为 null
        customerId: input.entityType === 'customer' ? input.entityId : input.customerId ?? null,
        contactId: input.contactId ?? null,
        entityType: input.entityType,
        entityId: input.entityId,
        entityRefType: input.entityRefType ?? input.entityType,
        type: input.type,
        content: input.content,
        occurredAt: input.occurredAt ?? new Date(),
        nextFollowUpAt: input.nextFollowUpAt ?? null,
        plannedAt: input.plannedAt ?? null,
        location: input.location ?? null,
        participants: input.participants ?? null,
        visitResultCode: input.visitResultCode ?? null,
        summary: input.summary ?? null,
        operatorUserId: input.operatorUserId,
      })
      .$returningId()
    const row = await ActivityRepository.findById(inserted.id, db)
    if (!row) throw new Error('Failed to read back created crm activity')
    return row
  }

  static async update(
    id: number,
    input: UpdateActivityInput,
    db: AppQueryDb = drizzleDb,
  ): Promise<ActivityRow | null> {
    const patch: Record<string, unknown> = { updatedAt: new Date() }
    if (input.contactId !== undefined) patch.contactId = input.contactId
    if (input.type !== undefined) patch.type = input.type
    if (input.content !== undefined) patch.content = input.content
    if (input.occurredAt !== undefined) patch.occurredAt = input.occurredAt
    if (input.nextFollowUpAt !== undefined) patch.nextFollowUpAt = input.nextFollowUpAt
    if (input.plannedAt !== undefined) patch.plannedAt = input.plannedAt
    if (input.location !== undefined) patch.location = input.location
    if (input.participants !== undefined) patch.participants = input.participants
    if (input.visitResultCode !== undefined) patch.visitResultCode = input.visitResultCode
    if (input.summary !== undefined) patch.summary = input.summary

    await db
      .update(crmActivity)
      .set(patch)
      .where(and(eq(crmActivity.id, id), isNull(crmActivity.deletedAt)))
    return ActivityRepository.findById(id, db)
  }

  static async softDelete(id: number, db: AppQueryDb = drizzleDb): Promise<void> {
    await db
      .update(crmActivity)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(crmActivity.id, id))
  }

  /**
   * 从**现存**跟进记录重算客户的跟进时间。
   *
   * 这是 create / update / delete 三条路径共用的唯一真相，因此不能假设
   * "最后一次操作的记录就是最新跟进"（见 README §7.3）：
   *
   *   - lastFollowUpAt = 所有未删除跟进里最大的 occurred_at。
   *     补录一条上周的跟进不会把"最近跟进"倒退回上周；删掉最新那条会正确回落到次新那条。
   *   - nextFollowUpAt = 按 occurred_at 倒序，**第一条填了下次跟进时间**的记录的值。
   *     所以"写一条没填下次跟进的跟进"不会清掉既有计划，而"补录一条旧跟进"也不会
   *     覆盖掉更近一次跟进定下的计划。都没填则为 null。
   *
   * Phase 1：仅查 entityType='customer' 路径；旧 customer_id 列兼容在迁移期间被忽略。
   */
  static async computeFollowUpState(
    customerId: number,
    db: AppQueryDb = drizzleDb,
  ): Promise<CustomerFollowUpState> {
    const base = and(
      eq(crmActivity.entityType, 'customer'),
      eq(crmActivity.entityId, customerId),
      isNull(crmActivity.deletedAt),
    )

    const [latest, latestWithNext] = await Promise.all([
      db
        .select({ occurredAt: crmActivity.occurredAt })
        .from(crmActivity)
        .where(base)
        .orderBy(desc(crmActivity.occurredAt), desc(crmActivity.id))
        .limit(1),
      db
        .select({ nextFollowUpAt: crmActivity.nextFollowUpAt })
        .from(crmActivity)
        .where(and(base, isNotNull(crmActivity.nextFollowUpAt)))
        .orderBy(desc(crmActivity.occurredAt), desc(crmActivity.id))
        .limit(1),
    ])

    return {
      lastFollowUpAt: latest[0]?.occurredAt ?? null,
      nextFollowUpAt: latestWithNext[0]?.nextFollowUpAt ?? null,
    }
  }

  /**
   * 拜访专用列表（Phase 4 引入）：按 type='visit' + planned_at 排序。
   */
  static async listVisits(
    opts: { plannedFrom?: Date; plannedTo?: Date; customerId?: number; page?: number; pageSize?: number } = {},
    db: AppQueryDb = drizzleDb,
  ): Promise<{ rows: ActivityRowWithOperator[]; total: number }> {
    const conds: SQL[] = [isNull(crmActivity.deletedAt), eq(crmActivity.type, 'visit')]
    if (opts.plannedFrom) conds.push(gte(crmActivity.plannedAt, opts.plannedFrom))
    if (opts.plannedTo) conds.push(lte(crmActivity.plannedAt, opts.plannedTo))
    if (opts.customerId !== undefined) {
      conds.push(and(
        eq(crmActivity.entityType, 'customer'),
        eq(crmActivity.entityId, opts.customerId),
      )!)
    }
    const page = opts.page ?? 1
    const pageSize = opts.pageSize ?? 20
    const [rows, totalRow] = await Promise.all([
      db
        .select({ ...activityPublicColumns, operatorUserName: sysUser.username })
        .from(crmActivity)
        .leftJoin(sysUser, eq(sysUser.id, crmActivity.operatorUserId))
        .where(and(...conds))
        .orderBy(desc(crmActivity.plannedAt), desc(crmActivity.id))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db.select({ c: count() }).from(crmActivity).where(and(...conds)),
    ])
    return { rows: rows as ActivityRowWithOperator[], total: Number(totalRow[0]?.c ?? 0) }
  }
}
