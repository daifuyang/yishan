import { and, desc, eq, isNull } from 'drizzle-orm'
import { drizzleDb, type AppQueryDb } from '@/db'
import { crmPayment } from '../db/schema.js'

export interface PaymentRow { id: number; contractId: number; customerId: number; amountCents: number; paidAt: Date; methodCode: string; remark: string | null; creatorId: number | null; updaterId: number | null; createdAt: Date; updatedAt: Date; deletedAt: Date | null }
export type CreatePaymentInput = Omit<PaymentRow, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>
export type UpdatePaymentInput = Partial<Pick<PaymentRow, 'amountCents' | 'paidAt' | 'methodCode' | 'remark'>> & { updaterId: number }

export class PaymentRepository {
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
