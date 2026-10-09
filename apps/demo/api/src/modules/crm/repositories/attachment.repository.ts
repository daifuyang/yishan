import { and, eq } from 'drizzle-orm'
import { drizzleDb } from '@yishan/core-system-api/database'
import { crmAttachment } from '../db/schema'

export const CrmAttachmentRepository = {
  list(customerId: number) {
    return drizzleDb.select().from(crmAttachment).where(eq(crmAttachment.customerId, customerId))
  },
  async find(id: number) {
    const [row] = await drizzleDb.select().from(crmAttachment).where(eq(crmAttachment.id, id))
    return row ?? null
  },
  async create(input: Omit<typeof crmAttachment.$inferInsert, 'id' | 'createdAt'>) {
    const [inserted] = await drizzleDb.insert(crmAttachment).values(input).$returningId()
    return this.find(inserted.id)
  },
  async remove(id: number, customerId: number) {
    await drizzleDb.delete(crmAttachment).where(and(eq(crmAttachment.id, id), eq(crmAttachment.customerId, customerId)))
  },
}
