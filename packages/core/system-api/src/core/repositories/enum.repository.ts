/**
 * sys_enum 通用枚举表 Repository。
 *
 * 这是 CRM 模块"枚举中心"的基础设施：所有 *status / *source / *level 等
 * 业务小枚举都搬到 `sys_enum(type='xxx', code='yyy', name='zzz')` 这张表里。
 *
 * 风格基线：
 *   - 纯数据访问，零业务规则。
 *   - 写入参数必须由调用方补齐 createdBy/updatedBy/creatorId/updaterId。
 *   - `enabled` / `deletedAt` 由 service 层语义统一处理，这里只做原值传递。
 *   - 不在 repository 内做跨 sys_* 表 join（sysEnum 是叶子表）。
 */
import { and, asc, count, eq, getTableColumns, isNull, like, or, type SQL } from 'drizzle-orm'
import { drizzleDb, type AppQueryDb } from '@/db'
import { sysEnum } from '@/db/schema'
import type { SysEnumType } from '../schemas/enum.schema.js'

const { deletedAt: _deletedAt, ...enumPublicColumns } = getTableColumns(sysEnum)

export interface EnumRow {
  id: number
  type: string
  code: string
  name: string
  sort: number
  enabled: number
  remark: string | null
  creatorId: number | null
  createdAt: Date
  updaterId: number | null
  updatedAt: Date
}

export interface CreateEnumInput {
  type: string
  code: string
  name: string
  sort?: number
  enabled?: number
  remark?: string | null
  creatorId: number
  updaterId: number
}

export interface UpdateEnumInput {
  name?: string
  sort?: number
  enabled?: number
  remark?: string | null
  updaterId: number
}

export interface EnumListQuery {
  type?: string
  keyword?: string
  enabled?: number
  page?: number
  pageSize?: number
}

function buildWhere(opts: EnumListQuery): SQL | undefined {
  const conds: SQL[] = [isNull(sysEnum.deletedAt)]
  if (opts.type) conds.push(eq(sysEnum.type, opts.type))
  if (opts.enabled !== undefined) conds.push(eq(sysEnum.enabled, opts.enabled))
  if (opts.keyword) {
    const k = `%${opts.keyword}%`
    conds.push(or(like(sysEnum.code, k), like(sysEnum.name, k))!)
  }
  return and(...conds)
}

export class EnumRepository {
  /**
   * 按 type 查所有启用的项；按 sort 升序、code 升序兜底。
   * 供前端 dropdown / 后端 service 校验 code 存在性。
   */
  static async findActiveByType(type: SysEnumType | string, db: AppQueryDb = drizzleDb): Promise<EnumRow[]> {
    const rows = await db
      .select(enumPublicColumns)
      .from(sysEnum)
      .where(and(eq(sysEnum.type, type), isNull(sysEnum.deletedAt)))
      .orderBy(asc(sysEnum.sort), asc(sysEnum.code))
    return rows as EnumRow[]
  }

  static async findById(id: number, db: AppQueryDb = drizzleDb): Promise<EnumRow | null> {
    const [row] = await db
      .select(enumPublicColumns)
      .from(sysEnum)
      .where(and(eq(sysEnum.id, id), isNull(sysEnum.deletedAt)))
      .limit(1)
    return (row as EnumRow | undefined) ?? null
  }

  static async findByTypeAndCode(
    type: string,
    code: string,
    db: AppQueryDb = drizzleDb,
  ): Promise<EnumRow | null> {
    const [row] = await db
      .select(enumPublicColumns)
      .from(sysEnum)
      .where(and(eq(sysEnum.type, type), eq(sysEnum.code, code), isNull(sysEnum.deletedAt)))
      .limit(1)
    return (row as EnumRow | undefined) ?? null
  }

  static async list(query: EnumListQuery, db: AppQueryDb = drizzleDb): Promise<{ rows: EnumRow[]; total: number }> {
    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 20
    const where = buildWhere(query)
    const [rows, totalRow] = await Promise.all([
      db
        .select(enumPublicColumns)
        .from(sysEnum)
        .where(where)
        .orderBy(asc(sysEnum.type), asc(sysEnum.sort), asc(sysEnum.id))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db.select({ c: count() }).from(sysEnum).where(where),
    ])
    return { rows: rows as EnumRow[], total: Number(totalRow[0]?.c ?? 0) }
  }

  static async create(input: CreateEnumInput, db: AppQueryDb = drizzleDb): Promise<EnumRow> {
    const [inserted] = await db
      .insert(sysEnum)
      .values({
        type: input.type,
        code: input.code,
        name: input.name,
        sort: input.sort ?? 0,
        enabled: input.enabled ?? 1,
        remark: input.remark ?? null,
        creatorId: input.creatorId,
        updaterId: input.updaterId,
      })
      .$returningId()
    const created = await EnumRepository.findById(inserted.id, db)
    if (!created) throw new Error('Failed to read back created sys_enum')
    return created
  }

  static async update(id: number, input: UpdateEnumInput, db: AppQueryDb = drizzleDb): Promise<EnumRow | null> {
    const patch: Record<string, unknown> = { updatedAt: new Date(), updaterId: input.updaterId }
    if (input.name !== undefined) patch.name = input.name
    if (input.sort !== undefined) patch.sort = input.sort
    if (input.enabled !== undefined) patch.enabled = input.enabled
    if (input.remark !== undefined) patch.remark = input.remark
    await db.update(sysEnum).set(patch).where(eq(sysEnum.id, id))
    return EnumRepository.findById(id, db)
  }

  static async softDelete(id: number, db: AppQueryDb = drizzleDb): Promise<number> {
    const result = await db
      .update(sysEnum)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(sysEnum.id, id), isNull(sysEnum.deletedAt)))
    const ok = (result as unknown as [{ affectedRows?: number } | undefined])[0]
    return ok?.affectedRows ?? 0
  }

  /**
   * 一次性按多个 type 拉启用项。供前端首屏注入多个 enum list 时使用。
   * 返回 Map<type, EnumRow[]>。
   */
  static async findActiveByTypes(
    types: readonly string[],
    db: AppQueryDb = drizzleDb,
  ): Promise<Map<string, EnumRow[]>> {
    if (types.length === 0) return new Map()
    const conds: SQL[] = [isNull(sysEnum.deletedAt), eq(sysEnum.enabled, 1)]
    const placeholders = types.map((t) => eq(sysEnum.type, t))
    conds.push(or(...placeholders)!)
    const rows = (await db
      .select(enumPublicColumns)
      .from(sysEnum)
      .where(and(...conds))
      .orderBy(asc(sysEnum.type), asc(sysEnum.sort), asc(sysEnum.id))) as EnumRow[]
    const map = new Map<string, EnumRow[]>()
    for (const row of rows) {
      const list = map.get(row.type) ?? []
      list.push(row)
      map.set(row.type, list)
    }
    return map
  }

  /**
   * 列出全部 type（distinct，去重 + 未删），用于枚举中心"按 type 分组"视图。
   */
  static async listTypes(db: AppQueryDb = drizzleDb): Promise<string[]> {
    const rows = await db
      .selectDistinct({ type: sysEnum.type })
      .from(sysEnum)
      .where(isNull(sysEnum.deletedAt))
      .orderBy(asc(sysEnum.type))
    return rows.map((r) => r.type)
  }
}
