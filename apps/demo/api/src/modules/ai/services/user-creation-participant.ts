/**
 * user-creation-participant.ts — AI 草稿参与 System 用户创建事务的实现。
 *
 * System 不知道草稿表长什么样，AI 模块也不碰 `sys_*`。两侧只通过
 * `UserCreationParticipant`（System 的公开契约）握手，事务由 System 开启、
 * 两个模块各自在**同一个事务**里写自己的表（设计 §11）。
 *
 * 四条不可放宽的规则：
 *
 * 1. **锁顺序固定为「先会话行、再草稿行」**。会话删除走
 *    `ActionDraftService.removeConversationDrafts`，它也先锁会话行，因此删除与提交
 *    不可能互相穿插。第一步为了拿到 `conversationId` 会先读一次草稿 —— 那是
 *    **无锁**读，只为定位会话；在拿到会话行锁之前从不持有任何草稿行锁。
 * 2. **没有事务外的 `submitting`**。`submitting` 只能由 `claim` 在 System 持有
 *    行锁的事务里写入；进程崩溃时数据库回滚把它一并撤销，不留租约残骸。
 * 3. **`completed` 只能由完整事务提交**。`claim` 看到 `completed` 时返回
 *    `replay`，让 System 回读既有结果而不是再创建一次。
 * 4. **不存任何密码材料**。回执只有 `targetType` / `targetId`，因此可以安全地
 *    作为重复提交的幂等凭据。
 */
import { randomUUID } from 'node:crypto'
import type { AppTx } from '@yishan/core-system-api/database'
import {
  USER_CREATE_DRAFT_FIELD_KEYS,
  type DraftSubmissionFailure,
  type UserCreateDraftFields,
} from '@yishan/core-system-api'
import {
  createActionDraftTx,
  type ActionDraftRecord,
  type ActionDraftTx,
} from '../repositories/action-draft.repository.js'
import { AiAuditRepository, summarizeError, type AiAuditRecord } from '../repositories/ai-audit.repository.js'
import { ActionDraftService } from './action-draft.service.js'
import { aiError } from '../ai-chat-error.js'

/**
 * 允许进入提交的状态。
 *
 * `collecting` **不在其中**：Task 4 起它意味着字段还没收齐或带着未解决的格式错误，
 * 提交这样的草稿只会把「助手以为可以提交」的谎话变成一次注定失败的创建。
 * `completed` / `cancelled` / `expired` 也不在其中，迟到的提交无法复活一份结束的草稿。
 */
const CLAIMABLE_STATUSES = ['ready', 'previewing', 'failed'] as const

/** 首次由 System 创建时给出的结果形状（只取回执需要的最小字段）。 */
interface CompletionResult {
  id: number
}

export interface AiUserCreationParticipantOptions {
  action?: 'user.create' | 'department.create'
  targetType?: 'sys_user' | 'sys_dept'
  fieldKeys?: readonly string[]
  /**
   * 把 System 交来的事务句柄包装成草稿句柄。
   *
   * 生产路径是 `createActionDraftTx`（真实 SQL）；测试注入内存实现，
   * 断言的仍是同一套「锁会话 → 读草稿 → CAS」的动作序列。
   */
  __createTxForTest?: (tx: AppTx) => ActionDraftTx
  /** 时钟（测试用）。 */
  now?: () => Date
}

export class AiUserCreationParticipant<TFields extends object = UserCreateDraftFields> {
  private readonly createTx: (tx: AppTx) => ActionDraftTx

  constructor(
    private readonly drafts: ActionDraftService,
    private readonly audit: AiAuditRepository,
    private readonly options: AiUserCreationParticipantOptions = {},
  ) {
    // 这个接缝一旦在生产被启用，真实 SQL 就不执行了：会话行锁、草稿行锁与 CAS 的
    // 原子性会**静默**消失，而功能测试全绿。宁可启动即崩，也不要安静地丢掉互斥。
    if (options.__createTxForTest && process.env.NODE_ENV !== 'test') {
      throw new Error('AiUserCreationParticipant.__createTxForTest is test-only and must not be supplied outside NODE_ENV=test')
    }
    this.createTx = options.__createTxForTest ?? (tx => createActionDraftTx(tx as never))
  }

  /** 每个事务句柄只在本次调用内包装一次，不缓存。 */
  private handle(tx: AppTx): ActionDraftTx {
    return this.createTx(tx)
  }

  private now(): Date {
    return this.options.now ? this.options.now() : new Date()
  }

  /**
   * 认领草稿（见契约）。返回的 `fields` 是**持久化在草稿行里**的值，
   * 不是任何一次工具调用的返回值。
   */
  async claim(tx: AppTx, actorId: number, submission: { draftId: string; draftVersion: number }) {
    const handle = this.handle(tx)
    // 第一步：**快照读**（不加锁），只为拿到不可变的 conversationId。
    // 判定绝不能用它的结果 —— REPEATABLE READ 下它可能是事务开始时的旧值。
    const located = await handle.peek(actorId, submission.draftId)
    if (!located) throw aiError(404, '草稿不存在')

    // 第二步：锁会话行。删除会话的守卫也锁这一行，因此从这里开始互斥。
    if (!await handle.conversationExists(actorId, located.conversationId)) {
      throw aiError(404, '会话不存在')
    }

    // 第三步：在会话行锁保护下用**当前读**重读草稿。之前那份是事务开始时的快照，
    // 可能还停在 A 提交之前；当前读才能看见刚提交的 completed / submitting。
    const row = await handle.find(actorId, submission.draftId)
    if (!row) throw aiError(404, '草稿不存在')
    if (row.module !== 'system' || row.action !== (this.options.action ?? 'user.create')) throw aiError(400, '草稿表单目标不匹配')

    // 已完成优先于版本判定：重复点击带的是旧版本号，但它要的是**既有结果**。
    if (row.status === 'completed') {
      const userId = completedUserId(row, this.options.targetType ?? 'sys_user')
      // completed 的回执缺失说明数据被外力破坏；宁可拒绝，也不要凭空重建一个用户。
      if (userId === null) throw aiError(409, '该草稿已完成但缺少结果记录，请联系管理员')
      return { kind: 'replay' as const, userId }
    }

    if (row.expiresAt.getTime() <= this.now().getTime()) {
      throw aiError(409, '草稿已过期，请重新开始填写')
    }
    // 状态判定**先于**版本判定。并发提交会把版本推进一格，因此此时报「版本已更新」
    // 是一句误导：真正的事实是「另一个请求正在提交，去读服务器状态」。
    if (row.status === 'submitting') {
      // 可重查提示：另一个请求正在提交。让客户端去读服务器草稿状态，而不是重发。
      throw aiError(409, '草稿正在提交，请稍后重新查询结果')
    }
    if (row.draftVersion !== submission.draftVersion) {
      throw aiError(409, '草稿版本已更新，请刷新后重试')
    }
    if (!(CLAIMABLE_STATUSES as readonly string[]).includes(row.status)) {
      throw aiError(409, '草稿当前状态不允许提交')
    }

    const claimed = await handle.compareAndSwap({
      ownerId: actorId,
      draftId: row.draftId,
      expectedVersion: row.draftVersion,
      allowedStatuses: CLAIMABLE_STATUSES,
      patch: { status: 'submitting', failureReason: null },
    })
    if (!claimed) throw aiError(409, '草稿状态已变化，请刷新后重试')

    return { kind: 'create' as const, fields: pickDraftFields<TFields>(row, this.options.fieldKeys ?? USER_CREATE_DRAFT_FIELD_KEYS) }
  }

  /**
   * 写成功回执与成功审计，与 System 的用户创建**同一个事务**。
   *
   * 这里刻意**不用** `submission.draftVersion` 做 CAS 条件：`claim` 的 CAS 已经把
   * 版本推进了一格，用旧版本号必然零行。改为在事务内读当前行、用它自己的版本做
   * CAS，并把状态白名单收紧到 `['submitting']` —— 因此它**不可能**覆盖另一个请求
   * 刚提交的 `completed`，也不依赖任何进程内记忆。
   */
  async complete(tx: AppTx, actorId: number, submission: { draftId: string }, user: CompletionResult): Promise<void> {
    const handle = this.handle(tx)
    const row = await handle.find(actorId, submission.draftId)
    if (!row) throw aiError(404, '草稿不存在')
    if (row.status === 'completed') return
    if (row.status !== 'submitting') throw aiError(409, '草稿状态已变化，无法记录提交结果')

    const ok = await handle.compareAndSwap({
      ownerId: actorId,
      draftId: row.draftId,
      expectedVersion: row.draftVersion,
      allowedStatuses: ['submitting'],
      patch: {
        status: 'completed',
        resultRef: { targetType: this.options.targetType ?? 'sys_user', targetId: String(user.id) },
      },
    })
    if (!ok) throw aiError(409, '草稿状态已变化，无法记录提交结果')

    await this.audit.writeInTransaction(tx as never, successAudit(actorId, user.id, this.options.targetType ?? 'sys_user', this.options.action ?? 'user.create'))
  }

  /**
   * 记录明确的业务失败。调用点在**事务回滚之后**（见 `UserService`），
   * 因此草稿此刻已回到原版本与原状态：按 `submission.draftVersion` +
   * 原始可提交状态做 CAS，**匹配不到 `completed`**，也就不会覆盖另一个请求
   * 刚提交的成功结果。
   */
  async fail(failure: DraftSubmissionFailure): Promise<void> {
    try {
      await this.drafts.markFailedAfterRollback(
        failure.actorId,
        failure.submission.draftId,
        failure.submission.draftVersion,
        failure.reason,
      )
    } catch (error) {
      // 记录失败原因失败不影响原始错误；草稿留在原状态仍然可编辑。
      console.error('[ai-draft] record failure failed:', summarizeError(error))
    }
  }
}

function completedUserId(row: ActionDraftRecord, targetType: string): number | null {
  if (row.resultRef?.targetType !== targetType) return null
  const id = Number(row.resultRef.targetId)
  return Number.isInteger(id) && id > 0 ? id : null
}

/**
 * 从持久化的 `formData` 里取白名单字段。
 *
 * 逐键取而不是整个展开：`formData` 是 JSON 列，形状由写入时的白名单保证，
 * 但读取端再过一次白名单，可以让「多出来的键」永远到不了 System 的字段组装。
 */
function pickDraftFields<TFields extends object>(row: ActionDraftRecord, keys: readonly string[]): TFields {
  const out: Record<string, unknown> = {}
  for (const key of keys) {
    const value = row.formData[key]
    if (value === undefined) continue
    out[key] = value
  }
  return out as TFields
}

function successAudit(actorId: number, userId: number, targetType: string, action: string): AiAuditRecord {
  return {
    // 回执里没有 requestId 可用；这里生成一个只为把审计行与这次提交绑在一起。
    requestId: randomUUID(),
    actorId,
    capabilityName: action,
    operationId: targetType === 'sys_dept' ? 'createDept' : 'createUser',
    riskLevel: 'write',
    permissionDecision: 'allowed',
    executionStatus: 'success',
    targetType,
    targetId: String(userId),
    // 只留字段名：绝不把表单值（可能含个人信息）或密码写进审计正文。
    inputDigest: 'draftSubmission',
  }
}
