import { and, desc, eq, isNull, like, type SQL } from 'drizzle-orm'
import { drizzleDb, type AppQueryDb } from '@/db'
import { shopOrders, shopOrderItems } from '../db/schema.js'

export interface OrderRow {
  id: number
  orderNo: string
  userId: number
  totalAmount: string
  freightAmount: string
  discountAmount: string
  payAmount: string
  payStatus: number
  payTime: Date | null
  payMethod: string | null
  payTransactionId: string | null
  orderStatus: number
  expressCompany: string | null
  expressNo: string | null
  deliverTime: Date | null
  receiveTime: Date | null
  cancelReason: string | null
  remark: string | null
  status: number
  creatorId: number
  createdAt: Date
  updaterId: number
  updatedAt: Date
}

export interface OrderItemRow {
  id: number
  orderId: number
  productId: number
  skuId: number | null
  skuName: string | null
  coverImage: string | null
  productName: string
  price: string
  quantity: number
  subtotal: string
  status: number
  creatorId: number
  createdAt: Date
  updaterId: number
  updatedAt: Date
}

export interface CreateOrderInput {
  orderNo: string
  userId: number
  totalAmount: string
  freightAmount?: string
  discountAmount?: string
  payAmount: string
  orderStatus?: number
  remark?: string | null
  creatorId: number
  updaterId: number
  items: Array<Omit<OrderItemRow, 'id' | 'orderId' | 'creatorId' | 'updaterId' | 'createdAt' | 'updatedAt' | 'status'>>
}

export interface UpdateOrderInput {
  orderStatus?: number
  payStatus?: number
  payTime?: Date | null
  payMethod?: string | null
  payTransactionId?: string | null
  expressCompany?: string | null
  expressNo?: string | null
  deliverTime?: Date | null
  receiveTime?: Date | null
  cancelReason?: string | null
  remark?: string | null
  status?: number
  updaterId: number
}

export interface OrderListQuery {
  page?: number
  pageSize?: number
  keyword?: string
  userId?: number
  orderStatus?: number
  payStatus?: number
}

function buildWhere(opts: OrderListQuery): SQL | undefined {
  const conds: SQL[] = [isNull(shopOrders.deletedAt)]
  if (opts.keyword) conds.push(like(shopOrders.orderNo, `%${opts.keyword}%`))
  if (opts.userId !== undefined) conds.push(eq(shopOrders.userId, opts.userId))
  if (opts.orderStatus !== undefined) conds.push(eq(shopOrders.orderStatus, opts.orderStatus))
  if (opts.payStatus !== undefined) conds.push(eq(shopOrders.payStatus, opts.payStatus))
  return and(...conds)
}

export class OrdersRepository {
  static async list(
    query: OrderListQuery,
    db: AppQueryDb = drizzleDb,
  ): Promise<{ rows: OrderRow[]; total: number }> {
    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 10
    const where = buildWhere(query)
    const [rows, totalRows] = await Promise.all([
      db.select().from(shopOrders).where(where).orderBy(desc(shopOrders.createdAt)).limit(pageSize).offset((page - 1) * pageSize),
      db.select({ id: shopOrders.id }).from(shopOrders).where(where),
    ])
    return { rows: rows as OrderRow[], total: totalRows.length }
  }

  static async findById(id: number, db: AppQueryDb = drizzleDb): Promise<OrderRow | null> {
    const [row] = await db.select().from(shopOrders).where(eq(shopOrders.id, id)).limit(1)
    return (row as OrderRow | undefined) ?? null
  }

  static async findByOrderNo(orderNo: string, db: AppQueryDb = drizzleDb): Promise<OrderRow | null> {
    const [row] = await db.select().from(shopOrders).where(eq(shopOrders.orderNo, orderNo)).limit(1)
    return (row as OrderRow | undefined) ?? null
  }

  static async create(input: CreateOrderInput, db: AppQueryDb = drizzleDb): Promise<OrderRow> {
    const { items, ...orderInput } = input
    const [inserted] = await db.insert(shopOrders).values(orderInput).$returningId()
    if (items.length > 0) {
      await db.insert(shopOrderItems).values(
        items.map((it) => ({
          orderId: inserted.id,
          productId: it.productId,
          skuId: it.skuId,
          skuName: it.skuName,
          coverImage: it.coverImage,
          productName: it.productName,
          price: it.price,
          quantity: it.quantity,
          subtotal: it.subtotal,
          status: 1,
          creatorId: orderInput.creatorId,
          updaterId: orderInput.updaterId,
        })),
      )
    }
    const created = await OrdersRepository.findById(inserted.id, db)
    if (!created) throw new Error('Failed to read back created shop order')
    return created
  }

  static async update(id: number, input: UpdateOrderInput, db: AppQueryDb = drizzleDb): Promise<OrderRow | null> {
    await db.update(shopOrders).set({ ...input, updatedAt: new Date() }).where(eq(shopOrders.id, id))
    return OrdersRepository.findById(id, db)
  }

  static async softDelete(id: number, db: AppQueryDb = drizzleDb): Promise<boolean> {
    await db.update(shopOrders).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(shopOrders.id, id))
    return true
  }

  static async listItems(orderId: number, db: AppQueryDb = drizzleDb): Promise<OrderItemRow[]> {
    const rows = await db
      .select()
      .from(shopOrderItems)
      .where(and(eq(shopOrderItems.orderId, orderId), isNull(shopOrderItems.deletedAt)))
    return rows as OrderItemRow[]
  }
}
