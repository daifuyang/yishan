import { and, desc, eq, isNull, like, type SQL } from 'drizzle-orm'
import { drizzleDb, type AppQueryDb } from '@/db'
import { shopAttributes, shopAttributeValues } from '../db/schema.js'

export interface AttributeRow {
  id: number
  name: string
  type: number
  sortOrder: number
  status: number
  creatorId: number
  createdAt: Date
  updaterId: number
  updatedAt: Date
}

export interface AttributeValueRow {
  id: number
  attributeId: number
  value: string
  image: string | null
  sortOrder: number
  status: number
  creatorId: number
  createdAt: Date
  updaterId: number
  updatedAt: Date
}

export interface CreateAttributeInput {
  name: string
  type?: number
  sortOrder?: number
  status?: number
  creatorId: number
  updaterId: number
}

export interface UpdateAttributeInput {
  name?: string
  type?: number
  sortOrder?: number
  status?: number
  updaterId: number
}

export interface CreateAttributeValueInput {
  attributeId: number
  value: string
  image?: string | null
  sortOrder?: number
  status?: number
  creatorId: number
  updaterId: number
}

export interface AttributeListQuery {
  page?: number
  pageSize?: number
  keyword?: string
  type?: number
  status?: number
}

function buildWhere(opts: AttributeListQuery): SQL | undefined {
  const conds: SQL[] = [isNull(shopAttributes.deletedAt)]
  if (opts.keyword) conds.push(like(shopAttributes.name, `%${opts.keyword}%`))
  if (opts.type !== undefined) conds.push(eq(shopAttributes.type, opts.type))
  if (opts.status !== undefined) conds.push(eq(shopAttributes.status, opts.status))
  return and(...conds)
}

export class AttributesRepository {
  static async list(
    query: AttributeListQuery,
    db: AppQueryDb = drizzleDb,
  ): Promise<{ rows: AttributeRow[]; total: number }> {
    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 10
    const where = buildWhere(query)
    const [rows, totalRows] = await Promise.all([
      db.select().from(shopAttributes).where(where).orderBy(desc(shopAttributes.sortOrder)).limit(pageSize).offset((page - 1) * pageSize),
      db.select({ id: shopAttributes.id }).from(shopAttributes).where(where),
    ])
    return { rows: rows as AttributeRow[], total: totalRows.length }
  }

  static async findById(id: number, db: AppQueryDb = drizzleDb): Promise<AttributeRow | null> {
    const [row] = await db.select().from(shopAttributes).where(eq(shopAttributes.id, id)).limit(1)
    return (row as AttributeRow | undefined) ?? null
  }

  static async create(input: CreateAttributeInput, db: AppQueryDb = drizzleDb): Promise<AttributeRow> {
    const [inserted] = await db.insert(shopAttributes).values(input).$returningId()
    const created = await AttributesRepository.findById(inserted.id, db)
    if (!created) throw new Error('Failed to read back created shop attribute')
    return created
  }

  static async update(id: number, input: UpdateAttributeInput, db: AppQueryDb = drizzleDb): Promise<AttributeRow | null> {
    await db.update(shopAttributes).set({ ...input, updatedAt: new Date() }).where(eq(shopAttributes.id, id))
    return AttributesRepository.findById(id, db)
  }

  static async softDelete(id: number, db: AppQueryDb = drizzleDb): Promise<boolean> {
    await db.update(shopAttributes).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(shopAttributes.id, id))
    return true
  }

  // ─── values ───
  static async listValues(attributeId: number, db: AppQueryDb = drizzleDb): Promise<AttributeValueRow[]> {
    const rows = await db
      .select()
      .from(shopAttributeValues)
      .where(and(eq(shopAttributeValues.attributeId, attributeId), isNull(shopAttributeValues.deletedAt)))
      .orderBy(desc(shopAttributeValues.sortOrder))
    return rows as AttributeValueRow[]
  }

  static async findValueById(id: number, db: AppQueryDb = drizzleDb): Promise<AttributeValueRow | null> {
    const [row] = await db.select().from(shopAttributeValues).where(eq(shopAttributeValues.id, id)).limit(1)
    return (row as AttributeValueRow | undefined) ?? null
  }

  static async createValue(input: CreateAttributeValueInput, db: AppQueryDb = drizzleDb): Promise<AttributeValueRow> {
    const [inserted] = await db.insert(shopAttributeValues).values(input).$returningId()
    const created = await AttributesRepository.findValueById(inserted.id, db)
    if (!created) throw new Error('Failed to read back created shop attribute value')
    return created
  }

  static async deleteValues(attributeId: number, db: AppQueryDb = drizzleDb): Promise<void> {
    await db
      .update(shopAttributeValues)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(shopAttributeValues.attributeId, attributeId))
  }
}
