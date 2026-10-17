/**
 * ai-user-creation.test.ts — AI 助手「收集用户信息 → 原生表单 → 人工确定」的真实数据库验收。
 *
 * 与 `product.test.ts` 共用 `disposable-database.ts` 的夹具（建库 / 连跑两次迁移 /
 * 认证 / 销毁），业务断言各写各的。这里只断言「助手收集信息」这一条链路：
 *
 * - 模型工具**只能**准备草稿，任何调用都不能创建业务记录（约束 1、2）。
 * - 真正的创建只发生在**普通创建 API** 上（约束 3），且要带 `draftSubmission`。
 * - 同一份草稿最多完成一次创建；并发重放返回**既有用户**，不是 409（约束 5）。
 * - 密码永远不进草稿、工具参数、回执与审计（约束 4）。
 *
 * 全部走 `app.inject` 打真实路由、真实 MySQL 事务、真实 InnoDB 行锁。
 * 任何失败路径都**同时**断言「没有新增用户」——一个只断言错误码的测试会漏掉
 * 「报错但仍然建了人」这种最坏情况。
 */
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import type { RowDataPacket } from 'mysql2/promise'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ADMIN_PASSWORD, CREATED_USER_PASSWORD, createDisposableStack, loginHeaders, type DisposableStack } from './disposable-database'

const requireCompiled = createRequire(resolve('dist/app.js'))
const { AiExecutionEnvFactory } = requireCompiled('./modules/ai/services/ai-chat.service.js') as typeof import('../../src/modules/ai/services/ai-chat.service')

const CONVERSATIONS = '/api/ai/v1/conversations'
const CREATE_USER = '/api/v1/admin/users'

/** 唯一手机号：所有断言只查这一行，因此并发下不会互相干扰。 */
let phoneSeq = 0
const nextPhone = () => `199${String(++phoneSeq).padStart(8, '0')}`

interface CountRow extends RowDataPacket { count: number }
interface IdRow extends RowDataPacket { id: number }
interface ResultRow extends RowDataPacket { result_ref: { targetType: string; targetId: string } | null; status: string }
interface AuditRow extends RowDataPacket { count: number }

describe.skipIf(process.env.YISHAN_DEMO_MYSQL_TEST !== '1')('AI 助手在真实 MySQL 上协助创建系统用户', () => {
  let stack: DisposableStack
  let appA: FastifyInstance
  let appB: FastifyInstance
  let admin: { authorization: string }

  beforeAll(async () => {
    stack = await createDisposableStack()
    // 迁移跑两次：第二次必须完全无事可做，否则本文件所有后续断言都建立在流沙上。
    const history = await stack.migrateTwice()
    expect(history.every(result => result.pending.length === 0)).toBe(true)
    appA = await stack.buildInstance()
    appB = await stack.buildInstance()
    await stack.seed(appA)
    admin = await loginHeaders(appA, 'admin', ADMIN_PASSWORD)
  })

  afterAll(async () => { await stack.close() })

  // ---------------------------------------------------------------- 工具

  async function query<T extends RowDataPacket>(sql: string, params: unknown[] = []) {
    const [rows] = await stack.database.pool.query<T[]>(sql, params)
    return rows
  }

  const newConversation = async (app = appA, headers = admin) => {
    const created = await app.inject({ method: 'POST', url: CONVERSATIONS, headers })
    expect(created.statusCode, created.body).toBe(200)
    return created.json<{ data: { id: string } }>().data.id
  }

  /**
   * 走**真实模型工具链**写草稿。
   *
   * 刻意不用 HTTP 的草稿创建端点：模型能走的路径才是要验收的路径，
   * 它经过鉴权、权限重算、schema 校验与审计。
   */
  async function assistantPrepareDraft(conversationId: string, formData: Record<string, unknown>, actorId = 1) {
    return appA.system.run(async () => {
      const user = await appA.system.users.findById(actorId)
      if (!user) throw new Error(`Seed user ${actorId} is missing`)
      const execution = await new AiExecutionEnvFactory({ db: appA.system.database.db }).env(
        { userId: user.id, roleIds: [...user.roleIds], deptIds: [...user.deptIds] },
        { requestId: `integration-${randomUUID()}`, conversationId },
      )
      return execution.execute('prepare_create_user', formData)
    })
  }

  async function draftRow(draftId: string) {
    const rows = await query<ResultRow>('SELECT status, result_ref FROM ai_action_drafts WHERE draft_id = ?', [draftId])
    expect(rows).toHaveLength(1)
    return rows[0]
  }

  /** 本次唯一手机号在 sys_user 里有多少行。 */
  const countUsersByTestPhone = (phone: string) =>
    query<CountRow>('SELECT COUNT(*) AS count FROM sys_user WHERE phone = ?', [phone])
      .then(rows => Number(rows[0].count))

  /** 本次唯一用户名对应的新用户 ID（没有则 null）。 */
  const createdUserId = (username: string) =>
    query<IdRow>('SELECT id FROM sys_user WHERE username = ?', [username])
      .then(rows => (rows.length ? rows[0].id : null))

  /** 草稿成功回执里指向的用户 ID。 */
  const completedResultId = (draftId: string) =>
    draftRow(draftId).then(row => (row.status === 'completed' ? Number(row.result_ref?.targetId) : null))

  /** 这份草稿对应的成功审计条数（只查本次 draftId 关联的用户与能力）。 */
  const successfulDraftAuditCount = (userId: number) =>
    query<AuditRow>(
      "SELECT COUNT(*) AS count FROM ai_audit WHERE execution_status = 'success' AND target_type = 'sys_user' AND target_id = ?",
      [String(userId)],
    ).then(rows => Number(rows[0].count))

  /**
   * 带草稿关联的创建请求 —— 与 `UserForm.onFinish` 发出的那次请求形状一致。
   *
   * 只发密码与草稿关联：其余字段由服务端草稿提供。请求里**不重复**带 `realName`
   * 之类与草稿不同的值，因为那正是 `mergeDraftFields` 刻意要拒绝的形态。
   */
  const submitWithDraft = (
    app: FastifyInstance,
    headers: { authorization: string },
    submission: { draftId: string; draftVersion: number },
    fields: { username: string; phone: string; password?: string },
  ) => app.inject({
    method: 'POST', url: CREATE_USER, headers,
    payload: { username: fields.username, phone: fields.phone, password: fields.password ?? CREATED_USER_PASSWORD, draftSubmission: submission },
  })

  /** 建一份「已收齐」草稿（ready），返回它当前该用的精确版本。 */
  async function readyDraft(conversationId: string, fields: Record<string, unknown>) {
    return readyDraftFor(conversationId, 1, fields)
  }

  async function readyDraftFor(conversationId: string, actorId: number, fields: Record<string, unknown>) {
    const outcome = await assistantPrepareDraft(conversationId, fields, actorId)
    expect(outcome.ok, JSON.stringify(outcome)).toBe(true)
    if (!outcome.ok) throw new Error('unreachable')
    const data = outcome.result.data
    expect(data.status).toBe('ready')
    return { draftId: data.draftId as string, draftVersion: data.draftVersion as number }
  }

  // ------------------------------------------------------------ 用例

  it('applies migrations twice and exposes no model-invocable write capability', async () => {
    const history = await stack.migrateTwice()
    expect(history.map(entry => entry.id).sort()).toEqual([...history.map(entry => entry.id)].sort())
    expect(history.every(entry => entry.pending.length === 0)).toBe(true)

    const conversationId = await newConversation()
    const capabilities = await appA.system.run(async () => {
      const user = await appA.system.users.findById(1)
      const execution = await new AiExecutionEnvFactory({ db: appA.system.database.db }).env(
        { userId: user!.id, roleIds: [...user!.roleIds], deptIds: [...user!.deptIds] },
        { requestId: `integration-${randomUUID()}`, conversationId },
      )
      return execution.capabilities
    })
    const names = capabilities.map(capability => capability.name)
    // 约束 1：模型能看到的工具清单里**没有任何**写业务记录的能力。
    expect(names.some(name => /create_user$|delete_user$|update_user$/.test(name) && name !== 'prepare_create_user' && name !== 'prepare_update_user')).toBe(false)
    expect(capabilities.some(capability => capability.riskLevel === 'write')).toBe(false)
    expect(names).toEqual(expect.arrayContaining(['prepare_create_user', 'update_action_draft', 'get_action_draft']))
    expect(names).not.toContain('create_user')
  })

  it('never lets chat text or a client-sent confirmation create a user, and never stores a password', async () => {
    const conversationId = await newConversation()
    const phone = nextPhone()
    // 约束 4：密码连草稿都进不去 —— 字段白名单在 HTTP 层与 Service 层各拒一次。
    const withPassword = await appA.inject({
      method: 'POST', url: `${CONVERSATIONS}/${conversationId}/drafts`, headers: admin,
      payload: { module: 'system', action: 'user.create', formData: { username: 'nope_password', phone, password: 'ShouldNeverStore123' } },
    })
    expect(withPassword.statusCode, withPassword.body).toBe(400)
    expect(await countUsersByTestPhone(phone)).toBe(0)

    const viaTool = await assistantPrepareDraft(conversationId, { username: 'nope_password', phone, password: 'ShouldNeverStore123' })
    expect(viaTool.ok).toBe(false)

    const draft = await readyDraft(conversationId, { username: 'nope_confirm', phone, realName: '聊天确认' })
    // 草稿行里只有白名单字段：连一列都没有可以藏密码的地方。
    const stored = await query<RowDataPacket>('SELECT form_data FROM ai_action_drafts WHERE draft_id = ?', [draft.draftId])
    expect(JSON.stringify(stored[0].form_data)).not.toContain('ShouldNeverStore123')
    expect(Object.keys(stored[0].form_data as Record<string, unknown>).sort()).toEqual(['phone', 'realName', 'username'])

    // 约束 2：客户端自称「已确认」不是授权。
    // 同一个请求带上 `confirmed: true`，但把草稿指向别人的 ID：额外字段被剥掉，
    // 请求仍然按「草稿不存在」被拒 —— 客户端自称的确认什么也没换来。
    const selfConfirmed = await appA.inject({
      method: 'POST', url: CREATE_USER, headers: admin,
      payload: {
        username: 'nope_confirm', phone, realName: '聊天确认', password: CREATED_USER_PASSWORD,
        draftSubmission: { draftId: 'not-my-draft-at-all', draftVersion: draft.draftVersion, confirmed: true } as never,
      },
    })
    expect(selfConfirmed.json<{ success: boolean }>().success, selfConfirmed.body).toBe(false)
    expect(await countUsersByTestPhone(phone)).toBe(0)

    // 版本号对不上时同样只得到冲突，`confirmed` 没有任何加成。
    const staleVersion = await appA.inject({
      method: 'POST', url: CREATE_USER, headers: admin,
      payload: {
        username: 'nope_confirm', phone, realName: '聊天确认', password: CREATED_USER_PASSWORD,
        draftSubmission: { draftId: draft.draftId, draftVersion: 999, confirmed: true } as never,
      },
    })
    expect(staleVersion.json<{ success: boolean }>().success, staleVersion.body).toBe(false)
    expect(await countUsersByTestPhone(phone)).toBe(0)
  })

  it('creates exactly one user when two independent app instances submit the same draft at once', async () => {
    const conversationId = await newConversation()
    const phone = nextPhone()
    const username = 'concurrent_person'
    const draft = await readyDraft(conversationId, { username, phone, realName: '并发提交' })

    const submitFromAppA = () => submitWithDraft(appA, admin, draft, { username, phone })
    const submitFromAppB = () => submitWithDraft(appB, admin, draft, { username, phone })

    const responses = await Promise.all([submitFromAppA(), submitFromAppB()])
    // 第二个请求必须拿到**既有用户**（replay），而不是 409：同一份草稿只创建一次，
    // 但重复点击要让用户看到成功，而不是一个「你重复提交了」的报错。
        expect(responses.every(response => response.json<{ success: boolean }>().success)).toBe(true)
    const ids = responses.map(response => response.json<{ data: { id: number } }>().data.id)
    expect(new Set(ids).size).toBe(1)

    expect(await countUsersByTestPhone(phone)).toBe(1)
    expect(await completedResultId(draft.draftId)).toBe(await createdUserId(username))
    expect(await successfulDraftAuditCount(ids[0]!)).toBe(1)

    // 响应丢失后的重试：客户端没看到上一次的结果，用同一个版本再发一次。
    const replayed = await submitFromAppB()
    expect(replayed.statusCode, replayed.body).toBe(200)
    expect(replayed.json<{ data: { id: number } }>().data.id).toBe(ids[0])
    expect(await countUsersByTestPhone(phone)).toBe(1)
    expect(await successfulDraftAuditCount(ids[0]!)).toBe(1)
  })

  it('rolls the user and the completed receipt back together when the receipt cannot be written', async () => {
    const conversationId = await newConversation()
    const phone = nextPhone()
    const username = 'rollback_person'
    const draft = await readyDraft(conversationId, { username, phone, realName: '回滚' })

    // 注入的是**失败**，不是替身：事务、行锁、CAS 与回滚全部是真的，
    // 只是成功回执在事务内抛错，因此必须把已经 INSERT 进去的用户一起带走。
    const runtime = appA.system
    const participant = runtime.options.userCreationParticipant
    if (!participant) throw new Error('The AI module must install a user creation participant')
    const original = runtime.options.userCreationParticipant
    runtime.options.userCreationParticipant = {
      claim: (tx, actorId, submission) => participant.claim(tx, actorId, submission),
      complete: async () => { throw new Error('injected receipt failure') },
    }
    try {
      const failed = await submitWithDraft(appA, admin, draft, { username, phone })
      expect(failed.statusCode, failed.body).toBe(500)
      expect(failed.json<{ success: boolean }>().success).toBe(false)
    } finally {
      runtime.options.userCreationParticipant = original
    }

    expect(await countUsersByTestPhone(phone)).toBe(0)
    expect(await createdUserId(username)).toBeNull()
    const row = await draftRow(draft.draftId)
    expect(row.status).not.toBe('completed')
    expect(row.result_ref).toBeNull()

    // 机制来自数据库而不是进程内锁：连接在事务中途被销毁，INSERT 一并消失。
    const raw = await stack.database.pool.getConnection()
    await raw.query('START TRANSACTION')
    await raw.query('INSERT INTO sys_user (username, phone, password_hash, status, creator_id, updater_id, created_at, updated_at) VALUES (?, ?, ?, 1, 1, 1, NOW(3), NOW(3))', ['aborted_by_disconnect', nextPhone(), 'x'])
    raw.destroy()
    await new Promise(resolve2 => setTimeout(resolve2, 200))
    const survivors = await query<CountRow>('SELECT COUNT(*) AS count FROM sys_user WHERE username = ?', ['aborted_by_disconnect'])
    expect(Number(survivors[0].count)).toBe(0)
  })

  it('refuses stale versions, expired drafts, cancelled drafts and non-editable submitting drafts without creating a user', async () => {
    // 版本冲突：先改一次草稿，客户端手里的版本就过期了。
    const staleConversation = await newConversation()
    const stalePhone = nextPhone()
    const stale = await readyDraft(staleConversation, { username: 'stale_person', phone: stalePhone })
    const patched = await appA.inject({
      method: 'PATCH', url: `/api/ai/v1/drafts/${stale.draftId}`, headers: admin,
      payload: { draftVersion: stale.draftVersion, formData: { nickname: '晚了一步' } },
    })
    expect(patched.statusCode, patched.body).toBe(200)
    const conflict = await submitWithDraft(appA, admin, stale, { username: 'stale_person', phone: stalePhone })
    expect(conflict.json<{ success: boolean }>().success, `STALE:${conflict.statusCode} ${conflict.body}`).toBe(false)
    expect(await countUsersByTestPhone(stalePhone)).toBe(0)

    // 过期：24 小时有效期不因编辑延长，落到库里也仍然生效。
    const expiredConversation = await newConversation()
    const expiredPhone = nextPhone()
    const expired = await readyDraft(expiredConversation, { username: 'expired_person', phone: expiredPhone })
    await stack.database.pool.query(
      // 相对存储值往回拨，不依赖「应用写的 Date」与「MySQL 的 NOW()」两个时区框架是否一致。
      "UPDATE ai_action_drafts SET expires_at = DATE_SUB(expires_at, INTERVAL 1 DAY) WHERE draft_id = ?",
      [expired.draftId],
    )
    const expiredSubmit = await submitWithDraft(appA, admin, expired, { username: 'expired_person', phone: expiredPhone })
    expect(expiredSubmit.json<{ success: boolean }>().success, `EXPIRED:${expiredSubmit.statusCode} ${expiredSubmit.body}`).toBe(false)
    expect(await countUsersByTestPhone(expiredPhone)).toBe(0)

    // 取消：取消后的草稿不能被迟到的提交复活。
    const cancelledConversation = await newConversation()
    const cancelledPhone = nextPhone()
    const cancelled = await readyDraft(cancelledConversation, { username: 'cancelled_person', phone: cancelledPhone })
    const cancel = await appA.inject({
      method: 'POST', url: `/api/ai/v1/drafts/${cancelled.draftId}/cancel`, headers: admin,
      payload: { draftVersion: cancelled.draftVersion },
    })
    expect(cancel.statusCode, cancel.body).toBe(200)
    const cancelledSubmit = await submitWithDraft(appA, admin, cancelled, { username: 'cancelled_person', phone: cancelledPhone })
    expect(cancelledSubmit.json<{ success: boolean }>().success, cancelledSubmit.body).toBe(false)
    expect(await countUsersByTestPhone(cancelledPhone)).toBe(0)

    // 提交中：submitting 是租约，期间既不能编辑也不能再次提交。
    const submittingConversation = await newConversation()
    const submittingPhone = nextPhone()
    const submitting = await readyDraft(submittingConversation, { username: 'submitting_person', phone: submittingPhone })
    await stack.database.pool.query("UPDATE ai_action_drafts SET status = 'submitting' WHERE draft_id = ?", [submitting.draftId])
    const editWhileSubmitting = await appA.inject({
      method: 'PATCH', url: `/api/ai/v1/drafts/${submitting.draftId}`, headers: admin,
      payload: { draftVersion: submitting.draftVersion, formData: { nickname: '不该写进来' } },
    })
    expect(editWhileSubmitting.statusCode).toBe(409)
    expect(await countUsersByTestPhone(submittingPhone)).toBe(0)
  })

  it('hides another owner\'s draft and deletes the conversation only when no draft is submitting', async () => {
    const ownerPhone = nextPhone()
    const ownerConversation = await newConversation()
    const owned = await readyDraft(ownerConversation, { username: 'owner_person', phone: ownerPhone })

    // 造一个真实的第二个人（普通后台创建，与助手无关）。他**有**建号与助手的权限：
    // 跨归属的判定必须是「草稿不存在」，而不是被路由层挡在门外时的那句「没权限」。
    const peerRole = await appA.inject({
      method: 'POST', url: '/api/v1/admin/roles', headers: admin,
      payload: { name: '同权限的另一人', dataScope: '1', permissionCodes: ['system:user:create', 'system:user:list', 'ai:chat:use'] },
    })
    expect(peerRole.statusCode, peerRole.body).toBe(200)
    const created = await appA.inject({
      method: 'POST', url: CREATE_USER, headers: admin,
      payload: {
        username: 'other_person', phone: nextPhone(), realName: '另一个人', password: CREATED_USER_PASSWORD,
        roleIds: [peerRole.json<{ data: { id: number } }>().data.id],
      },
    })
    expect(created.statusCode, created.body).toBe(200)
    const otherHeaders = await loginHeaders(appA, 'other_person', CREATED_USER_PASSWORD)

    // 跨 owner：别人的草稿与不存在等价。
    // 草稿端点（ai 模块自己的错误处理器）给出 404；创建接口走 System 路由，
    // 那里把 404 归一成通用错误码 —— 断言的是「失败」，而不是具体 HTTP 状态。
    for (const call of [
      appA.inject({ url: `/api/ai/v1/drafts/${owned.draftId}`, headers: otherHeaders }),
      appA.inject({ method: 'PATCH', url: `/api/ai/v1/drafts/${owned.draftId}`, headers: otherHeaders, payload: { draftVersion: owned.draftVersion, formData: { nickname: '越权' } } }),
    ]) {
      const response = await call
      expect(response.statusCode, response.body).toBe(404)
    }
    const crossOwnerSubmit = await submitWithDraft(appA, otherHeaders, owned, { username: 'owner_person', phone: ownerPhone })
    expect(crossOwnerSubmit.json<{ success: boolean }>().success, crossOwnerSubmit.body).toBe(false)
    expect(await countUsersByTestPhone(ownerPhone)).toBe(0)

    // 会话删除与提交竞争：有 submitting 草稿时删除被拒，删完之后提交 404。
    await stack.database.pool.query("UPDATE ai_action_drafts SET status = 'submitting' WHERE draft_id = ?", [owned.draftId])
    const blocked = await appA.inject({ method: 'DELETE', url: `${CONVERSATIONS}/${ownerConversation}`, headers: admin })
    expect(blocked.json<{ success: boolean }>().success, `BLOCKED:${blocked.statusCode} ${blocked.body}`).toBe(false)
    await stack.database.pool.query("UPDATE ai_action_drafts SET status = 'ready' WHERE draft_id = ?", [owned.draftId])
    const removed = await appA.inject({ method: 'DELETE', url: `${CONVERSATIONS}/${ownerConversation}`, headers: admin })
    expect(removed.statusCode, removed.body).toBe(200)
    const afterDeletion = await submitWithDraft(appA, admin, owned, { username: 'owner_person', phone: ownerPhone })
    expect(afterDeletion.json<{ success: boolean }>().success, `AFTERDEL:${afterDeletion.statusCode} ${afterDeletion.body}`).toBe(false)
    expect(await countUsersByTestPhone(ownerPhone)).toBe(0)
  })

  it('re-checks the granted role permissions at submit time, so a widening between turns blocks the create', async () => {
    // 操作者：一个非超管，只有建号/读角色/用助手三个权限。
    const operatorRole = await appA.inject({
      method: 'POST', url: '/api/v1/admin/roles', headers: admin,
      payload: { name: '受限建号操作者', dataScope: '1', permissionCodes: ['system:user:create', 'system:role:list', 'ai:chat:use'] },
    })
    expect(operatorRole.statusCode, operatorRole.body).toBe(200)
    const operatorRoleId = operatorRole.json<{ data: { id: number } }>().data.id

    // 拟授予的角色：此刻只有操作者也有的权限，因此草稿存得进去。
    const grantedRole = await appA.inject({
      method: 'POST', url: '/api/v1/admin/roles', headers: admin,
      payload: { name: '待授予角色', dataScope: '1', permissionCodes: ['system:role:list'] },
    })
    expect(grantedRole.statusCode, grantedRole.body).toBe(200)
    const grantedRoleId = grantedRole.json<{ data: { id: number } }>().data.id

    const operator = await appA.inject({
      method: 'POST', url: CREATE_USER, headers: admin,
      payload: {
        username: 'narrow_operator', phone: nextPhone(), realName: '窄权限操作者', password: CREATED_USER_PASSWORD,
        roleIds: [operatorRoleId],
      },
    })
    expect(operator.statusCode, operator.body).toBe(200)
    const operatorId = operator.json<{ data: { id: number } }>().data.id
    const operatorHeaders = await loginHeaders(appA, 'narrow_operator', CREATED_USER_PASSWORD)

    const phone = nextPhone()
    const username = 'revoked_person'
    const conversationId = await newConversation(appA, operatorHeaders)
    const draft = await readyDraftFor(conversationId, operatorId, { username, phone, realName: '回收前', roleIds: [grantedRoleId] })

    // 授权通过之后，待授予角色被**扩大**：多了一个操作者没有的权限码。
    // 草稿里存的角色没变，但这份角色现在授予的东西变了 —— 只有提交时重算才拦得住。
    const widened = await appA.inject({
      method: 'PUT', url: `/api/v1/admin/roles/${grantedRoleId}`, headers: admin,
      payload: { name: '待授予角色', dataScope: '1', permissionCodes: ['system:role:list', 'demo:health:read'] },
    })
    expect(widened.statusCode, widened.body).toBe(200)

    const submit = await submitWithDraft(appA, operatorHeaders, draft, { username, phone })
    expect(submit.statusCode).toBe(200)
    expect(submit.json<{ success: boolean; code: number }>(), submit.body).toMatchObject({ success: false, code: 30011 })
    expect(await countUsersByTestPhone(phone)).toBe(0)
    // 失败后草稿保留且可编辑 —— 用户改完还能再试。
    const row = await draftRow(draft.draftId)
    expect(row.status).toBe('failed')
    expect(row.result_ref).toBeNull()
  })

  it('refuses to create for an actor whose own scope is self-only', async () => {
    const roleResponse = await appA.inject({
      method: 'POST', url: '/api/v1/admin/roles', headers: admin,
      payload: { name: '仅本人建号角色', dataScope: '4', permissionCodes: ['system:user:create', 'system:user:list', 'ai:chat:use'] },
    })
    expect(roleResponse.statusCode, roleResponse.body).toBe(200)
    const roleId = roleResponse.json<{ data: { id: number } }>().data.id
    const userResponse = await appA.inject({
      method: 'POST', url: CREATE_USER, headers: admin,
      payload: { username: 'self_scope_person', phone: nextPhone(), realName: '仅本人', password: CREATED_USER_PASSWORD, roleIds: [roleId] },
    })
    expect(userResponse.statusCode, userResponse.body).toBe(200)
    const userId = userResponse.json<{ data: { id: number } }>().data.id
    const selfHeaders = await loginHeaders(appA, 'self_scope_person', CREATED_USER_PASSWORD)

    const phone = nextPhone()
    const conversationId = await newConversation(appA, selfHeaders)
    const outcome = await assistantPrepareDraft(conversationId, { username: 'self_scope_target', phone }, userId)
    expect(outcome.ok).toBe(false)
    expect(await countUsersByTestPhone(phone)).toBe(0)

    // 直接绕过助手、用同一身份走真实创建 API 也一样被拒：授权是同源的一份规则。
    const direct = await appA.inject({
      method: 'POST', url: CREATE_USER, headers: selfHeaders,
      payload: { username: 'self_scope_target', phone, password: CREATED_USER_PASSWORD },
    })
    expect(direct.statusCode).toBe(200)
    expect(direct.json<{ success: boolean; code: number }>()).toMatchObject({ success: false, code: 30011 })
    expect(await countUsersByTestPhone(phone)).toBe(0)
  })
})
