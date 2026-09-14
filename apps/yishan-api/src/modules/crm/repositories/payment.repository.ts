import { and, count, desc, eq, gte, isNull, like, lte, or } from 'drizzle-orm'
import { drizzleDb, type AppQueryDb } from '@/db'
import { crmContract, crmCustomer, crmPayment } from '../db/schema.js'
import { buildListWhere } from './customer.repository.js'
import type { ScopeContext } from '../schemas/data-scope.js'

export interface PaymentRow { id: number; contractId: number; customerId: number; amountCents: number; paidAt: Date; methodCode: string; remark: string | null; creatorId: number | null; updaterId: number | null; createdAt: Date; updatedAt: Date; deletedAt: Date | null }
export interface PaymentListRow extends PaymentRow { contractNo: string; contractName: string; customerName: string }
export interface PaymentListQuery { page?: number; pageSize?: number; keyword?: string; contractId?: number; customerId?: number; methodCode?: string; paidFrom?: Date; paidTo?: Date }
export type CreatePaymentInput = Omit<PaymentRow, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>
export type UpdatePaymentInput = Partial<Pick<PaymentRow, 'amountCents' | 'paidAt' | 'methodCode' | 'remark'>> & { updaterId: number }

export class PaymentRepository {
  static async list(query: PaymentListQuery, scope: ScopeContext, db: AppQueryDb = drizzleDb): Promise<{ rows: PaymentListRow[]; total: number }> {
    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 10
    const conditions: any[] = [isNull(crmPayment.deletedAt), buildListWhere(scope)]
    if (query.contractId !== undefined) conditions.push(eq(crmPayment.contractId, query.contractId))
    if (query.customerId !== undefined) conditions.push(eq(crmPayment.customerId, query.customerId))
    if (query.methodCode) conditions.push(eq(crmPayment.methodCode, query.methodCode))
    if (query.paidFrom) conditions.push(gte(crmPayment.paidAt, query.paidFrom))
    if (query.paidTo) conditions.push(lte(crmPayment.paidAt, query.paidTo))
    if (query.keyword) {
      const value = `%${query.keyword}%`
      conditions.push(or(like(crmPayment.remark, value), like(crmContract.contractNo, value), like(crmContract.name, value), like(crmCustomer.name, value)))
    }
    const where = and(...conditions)
    const [rows, totals] = await Promise.all([
      db.select().from(crmPayment)
        .innerJoin(crmContract, eq(crmPayment.contractId, crmContract.id))
        .innerJoin(crmCustomer, eq(crmPayment.customerId, crmCustomer.id))
        .where(where)
        .orderBy(desc(crmPayment.paidAt), desc(crmPayment.id))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db.select({ total: count() }).from(crmPayment)
        .innerJoin(crmContract, eq(crmPayment.contractId, crmContract.id))
        .innerJoin(crmCustomer, eq(crmPayment.customerId, crmCustomer.id))
        .where(where),
    ])
    return {
      rows: rows.map((row: any) => ({
        ...(row.crm_payment ?? row),
        contractNo: row.crm_contract?.contractNo ?? '',
        contractName: row.crm_contract?.name ?? '',
        customerName: row.crm_customer?.name ?? '',
      })) as PaymentListRow[],
      total: Number(totals[0]?.total ?? 0),
    }
  }
  static async listByContractId(contractId: number, db: AppQueryDb = drizzleDb): Promise<PaymentRow[]> {
    return (await db.select().from(crmPayment).where(and(eq(crmPayment.contractId, contractId), isNull(crmPayment.deletedAt))).orderBy(desc(crmPayment.paidAt))) as PaymentRow[]
  }
  static async findById(id: number, db: AppQueryDb = drizzleDb): Promise<PaymentRow | null> {
    const rows = await db.select().from(crmPayment).where(and(eq(crmPayment.id, id), isNull(crmPayment.deletedAt))).limit(1)
    return (rows[0] as PaymentRow | undefined) ?? null
  }
  static async create(input: CreatePaymentInput, db: AppQueryDb = drizzleDb): Promise<PaymentRow> {
    const result = await db.insert(crmPayment).values(input as any); const payment = await PaymentRepository.findById(Number(result[0].insertId), db)
    if (!payment) throw new Error('Payment insert did not return a row'); return payment
  }
  static async update(id: number, input: UpdatePaymentInput, db: AppQueryDb = drizzleDb): Promise<PaymentRow | null> {
    await db.update(crmPayment).set({ ...input, updatedAt: new Date() } as any).where(and(eq(crmPayment.id, id), isNull(crmPayment.deletedAt))); return PaymentRepository.findById(id, db)
  }
  static async softDelete(id: number, db: AppQueryDb = drizzleDb): Promise<number> {
    const result = await db.update(crmPayment).set({ deletedAt: new Date() }).where(and(eq(crmPayment.id, id), isNull(crmPayment.deletedAt))); return Number(result[0].affectedRows ?? 0)
  }
}
