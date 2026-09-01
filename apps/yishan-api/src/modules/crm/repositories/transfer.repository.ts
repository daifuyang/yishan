import { aliasedTable, desc, eq } from 'drizzle-orm'
import { drizzleDb, type AppQueryDb } from '@/db'
import { sysUser } from '@/db/schema'
import { crmCustomerTransfer } from '../db/schema.js'

/**
 * crm_customer_transfer Repository。
 *
 * 客户流转日志的写入只发生在认领 / 释放 / 转交 / 直接分配 四个 action。
 * Service 层负责把日志写入与主表更新放进同一事务；
 * 这里只暴露"插入 + 列表"。
 */

export type TransferType = 'assign' | 'transfer' | 'claim' | 'release'

export interface TransferRow {
  id: number
  customerId: number
  type: string
  fromUserId: number | null
  toUserId: number | null
  operatorUserId: number
  reason: string | null
  createdAt: Date
}

export interface TransferRowWithNames extends TransferRow {
  fromUserName: string | null
  toUserName: string | null
  operatorUserName: string | null
}

export interface CreateTransferInput {
  customerId: number
  type: TransferType
  fromUserId?: number | null
  toUserId?: number | null
  operatorUserId: number
  reason?: string | null
}

export class TransferRepository {
  static async create(
    input: CreateTransferInput,
    db: AppQueryDb = drizzleDb,
  ): Promise<TransferRow> {
    const [inserted] = await db
      .insert(crmCustomerTransfer)
      .values({
        customerId: input.customerId,
        type: input.type,
        fromUserId: input.fromUserId ?? null,
        toUserId: input.toUserId ?? null,
        operatorUserId: input.operatorUserId,
        reason: input.reason ?? null,
      })
      .$returningId()
    const [row] = await db
      .select()
      .from(crmCustomerTransfer)
      .where(eq(crmCustomerTransfer.id, inserted.id))
      .limit(1)
    if (!row) throw new Error('Failed to read back created crm transfer')
    return row as TransferRow
  }

  static async listByCustomerId(
    customerId: number,
    db: AppQueryDb = drizzleDb,
  ): Promise<TransferRowWithNames[]> {
    const fromUser = aliasedTable(sysUser, 'from_user')
    const toUser = aliasedTable(sysUser, 'to_user')
    const operatorUser = aliasedTable(sysUser, 'operator_user')
    const rows = await db
      .select({
        id: crmCustomerTransfer.id,
        customerId: crmCustomerTransfer.customerId,
        type: crmCustomerTransfer.type,
        fromUserId: crmCustomerTransfer.fromUserId,
        toUserId: crmCustomerTransfer.toUserId,
        operatorUserId: crmCustomerTransfer.operatorUserId,
        reason: crmCustomerTransfer.reason,
        createdAt: crmCustomerTransfer.createdAt,
        fromUserName: fromUser.username,
        toUserName: toUser.username,
        operatorUserName: operatorUser.username,
      })
      .from(crmCustomerTransfer)
      .leftJoin(fromUser, eq(fromUser.id, crmCustomerTransfer.fromUserId))
      .leftJoin(toUser, eq(toUser.id, crmCustomerTransfer.toUserId))
      .leftJoin(operatorUser, eq(operatorUser.id, crmCustomerTransfer.operatorUserId))
      .where(eq(crmCustomerTransfer.customerId, customerId))
      .orderBy(desc(crmCustomerTransfer.createdAt))
      .limit(200)
    return rows as TransferRowWithNames[]
  }
}
