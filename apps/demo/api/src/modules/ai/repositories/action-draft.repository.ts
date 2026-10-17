/**
 * action-draft.repository.ts — 草稿的**唯一** SQL 出口。
 *
 * Service 层不碰 `drizzleDb`（与本模块 ai-chat 仓储同一条规矩）。仓储负责三件事：
 *
 * 1. **归属谓词**：每一条读、改、删都带 `owner_id`（必要时再带 `conversation_id`）。
 *    查不到就是查不到 —— 调用方拿到的永远是「不存在」，不会知道别人的草稿存在。
 * 2. **compare-and-swap**：`UPDATE ... WHERE draft_version = expected AND status IN (...)`。
 *    行锁给互斥，但**版本号才是对外的并发契约**：两个标签页拿着同一个版本号，
 *    只有一个能改成功，另一个拿到零行并被上层翻译成 409。
 * 3. **锁顺序**：事务里固定「先会话行，再草稿行」。删除会话与提交草稿因此可以互斥：
 *    删除事务先锁住会话行，任何并发的提交都拿不到同一个会话行，只能等到删除完成后
 *    发现会话已经不在。
 */
import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import type { AppQueryDb } from '@yishan/core-system-api/database'
import { aiActionDrafts, aiConversations } from '../db/schema.js'
import type { ActionDraftResultRef, ActionDraftStatus } from '../schemas/action-draft.schema.js'

export interface ActionDraftRecord {
  draftId: string
  ownerId: number
  conversationId: string
  module: string
  action: string
  schemaVersion: number
  formData: Record<string, unknown>
  missingFields: { name: string; label: string; required: boolean; sensitive: boolean; mustCompleteInForm: boolean }[]
  validationErrors: { field: string; label: string; code: string; message: string }[]
  draftVersion: number
  status: ActionDraftStatus
  resultRef: ActionDraftResultRef | null
  failureReason: string | null
  expiresAt: Date
  createdAt: Date
  updatedAt: Date
}

export interface ActionDraftCompareSwapInput {
  ownerId: number
  draftId: string
  expectedVersion: number
  allowedStatuses: readonly ActionDraftStatus[]
  patch: Partial<Omit<ActionDraftRecord, 'draftId' | 'ownerId'>>
}

/**
 * 事务级句柄。刻意只暴露几件事：会话行锁的确认、草稿归属读取与 CAS。
 * 它**不**暴露 `insert` / `removeByConversation` —— 事务内部不应该凭空多出一张草稿。
 *
 * `find` 与 `peek` 的区别不是风格，是正确性：
 *
 * - `peek` 是**一致性读**（InnoDB REPEATABLE READ 下的快照读）。它读的是事务开始
 *   时的快照，不加锁。**只能**用来定位 `conversationId` 这类不可变的定位信息，
 *   绝不能拿它的结果做「能不能提交」的判定。
 * - `find` 是**当前读**（`FOR UPDATE`）。它读到的是最新已提交的值，并持有行锁。
 *   所有提交相关的判定都必须走它。
 *
 * 在 REPEATABLE READ 下混用两者会直接坏掉幂等性：并发请求 B 阻塞在会话行锁上之后，
 * 若用 `peek` 重读草稿，读到的仍是 A 提交之前的 `ready/v3`，于是 B 会跳过
 * 「completed → replay」与「submitting → 重新查询」两条分支，直到 CAS 才发现零行，
 * 把一次本该返回既有用户的重放变成 409。
 */
export interface ActionDraftTx {
  conversationExists(ownerId: number, conversationId: string): Promise<boolean>
  insert(draft: ActionDraftRecord): Promise<ActionDraftRecord>
  /** 无锁快照读。仅用于在拿到会话行锁之前定位 `conversationId`。 */
  peek(ownerId: number, draftId: string): Promise<ActionDraftRecord | null>
  /** 加行锁的当前读。所有提交判定都用它。 */
  find(ownerId: number, draftId: string): Promise<ActionDraftRecord | null>
  compareAndSwap(input: ActionDraftCompareSwapInput): Promise<boolean>
}

export interface ActionDraftStore {
  insert(draft: ActionDraftRecord): Promise<ActionDraftRecord>
  find(ownerId: number, draftId: string): Promise<ActionDraftRecord | null>
  listByConversation(ownerId: number, conversationId: string): Promise<ActionDraftRecord[]>
  compareAndSwap(input: ActionDraftCompareSwapInput): Promise<boolean>
  /** 会话删除时清理草稿；有草稿正在提交时拒绝删除（抛 statusCode 409）。 */
  removeByConversation(ownerId: number, conversationId: string): Promise<void>
  /** 传入 `lock` 时先锁会话行（锁顺序：会话 → 草稿），再交给 `fn` 操作草稿。 */
  transaction<T>(fn: (tx: ActionDraftTx) => Promise<T>, lock?: { ownerId: number; conversationId: string }): Promise<T>
}

/** 事务内锁会话行：顺序约定的第一步，也让删除与提交天然互斥。 */
function lockConversation(tx: AppQueryDb, ownerId: number, conversationId: string) {
  return tx.select({ id: aiConversations.id })
    .from(aiConversations)
    .where(and(eq(aiConversations.ownerId, ownerId), eq(aiConversations.id, conversationId)))
    .for('update')
}

/**
 * 把一个**已经由 System 开启**的事务句柄包装成草稿句柄。
 *
 * Task 5 的用户创建需要「业务创建 + 草稿回执」同事务，而事务由 System 的
 * `UserRepository.transaction()` 开启；`ActionDraftStore.transaction()` 会自己开一个
 * 新事务，在里面做就等于把回执移出创建的事务。因此这里公开同一套事务内操作，
 * 复用**完全相同**的 SQL —— 不存在第二份草稿读写实现可以与上面那份产生分歧。
 */
export function createActionDraftTx(db: AppQueryDb): ActionDraftTx {
  return txHandle(db)
}

function txHandle(db: AppQueryDb): ActionDraftTx {
  return {
    // 事务内一律加行锁：读一遍不锁等于把提交与删除的互斥交给运气。
    async conversationExists(ownerId, conversationId) {
      const [row] = await lockConversation(db, ownerId, conversationId)
      return Boolean(row)
    },
    async insert(draft) {
      await db.insert(aiActionDrafts).values(draft)
      return draft
    },
    async peek(ownerId, draftId) {
      const [row] = await db.select().from(aiActionDrafts)
        .where(and(eq(aiActionDrafts.ownerId, ownerId), eq(aiActionDrafts.draftId, draftId))).limit(1)
      return row ?? null
    },
    async find(ownerId, draftId) {
      // `for update` 是这里的关键：它把这次读变成**当前读**，读到的是最新已提交值。
      // 少了它，REPEATABLE READ 下的重读会退回事务开始时的快照，并发重放因此会
      // 错过 `completed` 分支而变成 409。
      const [row] = await db.select().from(aiActionDrafts)
        .where(and(eq(aiActionDrafts.ownerId, ownerId), eq(aiActionDrafts.draftId, draftId)))
        .limit(1).for('update')
      return row ?? null
    },
    compareAndSwap: input => compareAndSwap(db, input),
  }
}

async function compareAndSwap(db: AppQueryDb, input: ActionDraftCompareSwapInput): Promise<boolean> {
  if (!input.allowedStatuses.length) return false
  // 版本号 + 状态白名单都进 WHERE：零行不是「失败」，而是「你不是当前版本 / 当前状态
  // 不再允许这个操作」。上层据此区分 404 / 409，绝不把它当成行不存在。
  const [result] = await db.update(aiActionDrafts)
    .set({ ...input.patch, draftVersion: sql`${aiActionDrafts.draftVersion} + 1`, updatedAt: new Date() })
    .where(and(
      eq(aiActionDrafts.ownerId, input.ownerId),
      eq(aiActionDrafts.draftId, input.draftId),
      eq(aiActionDrafts.draftVersion, input.expectedVersion),
      inArray(aiActionDrafts.status, [...input.allowedStatuses]),
    ))
  return Boolean(result.affectedRows)
}

export class ActionDraftRepository implements ActionDraftStore {
  constructor(private readonly db: AppQueryDb) {}

  async insert(draft: ActionDraftRecord) {
    await this.db.insert(aiActionDrafts).values(draft)
    return draft
  }

  async find(ownerId: number, draftId: string) {
    const [row] = await this.db.select().from(aiActionDrafts)
      .where(and(eq(aiActionDrafts.ownerId, ownerId), eq(aiActionDrafts.draftId, draftId))).limit(1)
    return row ?? null
  }

  async listByConversation(ownerId: number, conversationId: string) {
    return this.db.select().from(aiActionDrafts)
      .where(and(eq(aiActionDrafts.ownerId, ownerId), eq(aiActionDrafts.conversationId, conversationId)))
      .orderBy(asc(aiActionDrafts.createdAt))
  }

  compareAndSwap(input: ActionDraftCompareSwapInput) {
    return compareAndSwap(this.db, input)
  }

  async removeByConversation(ownerId: number, conversationId: string) {
    await this.db.transaction(async tx => {
      // 锁顺序：先会话行。没有这一步，删除与并发的提交会互相穿插。
      await lockConversation(tx, ownerId, conversationId)
      const [submitting] = await tx.select({ draftId: aiActionDrafts.draftId }).from(aiActionDrafts)
        .where(and(
          eq(aiActionDrafts.ownerId, ownerId),
          eq(aiActionDrafts.conversationId, conversationId),
          eq(aiActionDrafts.status, 'submitting'),
        )).limit(1)
      if (submitting) throw aiConflict('该会话有草稿正在提交，请等待提交结束后再删除会话')
      await tx.delete(aiActionDrafts).where(and(eq(aiActionDrafts.ownerId, ownerId), eq(aiActionDrafts.conversationId, conversationId)))
    })
  }

  async transaction<T>(fn: (tx: ActionDraftTx) => Promise<T>, lock?: { ownerId: number; conversationId: string }): Promise<T> {
    return this.db.transaction(async tx => {
      // 锁顺序在这里被固化：任何走本方法的写路径都先锁会话行。
      if (lock) await lockConversation(tx, lock.ownerId, lock.conversationId)
      return fn(txHandle(tx as AppQueryDb))
    })
  }
}

function aiConflict(message: string): Error {
  return Object.assign(new Error(message), { statusCode: 409 })
}
