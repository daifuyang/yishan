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
import { MySqlDialect } from 'drizzle-orm/mysql-core'
import { AiUserCreationParticipant } from '../services/user-creation-participant.js'
import { AiDepartmentCreationParticipant } from '../services/department-creation-participant.js'
import { ActionDraftService } from '../services/action-draft.service.js'
import { createActionDraftTx } from '../repositories/action-draft.repository.js'
import type { ActionDraftRecord, ActionDraftStore, ActionDraftTx } from '../repositories/action-draft.repository.js'
import type { AiAuditRecord } from '../repositories/ai-audit.repository.js'

const dialect = new MySqlDialect({ casing: {} as never })

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
    // 普通内存 store 里 peek 与 find 没有区别；语义化的 store（snapshotStore）会区分。
    peek: async (ownerId, draftId) => find(ownerId, draftId),
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
    __createTxForTest: () => memory.tx,
  })
  return {
    memory, service, participant,
    get row() { return memory.drafts.get(DRAFT_ID)! },
    advance: (ms: number) => { clock = new Date(clock.getTime() + ms) },
  }
}

const SUBMISSION = { draftId: DRAFT_ID, draftVersion: 3 }

describe('认领：锁顺序与状态守卫', () => {
  it('部门复用认领和成功回执协议，重复提交返回既有部门', async () => {
    const memory = memoryStore([draft({ action: 'department.create', formData: { name: '研发部', sort_order: 2 }, missingFields: [] })])
    const service = new ActionDraftService(memory.store, { now: () => START })
    const audit = { writeInTransaction: vi.fn(async () => {}) }
    const participant = new AiDepartmentCreationParticipant(service, audit as never, { now: () => START, __createTxForTest: () => memory.tx })
    expect(await participant.claim(memory.tx as never, OWNER, SUBMISSION)).toEqual({ kind: 'create', fields: { name: '研发部', sort_order: 2 } })
    await participant.complete(memory.tx as never, OWNER, SUBMISSION, { id: 42 })
    expect(memory.drafts.get(DRAFT_ID)?.resultRef).toEqual({ targetType: 'sys_dept', targetId: '42' })
    expect(await participant.claim(memory.tx as never, OWNER, SUBMISSION)).toEqual({ kind: 'replay', departmentId: 42 })
  })
  it('拒绝用部门草稿提交用户创建', async () => {
    const f = fixture([draft({ action: 'department.create' })])
    await expect(f.participant.claim(f.memory.tx as never, OWNER, SUBMISSION)).rejects.toThrow('表单目标')
    expect(f.row.status).toBe('ready')
  })
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

/**
 * **REPEATABLE READ 语义**的 store。
 *
 * 普通内存 store 抓不到这一类 bug：它的每一次读都返回最新值，于是「重读」看起来总是
 * 正确的。真实 MySQL 不是这样 —— 默认隔离级别是 REPEATABLE READ
 * （`packages/core/database` 与 system-api 都没有设置 `isolationLevel`），事务里的
 * **一致性读**返回的是该事务快照里的值，只有 `FOR UPDATE` / UPDATE 这类**当前读**
 * 才看得到最新已提交数据。
 *
 * 这里的建模：
 *   - `peek`（一致性读）在事务的第一次读时固定快照，此后**永远**返回那份旧值；
 *   - `find`（`FOR UPDATE` 当前读）返回最新已提交值；
 *   - `conversationExists` 在返回前跑完「另一个事务」的完整提交 —— 这正是
 *     「B 阻塞在会话行锁上，A 持锁提交完之后 B 才继续」的时间线。
 *
 * 缺了 `find` 上的 `for update`，B 会在自己的快照里看到 `ready/v3`，跳过
 * `completed → replay` 与 `submitting → 重新查询` 两条分支，直到 CAS 才发现零行 ——
 * 一次本该返回既有用户的重放变成 409。下面两条用例把这条时间线钉死。
 */
function snapshotStore(initial: ActionDraftRecord) {
  const live = new Map<string, ActionDraftRecord>([[initial.draftId, structuredClone(initial)]])
  const clone = (row: ActionDraftRecord | null | undefined) => (row ? structuredClone(row) : null)
  const read = (ownerId: number, draftId: string) => {
    const row = live.get(draftId)
    return row && row.ownerId === ownerId ? clone(row) : null
  }
  const cas = async (input: Parameters<ActionDraftTx['compareAndSwap']>[0]) => {
    const row = live.get(input.draftId)
    if (!row || row.ownerId !== input.ownerId) return false
    if (row.draftVersion !== input.expectedVersion) return false
    if (!input.allowedStatuses.includes(row.status)) return false
    Object.assign(row, input.patch, { draftVersion: row.draftVersion + 1 })
    return true
  }

  /** 另一个请求（A）在 B 阻塞期间跑完的完整提交：claim → complete。 */
  const commitByOtherRequest = async () => {
    const before = clone(live.get(DRAFT_ID)!)
    await cas({
      ownerId: OWNER, draftId: DRAFT_ID, expectedVersion: before.draftVersion,
      allowedStatuses: ['ready', 'previewing', 'failed'],
      patch: { status: 'submitting', failureReason: null },
    })
    const mid = clone(live.get(DRAFT_ID)!)
    await cas({
      ownerId: OWNER, draftId: DRAFT_ID, expectedVersion: mid.draftVersion,
      allowedStatuses: ['submitting'],
      patch: { status: 'completed', resultRef: { targetType: 'sys_user', targetId: '21' } },
    })
  }

  const tx = (): ActionDraftTx => {
    // 事务快照在第一次**一致性读**时固定，之后不再更新。
    let snapshot: ActionDraftRecord | null | undefined
    return {
      insert: async (row) => { live.set(row.draftId, row); return row },
      conversationExists: async (ownerId, conversationId) => {
        // B 在这里等待会话行锁；A 持有它并提交完毕之后，B 才继续。
        if (conversationId === CONVERSATION && ownerId === OWNER) await commitByOtherRequest()
        return ownerId === OWNER
      },
      peek: async (ownerId, draftId) => {
        if (snapshot === undefined) snapshot = read(ownerId, draftId)
        return clone(snapshot)
      },
      find: async (ownerId, draftId) => read(ownerId, draftId),
      compareAndSwap: cas,
    }
  }

  const store: ActionDraftStore = {
    insert: async (row) => { live.set(row.draftId, row); return row },
    find: async (ownerId, draftId) => read(ownerId, draftId),
    listByConversation: async () => [...live.values()].map(clone) as ActionDraftRecord[],
    compareAndSwap: cas,
    removeByConversation: async () => {},
    transaction: async fn => fn(tx()),
  }

  return { store, live, tx, snapshotOf: () => clone(live.get(DRAFT_ID)!), newTx: tx }
}

function snapshotFixture() {
  const s = snapshotStore(draft())
  const service = new ActionDraftService(s.store, { now: () => START, authorize: async () => {} })
  const participant = new AiUserCreationParticipant(service, { write: async () => {}, writeInTransaction: async () => {} } as never, {
    now: () => START,
    __createTxForTest: () => s.tx(),
  })
  return { ...s, participant }
}

describe('REPEATABLE READ 下的并发重放（快照 vs 当前读）', () => {
  it('同一草稿同一版本并发提交：只创建一次，第二个请求 replay 出既有用户而不是 409', async () => {
    const f = snapshotFixture()
    // B 先做一致性读，把自己的快照固定在 A 提交之前。
    const txB = f.tx()
    await txB.peek(OWNER, DRAFT_ID)

    // B 认领：A 在 B 阻塞于会话行锁期间完成了 claim + complete。
    const claim = await f.participant.claim(txB as never, OWNER, SUBMISSION)

    // 只有这一个用户被创建过；B 走的是 replay 分支。
    expect(claim).toEqual({ kind: 'replay', userId: 21 })
    expect(f.snapshotOf()).toMatchObject({ status: 'completed', draftVersion: 5 })
  })

  it('锁后重读必须是当前读：一致性读会退回快照并把重放变成 409', async () => {
    // 这条是上面那条的**对照组**：它证明这条用例真的能抓到 bug。
    // 把 `find` 换成快照读（即漏掉 `for update`）之后，同一时间线必然退化。
    const f = snapshotFixture()
    const txB = f.tx()
    // 第一次一致性读固定快照（B 开始）。
    await txB.peek(OWNER, DRAFT_ID)
    // B 在会话行锁上等待；A 持锁并完成 claim + complete 之后 B 才继续。
    await txB.conversationExists(OWNER, CONVERSATION)

    // 快照里仍然是 A 之前的 ready/v3 —— 拿它做判定就会走「可提交」分支。
    expect(await txB.peek(OWNER, DRAFT_ID)).toMatchObject({ status: 'ready', draftVersion: 3 })
    // 而当前读看到的是 A 刚提交的 completed —— 这正是 `find` 的职责。
    expect(await txB.find(OWNER, DRAFT_ID)).toMatchObject({ status: 'completed', draftVersion: 5 })
  })

  it('提交进行中时重放看到 submitting，并给出可重查提示', async () => {
    // 只跑到 claim（不 complete），锁后重读必须看见 submitting 而不是快照里的 ready。
    const s = snapshotStore(draft())
    let concurrent = false
    const baseTx = s.tx()
    const txHandle: ActionDraftTx = {
      ...baseTx,
      conversationExists: async (ownerId, conversationId) => {
        if (!concurrent) {
          concurrent = true
          // A 认领了但还没提交完成：行停在 submitting。
          const row = s.snapshotOf()
          await (txHandle.compareAndSwap as NonNullable<ActionDraftTx['compareAndSwap']>)({
            ownerId: OWNER, draftId: DRAFT_ID, expectedVersion: row.draftVersion,
            allowedStatuses: ['ready'], patch: { status: 'submitting' },
          })
        }
        return ownerId === OWNER && conversationId === CONVERSATION
      },
    }
    const service = new ActionDraftService(s.store, { now: () => START, authorize: async () => {} })
    const participant = new AiUserCreationParticipant(service, { write: async () => {}, writeInTransaction: async () => {} } as never, {
      now: () => START,
      __createTxForTest: () => txHandle,
    })

    await expect(participant.claim(txHandle as never, OWNER, SUBMISSION))
      .rejects.toMatchObject({ statusCode: 409, message: expect.stringContaining('查询') })
  })
})

/**
 * 把上面的行为断言绑到**真实**的 SQL 上。
 *
 * snapshotStore 建模的是语义，但它是测试替身 —— 真实的 `createActionDraftTx` 里
 * 少写一个 `for('update')`，行为测试照样全绿。这条断言直接检查真实仓储发出的查询：
 * `find` 必须是 `FOR UPDATE` 的当前读，`peek` 必须不是。这两者的区别就是 REPEATABLE READ
 * 下「重读会不会退回快照」的全部。
 */
describe('真实仓储发出的 SQL：find 是当前读，peek 是快照读', () => {
  function recordingDb(trace: string[]) {
    const builder = {
      from: () => builder,
      where: (cond: unknown) => { trace.push(dialect.sqlToQuery(cond as never).sql); return builder },
      limit: () => builder,
      for: (mode: string) => { trace.push(`FOR:${mode}`); return builder },
      // thenable：仓库里的 `await ... .for('update')` 需要一个可解构的行数组。
      then: (resolve: (value: unknown[]) => unknown) => Promise.resolve(resolve([])),
    }
    return { select: () => builder } as never
  }

  it('find 发出 FOR UPDATE（当前读）', async () => {
    const trace: string[] = []
    await createActionDraftTx(recordingDb(trace)).find(OWNER, DRAFT_ID)
    expect(trace).toContain('FOR:update')
  })

  it('peek 不带 FOR UPDATE（一致性读）', async () => {
    const trace: string[] = []
    await createActionDraftTx(recordingDb(trace)).peek(OWNER, DRAFT_ID)
    expect(trace).not.toContain('FOR:update')
  })

  it('会话锁也是 FOR UPDATE —— 锁顺序的第一环', async () => {
    const trace: string[] = []
    await createActionDraftTx(recordingDb(trace)).conversationExists(OWNER, CONVERSATION)
    expect(trace).toContain('FOR:update')
  })
})

describe('测试接缝在生产环境会被显式拒绝', () => {
  it('NODE_ENV !== test 时注入事务句柄工厂直接抛错', () => {
    const f = fixture()
    const previous = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    try {
      expect(() => new AiUserCreationParticipant(f.service, {} as never, {
        __createTxForTest: () => f.memory.tx,
      })).toThrow(/test-only/)
    } finally {
      process.env.NODE_ENV = previous
    }
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
