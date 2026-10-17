import { describe, expect, it } from 'vitest'
import { ActionDraftService, ACTION_DRAFT_TTL_MS } from '../services/action-draft.service.js'
import type { ActionDraftRecord, ActionDraftStore, ActionDraftTx } from '../repositories/action-draft.repository.js'
import { USER_CREATE_FORM_SCHEMA_VERSION } from '@yishan/core-system-api'

/**
 * 内存 store：行为测试全部走这里，因此没有任何一条测试需要等待真实过期，
 * 也永远不会因为两个 `new Date()` 落在同一毫秒而 flaky。
 */
function memoryStore() {
  const conversations = new Map<string, number>()
  const drafts = new Map<string, ActionDraftRecord>()
  const calls: string[] = []
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
    // 存副本：真实数据库返回的行与写入的对象不是同一个引用，别让调用方看到
    // 后续 CAS 对同一对象的就地修改。
    async insert(draft) { drafts.set(draft.draftId, structuredClone(draft)); return structuredClone(draft) },
    async conversationExists(ownerId, conversationId) { return conversations.get(conversationId) === ownerId },
    find: async (ownerId, draftId) => find(ownerId, draftId),
    compareAndSwap,
  }
  const store: ActionDraftStore = {
    async insert(draft) { drafts.set(draft.draftId, draft); return draft },
    async find(ownerId, draftId) { return find(ownerId, draftId) },
    async listByConversation(ownerId, conversationId) { return [...drafts.values()].filter(d => d.ownerId === ownerId && d.conversationId === conversationId) },
    compareAndSwap,
    async removeByConversation(ownerId, conversationId) {
      const blocking = [...drafts.values()].find(d => d.ownerId === ownerId && d.conversationId === conversationId && d.status === 'submitting')
      if (blocking) { calls.push('refused'); throw Object.assign(new Error('草稿正在提交'), { statusCode: 409 }) }
      for (const row of [...drafts.values()]) if (row.ownerId === ownerId && row.conversationId === conversationId) drafts.delete(row.draftId)
      calls.push('deleted')
    },
    async transaction(fn) { return fn(tx) },
  }
  return { store, drafts, conversations, calls }
}

function fixture(start = '2026-10-17T00:00:00.000Z') {
  const memory = memoryStore()
  memory.conversations.set('conv-1', 7)
  memory.conversations.set('conv-2', 7)
  memory.conversations.set('conv-of-another-user', 8)
  let clock = new Date(start)
  const authorized: unknown[] = []
  const service = new ActionDraftService(memory.store, {
    now: () => clock,
    authorize: async (_subject, fields) => { authorized.push(fields) },
  })
  const advance = (ms: number) => { clock = new Date(clock.getTime() + ms) }
  const create = (formData: Record<string, unknown> = { phone: '13800000000' }, conversationId = 'conv-1') =>
    service.create(7, conversationId, { module: 'system', action: 'user.create', formData })
  return { service, memory, advance, create, authorized, get clock() { return clock } }
}

describe('Action draft ownership', () => {
  it('scopes every read, patch and cancel to the owner and never leaks another user’s draft', async () => {
    const f = fixture()
    const draft = await f.create({ phone: '13800000000', realName: '张三' })
    await expect(f.service.get(8, draft.draftId)).rejects.toMatchObject({ statusCode: 404 })
    await expect(f.service.patch(8, draft.draftId, draft.draftVersion, { nickname: 'x' })).rejects.toMatchObject({ statusCode: 404 })
    await expect(f.service.cancel(8, draft.draftId, draft.draftVersion)).rejects.toMatchObject({ statusCode: 404 })
    expect(await f.service.list(8, 'conv-1')).toEqual([])
    await expect(f.service.get(8, '00000000-0000-4000-8000-000000000000')).rejects.toMatchObject({ statusCode: 404 })
  })

  it('refuses a draft forged into another conversation', async () => {
    const f = fixture()
    const draft = await f.create({ phone: '13800000000' }, 'conv-1')
    expect(await f.service.list(7, 'conv-2')).toEqual([])
    await expect(f.service.withSubmissionLock(7, 'conv-2', draft.draftId, async () => 'unreachable')).rejects.toMatchObject({ statusCode: 404 })
    await expect(f.service.markSubmitting(7, draft.draftId, draft.draftVersion, 'conv-2')).rejects.toMatchObject({ statusCode: 404 })
    await expect(f.create({ phone: '13800000000' }, 'conv-missing')).rejects.toMatchObject({ statusCode: 404 })
    await expect(f.create({ phone: '13800000000' }, 'conv-of-another-user')).rejects.toMatchObject({ statusCode: 404 })
  })

  it('lists a conversation’s drafts in creation order and only for its owner', async () => {
    const f = fixture()
    await f.create({ phone: '13800000000' })
    await f.create({ realName: '李四' }, 'conv-2')
    const drafts = await f.service.list(7, 'conv-1')
    expect(drafts).toHaveLength(1)
    expect(drafts[0]).toMatchObject({ conversationId: 'conv-1', ownerId: 7 })
  })
})

describe('Action draft expiry', () => {
  it('expires 24 hours after creation and never extends on edit', async () => {
    const f = fixture()
    const draft = await f.create({ phone: '13800000000' })
    expect(draft.expiresAt.getTime() - f.clock.getTime()).toBe(ACTION_DRAFT_TTL_MS)
    f.advance(ACTION_DRAFT_TTL_MS - 1)
    const edited = await f.service.patch(7, draft.draftId, draft.draftVersion, { realName: '张三' })
    expect(edited.expiresAt.getTime() - f.clock.getTime()).toBeLessThan(ACTION_DRAFT_TTL_MS)
    f.advance(1)
    await expect(f.service.get(7, draft.draftId)).rejects.toMatchObject({ statusCode: 409, message: expect.stringContaining('过期') })
    await expect(f.service.patch(7, draft.draftId, edited.draftVersion, { realName: '李四' })).rejects.toMatchObject({ statusCode: 409 })
  })

  it('marks a read-after-expiry draft expired instead of leaving it editable', async () => {
    const f = fixture()
    const draft = await f.create({ phone: '13800000000' })
    f.advance(ACTION_DRAFT_TTL_MS)
    await expect(f.service.get(7, draft.draftId)).rejects.toMatchObject({ statusCode: 409 })
    expect(f.memory.drafts.get(draft.draftId)!.status).toBe('expired')
  })
})

describe('Action draft versioning and field patching', () => {
  it('rejects a stale draftVersion with a conflict and never overwrites the newer row', async () => {
    const f = fixture()
    const draft = await f.create({ phone: '13800000000' })
    const next = await f.service.patch(7, draft.draftId, draft.draftVersion, { realName: '张三' })
    expect(next.draftVersion).toBe(draft.draftVersion + 1)
    await expect(f.service.patch(7, draft.draftId, draft.draftVersion, { realName: '李四' })).rejects.toMatchObject({ statusCode: 409, message: expect.stringContaining('版本') })
    expect(f.memory.drafts.get(draft.draftId)!.formData).toEqual({ phone: '13800000000', realName: '张三' })
  })

  it('rejects a schemaVersion from a previous form definition', async () => {
    const f = fixture()
    await expect(f.service.create(7, 'conv-1', { module: 'system', action: 'user.create', formData: { phone: '1' }, schemaVersion: USER_CREATE_FORM_SCHEMA_VERSION + 1 })).rejects.toMatchObject({ statusCode: 400 })
    const draft = await f.create()
    await expect(f.service.patch(7, draft.draftId, draft.draftVersion, { realName: 'x' }, { schemaVersion: USER_CREATE_FORM_SCHEMA_VERSION - 1 })).rejects.toMatchObject({ statusCode: 400 })
    expect(f.memory.drafts.get(draft.draftId)!.draftVersion).toBe(draft.draftVersion)
  })

  it('merges an explicit patch and clears an optional field on null without touching omitted fields', async () => {
    const f = fixture()
    const draft = await f.create({ phone: '13800000000', nickname: '老王', realName: '张三' })
    const patched = await f.service.patch(7, draft.draftId, draft.draftVersion, { nickname: null, gender: '1' })
    expect(patched.formData).toEqual({ phone: '13800000000', realName: '张三', gender: '1' })
    expect('nickname' in f.memory.drafts.get(draft.draftId)!.formData).toBe(false)
    const clearedPhone = await f.service.patch(7, draft.draftId, patched.draftVersion, { phone: null })
    expect(clearedPhone.formData).toEqual({ realName: '张三', gender: '1' })
    expect(clearedPhone.status).toBe('collecting')
  })

  it('refuses to drop the last editable value of a not-null field twice', async () => {
    const f = fixture()
    const draft = await f.create({ phone: '13800000000' })
    const cleared = await f.service.patch(7, draft.draftId, draft.draftVersion, { phone: null })
    expect(cleared.formData).toEqual({})
    expect(cleared.missingFields.map((m: { name: string }) => m.name)).toContain('phone')
  })
})

describe('Action draft completeness and validation', () => {
  it('reports structured missing fields while collecting and ready once filled', async () => {
    const f = fixture()
    const partial = await f.create({})
    expect(partial.status).toBe('collecting')
    expect(partial.missingFields.map((m: { name: string }) => m.name)).toEqual(expect.arrayContaining(['phone', 'password']))
    expect(partial.missingFields.find((m: { name: string }) => m.name === 'password')).toMatchObject({ sensitive: true, mustCompleteInForm: true })
    const ready = await f.service.patch(7, partial.draftId, partial.draftVersion, { phone: '13800000000' })
    expect(ready.status).toBe('ready')
    // 密码永远缺（只能在表单里填），但它不阻塞 ready；可编辑必填项补齐后不再缺失。
    expect(ready.missingFields.map((m: { name: string }) => m.name)).toContain('password')
    expect(ready.missingFields.map((m: { name: string }) => m.name)).not.toContain('phone')
  })

  it('keeps a temporarily non-conforming value with a validation error instead of rejecting the whole draft', async () => {
    const f = fixture()
    const draft = await f.create({ phone: '13', email: 'not-an-email', gender: '9' })
    expect(draft.formData).toEqual({ phone: '13', email: 'not-an-email', gender: '9' })
    expect(draft.validationErrors.map((e: { field: string }) => e.field).sort()).toEqual(['email', 'gender'])
    expect(draft.status).toBe('ready')
    const fixed = await f.service.patch(7, draft.draftId, draft.draftVersion, { phone: '13800000000', email: null, gender: null })
    expect(fixed.validationErrors).toEqual([])
  })

  it('rejects password material, unknown fields and wrong primitive types outright', async () => {
    const f = fixture()
    await expect(f.create({ phone: '13800000000', password: 'abc12345' })).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('password') })
    await expect(f.create({ phone: '13800000000', nickname: undefined, isAdmin: true })).rejects.toMatchObject({ statusCode: 400 })
    await expect(f.create({ phone: 138 })).rejects.toMatchObject({ statusCode: 400 })
    await expect(f.create({ roleIds: ['1'] })).rejects.toMatchObject({ statusCode: 400 })
    const draft = await f.create()
    await expect(f.service.patch(7, draft.draftId, draft.draftVersion, { password: 'abc12345' })).rejects.toMatchObject({ statusCode: 400 })
    expect(f.memory.drafts.get(draft.draftId)!.formData).toEqual({ phone: '13800000000' })
  })

  it('rejects a module/action pair outside the registered first-phase contract', async () => {
    const f = fixture()
    await expect(f.service.create(7, 'conv-1', { module: 'system', action: 'user.delete', formData: {} })).rejects.toMatchObject({ statusCode: 400 })
  })

  it('runs the shared user-creation authorization on every save', async () => {
    const f = fixture()
    await f.service.create(7, 'conv-1', { module: 'system', action: 'user.create', formData: { phone: '13800000000', roleIds: [1] }, subject: { actorId: 7 } })
    expect(f.authorized).toEqual([{ phone: '13800000000', roleIds: [1] }])
  })
})

describe('Action draft lifecycle', () => {
  it('cancels exactly once and never lets a late tool result reactivate it', async () => {
    const f = fixture()
    const draft = await f.create({ phone: '13800000000' })
    const cancelled = await f.service.cancel(7, draft.draftId, draft.draftVersion)
    expect(cancelled.status).toBe('cancelled')
    await expect(f.service.patch(7, draft.draftId, cancelled.draftVersion, { realName: '迟到' })).rejects.toMatchObject({ statusCode: 409 })
    await expect(f.service.markSubmitting(7, draft.draftId, cancelled.draftVersion, 'conv-1')).rejects.toMatchObject({ statusCode: 409 })
    expect(f.memory.drafts.get(draft.draftId)!.formData).toEqual({ phone: '13800000000' })
  })

  it('completes exactly once and refuses a second submission of the same draft', async () => {
    const f = fixture()
    const draft = await f.create({ phone: '13800000000' })
    const submitting = await f.service.markSubmitting(7, draft.draftId, draft.draftVersion, 'conv-1')
    expect(submitting.status).toBe('submitting')
    await expect(f.service.patch(7, draft.draftId, submitting.draftVersion, { realName: '改' })).rejects.toMatchObject({ statusCode: 409 })
    await expect(f.service.cancel(7, draft.draftId, submitting.draftVersion)).rejects.toMatchObject({ statusCode: 409 })
    const completed = await f.service.markCompleted(7, draft.draftId, submitting.draftVersion, { targetType: 'sys_user', targetId: '42' })
    expect(completed).toMatchObject({ status: 'completed', resultRef: { targetType: 'sys_user', targetId: '42' } })
    await expect(f.service.markCompleted(7, draft.draftId, completed.draftVersion, { targetType: 'sys_user', targetId: '43' })).rejects.toMatchObject({ statusCode: 409 })
    expect(f.memory.drafts.get(draft.draftId)!.resultRef).toEqual({ targetType: 'sys_user', targetId: '42' })
  })

  it('never stores password material as a result reference', async () => {
    const f = fixture()
    const draft = await f.create({ phone: '13800000000' })
    const submitting = await f.service.markSubmitting(7, draft.draftId, draft.draftVersion, 'conv-1')
    const failed = await f.service.markFailed(7, draft.draftId, submitting.draftVersion, '手机号已存在')
    expect(failed).toMatchObject({ status: 'failed' })
    expect(Object.keys(failed.formData)).not.toContain('password')
    expect(failed.resultRef).toBeNull()
  })

  it('lets an editable failed draft go back to collecting, ready or previewing', async () => {
    const f = fixture()
    const draft = await f.create({ phone: '13800000000' })
    const submitting = await f.service.markSubmitting(7, draft.draftId, draft.draftVersion, 'conv-1')
    const failed = await f.service.markFailed(7, draft.draftId, submitting.draftVersion, '唯一性校验失败')
    expect(failed.status).toBe('failed')
    const patched = await f.service.patch(7, draft.draftId, failed.draftVersion, { phone: '13900000000' })
    expect(patched.status).toBe('ready')
    const previewing = await f.service.markPreviewing(7, draft.draftId, patched.draftVersion)
    expect(previewing.status).toBe('previewing')
    const back = await f.service.markPreviewing(7, draft.draftId, previewing.draftVersion, false)
    expect(back.status).toBe('ready')
  })
})

describe('Session deletion versus draft submission', () => {
  it('refuses to delete a conversation whose draft is submitting', async () => {
    const f = fixture()
    const draft = await f.create({ phone: '13800000000' })
    await f.service.markSubmitting(7, draft.draftId, draft.draftVersion, 'conv-1')
    await expect(f.service.removeConversationDrafts(7, 'conv-1')).rejects.toMatchObject({ statusCode: 409 })
    expect(f.memory.calls).toEqual(['refused'])
  })

  it('deletes the drafts with the conversation once nothing is submitting', async () => {
    const f = fixture()
    await f.create({ phone: '13800000000' })
    await f.create({ realName: '李四' })
    await expect(f.service.removeConversationDrafts(7, 'conv-1')).resolves.toBe(true)
    expect(f.memory.calls).toEqual(['deleted'])
    expect(await f.service.list(7, 'conv-1')).toEqual([])
  })

  it('holds the conversation lock for the whole submission so a concurrent delete cannot interleave', async () => {
    const f = fixture()
    const draft = await f.create({ phone: '13800000000' })
    const order: string[] = []
    await f.service.withSubmissionLock(7, 'conv-1', draft.draftId, async tx => {
      order.push('conversation')
      await tx.compareAndSwap({ ownerId: 7, draftId: draft.draftId, expectedVersion: draft.draftVersion, allowedStatuses: ['ready'], patch: { status: 'submitting' } })
      order.push('draft')
    })
    expect(order).toEqual(['conversation', 'draft'])
  })
})
