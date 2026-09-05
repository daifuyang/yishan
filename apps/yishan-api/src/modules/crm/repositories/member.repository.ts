import { and, asc, eq, inArray, sql, type SQL } from 'drizzle-orm'
import { drizzleDb, type AppQueryDb } from '@/db'
import { sysUser } from '@/db/schema'
import { crmCustomer, crmCustomerMember } from '../db/schema.js'

/**
 * crm_customer_member Repository —— 客户协同人。
 *
 * 边界说明：负责人（owner）**不进本表**，唯一真相是 `crm_customer.owner_user_id`
 * （见 db/schema.ts 注释）。本表只存协同人，避免两个数据源打架。
 */

export type CustomerMemberRole = 'collaborator'

export interface CustomerMemberRow {
  id: number
  customerId: number
  userId: number
  role: string
  createdAt: Date
}

export interface CustomerMemberWithUser extends CustomerMemberRow {
  userName: string | null
}

/**
 * "当前用户是该客户的协同人" 的 EXISTS 子查询。
 *
 * 用 EXISTS 而不是先查一遍 member 再 `IN (...)`：客户量大时 IN 列表会失控，
 * 且多一次往返。EXISTS 走 uniq_crm_customer_member / idx_..._user_id 索引。
 */
export function collaboratorExists(userId: number): SQL {
  return sql`EXISTS (SELECT 1 FROM ${crmCustomerMember} WHERE ${crmCustomerMember.customerId} = ${crmCustomer.id} AND ${crmCustomerMember.userId} = ${userId})`
}

export class CustomerMemberRepository {
  static async listByCustomerId(
    customerId: number,
    db: AppQueryDb = drizzleDb,
  ): Promise<CustomerMemberWithUser[]> {
    const rows = await db
      .select({
        id: crmCustomerMember.id,
        customerId: crmCustomerMember.customerId,
        userId: crmCustomerMember.userId,
        role: crmCustomerMember.role,
        createdAt: crmCustomerMember.createdAt,
        userName: sysUser.realName,
      })
      .from(crmCustomerMember)
      .leftJoin(sysUser, eq(sysUser.id, crmCustomerMember.userId))
      .where(eq(crmCustomerMember.customerId, customerId))
      .orderBy(asc(crmCustomerMember.id))
    return rows as CustomerMemberWithUser[]
  }

  /** 批查：客户列表 / 详情里展示协同人时避免 N+1。 */
  static async listByCustomerIds(
    customerIds: number[],
    db: AppQueryDb = drizzleDb,
  ): Promise<Map<number, CustomerMemberWithUser[]>> {
    const map = new Map<number, CustomerMemberWithUser[]>()
    if (customerIds.length === 0) return map
    const rows = await db
      .select({
        id: crmCustomerMember.id,
        customerId: crmCustomerMember.customerId,
        userId: crmCustomerMember.userId,
        role: crmCustomerMember.role,
        createdAt: crmCustomerMember.createdAt,
        userName: sysUser.realName,
      })
      .from(crmCustomerMember)
      .leftJoin(sysUser, eq(sysUser.id, crmCustomerMember.userId))
      .where(inArray(crmCustomerMember.customerId, customerIds))
      .orderBy(asc(crmCustomerMember.id))
    for (const r of rows as CustomerMemberWithUser[]) {
      const list = map.get(r.customerId)
      if (list) list.push(r)
      else map.set(r.customerId, [r])
    }
    return map
  }

  static async isCollaborator(
    customerId: number,
    userId: number,
    db: AppQueryDb = drizzleDb,
  ): Promise<boolean> {
    const [row] = await db
      .select({ id: crmCustomerMember.id })
      .from(crmCustomerMember)
      .where(
        and(eq(crmCustomerMember.customerId, customerId), eq(crmCustomerMember.userId, userId)),
      )
      .limit(1)
    return row !== undefined
  }

  /**
   * 幂等新增：命中 uniq_crm_customer_member 时不报错，直接忽略。
   * 重复点"添加协同人"不应该 500。
   */
  static async add(
    customerId: number,
    userId: number,
    creatorId: number,
    db: AppQueryDb = drizzleDb,
  ): Promise<void> {
    await db
      .insert(crmCustomerMember)
      .values({ customerId, userId, role: 'collaborator', creatorId })
      .onDuplicateKeyUpdate({ set: { customerId } })
  }

  static async remove(
    customerId: number,
    userId: number,
    db: AppQueryDb = drizzleDb,
  ): Promise<void> {
    await db
      .delete(crmCustomerMember)
      .where(
        and(eq(crmCustomerMember.customerId, customerId), eq(crmCustomerMember.userId, userId)),
      )
  }

  /** 客户被释放到公海 / 转交时，清空协同人。由调用方在同一事务里决定是否调用。 */
  static async removeAllByCustomerId(customerId: number, db: AppQueryDb): Promise<void> {
    await db.delete(crmCustomerMember).where(eq(crmCustomerMember.customerId, customerId))
  }
}
