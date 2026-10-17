/**
 * 草稿参与 System 用户创建事务（Task 5，AI 侧）。
 *
 * 守的是参与者自己的那几件事，System 侧的事务原子性由
 * `packages/core/system-api/test/user-creation-transaction.test.ts` 覆盖：
 *
 *   1. **锁顺序**：先锁会话行，再锁草稿行。第一步读草稿是为了定位会话，
 *      必须是无锁的；会话删除也锁这一行，因此互斥成立。
 *   2. **认领有条件**：版本不符 / 已过期 / `collecting` / 别人正在提交 / 已取消
 *      全部拒绝，且拒绝时草稿状态一个字都不改。
 *   3. **重放不是创建**：`completed` 的草稿返回既有 userId，绝不再次进入创建。
 *   4. **回执不覆盖别人的成功**：`fail` 的状态白名单里没有 `completed`，
 *      `complete` 的白名单只有 `submitting`。
 *   5. **认领一次 = 只创建一次**：同一草稿同一版本被认领之后立刻进入 `submitting`，
 *      第二次认领必然失败。
 *
 * 全部走内存 store：真实并发与行锁由 Task 10 用真实数据库验证。
 */
import { describe, expect, it, vi } from 'vitest'
import { AiUserCreationParticipant } from '../services/user-creation-participant.js'
import { ActionDraftService } from '../services/action-draft.service.js'
import type { ActionDraftRecord, ActionDraftStore, ActionDraftTx } from '../repositories/action-draft.repository.js'
import type { AiAuditRecord } from '../repositories/ai-audit.repository.js'

const OWNER = 7
const CONVERSATION = 'conv-1'
const DRAFT_ID = 'd-1'

const START = new Date('2026-10-17T00:00:00.000Z')

function draft(overrides: Partial<ActionDraftRecord> = {}): ActionDraftRecord {
  return {
    draftId: DRAFT_ID,
    ownerId: OWNER,
    conversationId: CONVERSATION,
    module: 'system',
    action: 'user.create',
    schemaVersion: 1,
    formData: { phone: '13800000000', realName: '张三', deptIds: [10] },
    missingFields: [{ name: 'password', label: '初始密码', required: true, sensitive: true, mustCompleteInForm: true }],
    validationErrors: [],
    draftVersion: 3,
    status: 'ready',
    resultRef: null,
    failureReason: null,
    expiresAt: new Date(START.getTime() + 3600_000),
    createdAt: START,
    updatedAt: START,
    ...overrides,
  }
}

/**
 * 内存 store，外加两样真实数据库才有的东西：
 * `conversations` 让「锁会话行」有对象，`audit` 让回执的审计可断言。
 */
function memoryStore(rows: ActionDraftRecord[] = [draft()]) {
  const conversations = new Map<string, number>([[CONVERSATION, OWNER]])
  const drafts = new Map(rows.map(row => [row.draftId, row]))
  const auditRows: AiAuditRecord[] = []
  const lockOrder: string[] = []
  const find = (ownerId: number, draftId: string) => {
    const row = drafts.get(draftId)
    return row && row.ownerId === ownerId ? row : null
  }
  const compareAndSwap = async (input: Parameters<ActionDraftTx['compareAndSwap']>[0]) => {
    const row = find(input.ownerId, input.draftId)
    if (!row) return false
    if (row.draftVersion !== input.expectedVersion) return false
    if (!input.allowedStatuses.includes(row.status)) return false
    Object.assign(row, input.patch, { draftVersion: row.draftVersion + 1 })
    return true
  }
  const tx: ActionDraftTx = {
    async insert(row) { drafts.set(row.draftId, row); return row },
    async conversationExists(ownerId, conversationId) {
      lockOrder.push(`conversation:${conversationId}`)
      return conversations.get(conversationId) === ownerId
    },
    find: async (ownerId, draftId) => find(ownerId, draftId),
    compareAndSwap,
  }
  const store: ActionDraftStore = {
    insert: async (row) => { drafts.set(row.draftId, row); return row },
    find: async (ownerId, draftId) => find(ownerId, draftId),
    listByConversation: async (ownerId, conversationId) => [...drafts.values()].filter(d => d.ownerId === ownerId && d.conversationId === conversationId),
    compareAndSwap,
    async removeByConversation() {},
    async transaction(fn) { return fn(tx) },
  }
  return { store, drafts, conversations, auditRows, lockOrder, tx }
}

function fixture(rows?: ActionDraftRecord[]) {
  const memory = memoryStore(rows)
  const audit = { write: vi.fn(), writeInTransaction: vi.fn(async (_tx, record: AiAuditRecord) => { memory.auditRows.push(record) }) }
  let clock = START
  const service = new ActionDraftService(memory.store, { now: () => clock, authorize: async () => {} })
  const participant = new AiUserCreationParticipant(service, audit as never, {
    now: () => clock,
    createTx: () => memory.tx,
  })
  return {
    memory, service, participant,
    get row() { return memory.drafts.get(DRAFT_ID)! },
    advance: (ms: number) => { clock = new Date(clock.getTime() + ms) },
  }
}

const SUBMISSION = { draftId: DRAFT_ID, draftVersion: 3 }

describe('认领：锁顺序与状态守卫', () => {
  it('先锁会话行，再动草稿', async () => {
    const f = fixture()
    await f.participant.claim(f.memory.tx as never, OWNER, SUBMISSION)
    expect(f.memory.lockOrder).toEqual([`conversation:${CONVERSATION}`])
    expect(f.row.status).toBe('submitting')
  })

  it('会话不属于当前用户时拒绝，草稿一个字都不改', async () => {
    const f = fixture()
    await expect(f.participant.claim(f.memory.tx as never, 99, SUBMISSION)).rejects.toMatchObject({ statusCode: 404 })
    expect(f.row.status).toBe('ready')
    expect(f.row.draftVersion).toBe(3)
  })

  it('草稿不属于当前用户时 404（不区分「不存在」与「是别人的」）', async () => {
    const f = fixture()
    await expect(f.participant.claim(f.memory.tx as never, 99, SUBMISSION)).rejects.toMatchObject({ statusCode: 404 })
  })

  it('版本不符时 409，且不认领', async () => {
    const f = fixture()
    await expect(f.participant.claim(f.memory.tx as never, OWNER, { draftId: DRAFT_ID, draftVersion: 2 }))
      .rejects.toMatchObject({ statusCode: 409 })
    expect(f.row.status).toBe('ready')
  })

  it('已过期时 409', async () => {
    const f = fixture()
    f.advance(3600_001)
    await expect(f.participant.claim(f.memory.tx as never, OWNER, SUBMISSION)).rejects.toMatchObject({ statusCode: 409 })
    expect(f.row.status).toBe('ready')
  })

  it('collecting（字段未收齐或带格式错误）不允许提交', async () => {
    const f = fixture([draft({ status: 'collecting' })])
    await expect(f.participant.claim(f.memory.tx as never, OWNER, SUBMISSION)).rejects.toMatchObject({ statusCode: 409 })
  })

  it('已取消 / 已过期的草稿不能被迟到提交复活', async () => {
    for (const status of ['cancelled', 'expired'] as const) {
      const f = fixture([draft({ status })])
      await expect(f.participant.claim(f.memory.tx as never, OWNER, SUBMISSION)).rejects.toMatchObject({ statusCode: 409 })
      expect(f.row.status).toBe(status)
    }
  })

  it('别的请求正在提交时给出「重新查询」的可重试提示，而不是让它重发', async () => {
    const f = fixture([draft({ status: 'submitting' })])
    await expect(f.participant.claim(f.memory.tx as never, OWNER, SUBMISSION))
      .rejects.toMatchObject({ statusCode: 409, message: expect.stringContaining('查询') })
  })
})

describe('同草稿同版本只认领一次', () => {
  it('第二次认领必然失败，因此不可能创建两次', async () => {
    const f = fixture()
    const first = await f.participant.claim(f.memory.tx as never, OWNER, SUBMISSION)
    expect(first).toMatchObject({ kind: 'create' })

    await expect(f.participant.claim(f.memory.tx as never, OWNER, SUBMISSION))
      .rejects.toMatchObject({ statusCode: 409 })
    expect(f.row.status).toBe('submitting')
  })

  it('返回的是持久化的草稿字段，而不是任何一次工具调用的返回值', async () => {
    const f = fixture()
    const claim = await f.participant.claim(f.memory.tx as never, OWNER, SUBMISSION)
    expect(claim).toEqual({
      kind: 'create',
      fields: { phone: '13800000000', realName: '张三', deptIds: [10] },
    })
  })

  it('白名单之外的键不会进入 System 的字段组装', async () => {
    const f = fixture([draft({ formData: { phone: '13800000000', password: 'leaked', deptIds: [10] } })])
    const claim = await f.participant.claim(f.memory.tx as never, OWNER, SUBMISSION) as { fields: Record<string, unknown> }
    expect(claim.fields).not.toHaveProperty('password')
  })
})

describe('回执：complete 在事务内写 completed', () => {
  it('成功后草稿进入 completed 并带上结果引用与成功审计', async () => {
    const f = fixture()
    await f.participant.claim(f.memory.tx as never, OWNER, SUBMISSION)
    await f.participant.complete(f.memory.tx as never, OWNER, SUBMISSION, { id: 21 })

    expect(f.row.status).toBe('completed')
    expect(f.row.resultRef).toEqual({ targetType: 'sys_user', targetId: '21' })
    expect(f.memory.auditRows).toHaveLength(1)
    expect(f.memory.auditRows[0]).toMatchObject({ executionStatus: 'success', targetId: '21' })
  })

  it('审计里只有字段名，没有任何表单值或密码材料', async () => {
    const f = fixture()
    await f.participant.claim(f.memory.tx as never, OWNER, SUBMISSION)
    await f.participant.complete(f.memory.tx as never, OWNER, SUBMISSION, { id: 21 })

    const serialized = JSON.stringify(f.memory.auditRows)
    expect(serialized).not.toContain('13800000000')
    expect(serialized).not.toContain('张三')
    expect(serialized).not.toContain('passwordHash')
  })

  it('回执不满足条件时抛错 —— System 借此整体回滚', async () => {
    const f = fixture()
    await f.participant.claim(f.memory.tx as never, OWNER, SUBMISSION)
    f.row.status = 'ready' // 模拟事务里状态被外力改掉

    await expect(f.participant.complete(f.memory.tx as never, OWNER, SUBMISSION, { id: 21 }))
      .rejects.toMatchObject({ statusCode: 409 })
    expect(f.row.status).not.toBe('completed')
  })
})

describe('重放：已完成草稿只回读既有结果', () => {
  it('completed 草稿返回既有 userId，不再进入创建', async () => {
    const f = fixture([draft({ status: 'completed', resultRef: { targetType: 'sys_user', targetId: '21' } })])
    await expect(f.participant.claim(f.memory.tx as never, OWNER, { draftId: DRAFT_ID, draftVersion: 1 }))
      .resolves.toEqual({ kind: 'replay', userId: 21 })
    // 重放不推进版本，也不改任何状态。
    expect(f.row.draftVersion).toBe(3)
  })

  it('completed 优先于版本判定：重复点击带旧版本号也要拿到结果', async () => {
    const f = fixture([draft({ status: 'completed', draftVersion: 9, resultRef: { targetType: 'sys_user', targetId: '21' } })])
    await expect(f.participant.claim(f.memory.tx as never, OWNER, { draftId: DRAFT_ID, draftVersion: 3 }))
      .resolves.toEqual({ kind: 'replay', userId: 21 })
  })

  it('回执缺失的 completed 草稿被拒绝，而不是凭空重建一个用户', async () => {
    const f = fixture([draft({ status: 'completed', resultRef: null })])
    await expect(f.participant.claim(f.memory.tx as never, OWNER, SUBMISSION)).rejects.toMatchObject({ statusCode: 409 })
  })
})

describe('失败记录：保留可编辑草稿，且不覆盖别人刚提交的成功', () => {
  it('回滚之后按原版本记录 failed，草稿仍可编辑', async () => {
    const f = fixture()
    await f.participant.fail({ actorId: OWNER, submission: SUBMISSION, reason: '手机号已存在' })

    expect(f.row.status).toBe('failed')
    expect(f.row.failureReason).toBe('手机号已存在')
    // failed 在可编辑状态集合里，用户可以改完再提交。
    await f.service.patch(OWNER, DRAFT_ID, f.row.draftVersion, { realName: '李四' })
    expect(f.memory.drafts.get(DRAFT_ID)!.formData.realName).toBe('李四')
  })

  it('版本已变（多半是另一个请求提交成功了）时什么也不写', async () => {
    const f = fixture([draft({ draftVersion: 4, status: 'completed', resultRef: { targetType: 'sys_user', targetId: '21' } })])
    await f.participant.fail({ actorId: OWNER, submission: SUBMISSION, reason: '越权' })

    expect(f.row.status).toBe('completed')
    expect(f.row.failureReason).toBeNull()
  })

  it('记录失败本身抛错不影响调用方（原始业务错误才是要显示的）', async () => {
    const f = fixture()
    vi.spyOn(f.service, 'markFailedAfterRollback').mockRejectedValue(new Error('audit down'))
    await expect(f.participant.fail({ actorId: OWNER, submission: SUBMISSION, reason: 'x' })).resolves.toBeUndefined()
  })

  it('失败原因不含密码：只记录业务消息', async () => {
    const f = fixture()
    await f.participant.fail({ actorId: OWNER, submission: SUBMISSION, reason: '密码强度不足' })
    expect(f.row.failureReason).toBe('密码强度不足')
    expect(JSON.stringify(f.row)).not.toContain('passwordHash')
  })
})
