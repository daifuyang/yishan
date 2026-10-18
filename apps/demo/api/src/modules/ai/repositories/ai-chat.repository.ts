import { and, asc, desc, eq, gt, isNull, lt, or } from 'drizzle-orm'
import type { AppQueryDb } from '@yishan/core-system-api/database'
import type { ChatMessage } from '../schemas/ai-chat.schema.js'
import { aiConversations, aiMessages } from '../db/schema.js'
import { aiError } from '../ai-chat-error.js'

export type { ChatMessage } from '../schemas/ai-chat.schema.js'
export interface AiConversation { id: string; ownerId: number; title: string; createdAt: Date; updatedAt: Date }
export interface AiChatStore {
  list(ownerId: number): Promise<AiConversation[]>
  find(ownerId: number, id: string): Promise<AiConversation | null>
  create(conversation: AiConversation): Promise<AiConversation>
  rename(ownerId: number, id: string, title: string): Promise<void>
  remove(ownerId: number, id: string): Promise<void>
  messages(ownerId: number, id: string): Promise<ChatMessage[]>
  acquire(ownerId: number, id: string, token: string): Promise<boolean>
  isActive(ownerId: number): Promise<boolean>
  begin(ownerId: number, id: string, token: string, messages: ChatMessage[]): Promise<void>
  finish(ownerId: number, id: string, token: string, messages: ChatMessage[]): Promise<void>
  release(ownerId: number, id: string, token: string): Promise<void>
}

export class AiChatRepository implements AiChatStore {
  constructor(private readonly db: AppQueryDb) {}
  async list(ownerId: number) {
    return this.db.select().from(aiConversations).where(eq(aiConversations.ownerId, ownerId)).orderBy(desc(aiConversations.updatedAt)).limit(100)
  }
  async find(ownerId: number, id: string) {
    const [row] = await this.db.select().from(aiConversations).where(and(eq(aiConversations.ownerId, ownerId), eq(aiConversations.id, id))).limit(1)
    return row ?? null
  }
  async create(conversation: AiConversation) { await this.db.insert(aiConversations).values(conversation); return conversation }
  async rename(ownerId: number, id: string, title: string) {
    const [result] = await this.db.update(aiConversations).set({ title, updatedAt: new Date() }).where(and(eq(aiConversations.ownerId, ownerId), eq(aiConversations.id, id), or(isNull(aiConversations.activeOwner), lt(aiConversations.leaseExpiresAt, new Date()))))
    if (!result.affectedRows) throw aiError(409, '对话正在生成，请稍后重试')
  }
  async remove(ownerId: number, id: string) {
    const [result] = await this.db.delete(aiConversations).where(and(eq(aiConversations.ownerId, ownerId), eq(aiConversations.id, id), or(isNull(aiConversations.activeOwner), lt(aiConversations.leaseExpiresAt, new Date()))))
    if (!result.affectedRows) throw aiError(409, '对话正在生成，请稍后重试')
  }
  async messages(ownerId: number, id: string): Promise<ChatMessage[]> {
    const rows = await this.db.select({ message: aiMessages.message }).from(aiMessages)
      .innerJoin(aiConversations, eq(aiMessages.conversationId, aiConversations.id))
      .where(and(eq(aiConversations.ownerId, ownerId), eq(aiMessages.conversationId, id))).orderBy(asc(aiMessages.position))
    return rows.map(row => row.message)
  }
  async acquire(ownerId: number, id: string, token: string): Promise<boolean> {
    const now = new Date()
    await this.db.update(aiConversations).set({ activeOwner: null, generationToken: null, leaseExpiresAt: null })
      .where(and(eq(aiConversations.ownerId, ownerId), lt(aiConversations.leaseExpiresAt, now)))
    try {
      // A nullable unique owner lease also serializes requests across API instances.
      const [acquired] = await this.db.update(aiConversations).set({ activeOwner: ownerId, generationToken: token, leaseExpiresAt: new Date(now.getTime() + 180000) })
        .where(and(eq(aiConversations.ownerId, ownerId), eq(aiConversations.id, id), isNull(aiConversations.activeOwner)))
      return acquired.affectedRows === 1
    } catch (error) {
      if (isDuplicate(error)) return false
      throw error
    }
  }
  async isActive(ownerId: number) {
    const [row] = await this.db.select({ id: aiConversations.id }).from(aiConversations).where(and(eq(aiConversations.activeOwner, ownerId), gt(aiConversations.leaseExpiresAt, new Date()))).limit(1)
    return Boolean(row)
  }
  async begin(ownerId: number, id: string, token: string, messages: ChatMessage[]) { await this.save(ownerId, id, token, messages, false) }
  async finish(ownerId: number, id: string, token: string, messages: ChatMessage[]) { await this.save(ownerId, id, token, messages, true) }
  private async save(ownerId: number, id: string, token: string, messages: ChatMessage[], finish: boolean) {
    await this.db.transaction(async tx => {
      const [row] = await tx.select().from(aiConversations).where(and(eq(aiConversations.ownerId, ownerId), eq(aiConversations.id, id), eq(aiConversations.generationToken, token))).for('update')
      if (!row) throw new Error('AI generation lease expired')
      await tx.delete(aiMessages).where(eq(aiMessages.conversationId, id))
      if (messages.length) await tx.insert(aiMessages).values(messages.map((message, position) => ({ conversationId: id, id: message.id, position, message })))
      const first = messages.find(message => message.role === 'user')?.parts.find(part => part.type === 'text')
      await tx.update(aiConversations).set({ updatedAt: new Date(), ...(row.title === '新对话' && first?.type === 'text' ? { title: first.text.trim().slice(0, 50) } : {}), ...(finish ? { activeOwner: null, generationToken: null, leaseExpiresAt: null } : {}) }).where(eq(aiConversations.id, id))
    })
  }
  async release(ownerId: number, id: string, token: string) {
    await this.db.update(aiConversations).set({ activeOwner: null, generationToken: null, leaseExpiresAt: null }).where(and(eq(aiConversations.ownerId, ownerId), eq(aiConversations.id, id), eq(aiConversations.generationToken, token)))
  }
}

function isDuplicate(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  if ('code' in error && error.code === 'ER_DUP_ENTRY') return true
  return 'cause' in error && isDuplicate(error.cause)
}
