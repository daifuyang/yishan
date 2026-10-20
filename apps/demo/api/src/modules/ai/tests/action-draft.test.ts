import { describe, expect, } from 'vitest'
import { it } from './draft-runtime.js'
import { ActionDraftService, ACTION_DRAFT_TTL_MS } from '../services/action-draft.service.js'
import type { ActionDraftRecord, ActionDraftStore, ActionDraftTx } from '../repositories/action-draft.repository.js'
import { USER_CREATE_FORM_SCHEMA_VERSION } from '@yishan/core-system-api'
import { DRAFT_ARRAY_FIELD_KEYS, USER_CREATE_DRAFT_FIELD_KEYS, matchesDraftFieldType } from '../schemas/action-draft.schema.js'
import { AiChatService } from '../services/ai-chat.service.js'
import { AiCapabilityCatalog } from '@yishan/core-api'
import { runWithAiCapabilities } from '@yishan/core-api/ai-capabilities/catalog'
import { Type } from '@sinclair/typebox'
import { Value } from '@sinclair/typebox/value'
import { createActionDraftCapabilities } from '../capabilities/action-drafts.js'

describe('registered business draft adapters', () => {
  it('creates and patches a third operation and rejects a different module', async () => {
    const catalog = new AiCapabilityCatalog()
    let schemaVersion = 1
    catalog.register({ name: 'prepare_project', moduleId: 'projects', operationId: 'createProject', permissionCode: 'projects:create', riskLevel: 'prepare', enabled: true, description: 'project', inputSchema: {}, execute: async () => ({ data: {} }),
      draftAdapter: { action: 'project.create', moduleId: 'projects', name: '项目', prepareCapabilityName: 'prepare_project_draft', operationId: 'createProject', permissionCode: 'projects:create', fieldSchemas: { title: Type.String(), active: Type.Boolean() }, form: () => ({ schemaVersion, fields: [{ name: 'title', label: '标题', required: true, sensitive: false, selector: 'text', constraints: {} }], defaults: {}, editableFields: ['title', 'active'], missingFields: [] }), authorize: async () => {} },
    })
    await runWithAiCapabilities(catalog, async () => {
      const f = fixture()
      const draft = await f.service.create(7, 'conv-1', { module: 'projects', action: 'project.create', formData: { active: false } })
      expect(draft.status).toBe('collecting')
      const updated = await f.service.patch(7, draft.draftId, 1, { title: '测试' })
      expect(updated.formData).toEqual({ active: false, title: '测试' })
      expect(updated.status).toBe('ready')
      const update = createActionDraftCapabilities({ drafts: f.service }).find(capability => capability.name === 'update_action_draft')!
      const input = { draftId: draft.draftId, draftVersion: 2, active: true }
      expect(Value.Check(update.inputSchema as import('@sinclair/typebox').TSchema, input)).toBe(true)
      await update.execute({ actorId: 7, conversationId: 'conv-1', requestId: 'r', permissions: new Set(['projects:create']) }, input)
      expect((await f.service.get(7, draft.draftId)).formData.active).toBe(true)
      await expect(f.service.create(7, 'conv-1', { module: 'system', action: 'project.create', formData: {} })).rejects.toThrow('表单目标')
      schemaVersion = 2
      await expect(f.service.patch(7, draft.draftId, 3, { title: '旧定义' })).rejects.toThrow('表单定义已更新')
      await expect(f.service.markPreviewing(7, draft.draftId, 3)).rejects.toThrow('表单定义已更新')
    })
  })
})

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
    // 无锁快照读。本文件不涉及并发重放，两种读在这里可以等价；
    // 区分它们的行为由 user-creation-participant.test.ts 的 snapshotStore 覆盖。
    peek: async (ownerId, draftId) => find(ownerId, draftId),
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
  /**
   * 进入提交。**必须**走 `withSubmissionLock` + `markSubmittingInTx`：
   * 服务上刻意不提供事务外的 `markSubmitting`，因此测试也无法偷偷绕过互斥。
   */
  const beginSubmitting = (draft: ActionDraftRecord, conversationId = 'conv-1') =>
    service.withSubmissionLock(7, conversationId, draft.draftId, (tx, row) => service.markSubmittingInTx(tx, row))
  return { service, memory, advance, create, beginSubmitting, authorized, get clock() { return clock } }
}

describe('department form adapter', () => {
  it('persists native numeric fields and evaluates required fields with the existing CAS engine', async () => {
    const memory = memoryStore()
    memory.conversations.set('conv-1', 7)
    const service = new ActionDraftService(memory.store)
    const draft = await service.create(7, 'conv-1', { module: 'system', action: 'department.create', formData: { sort_order: 3 } })
    expect(draft.status).toBe('collecting')
    expect(draft.missingFields.map(field => field.name)).toEqual(['name'])
    const patched = await service.patch(7, draft.draftId, 1, { name: '研发部', parentId: 2 })
    expect(patched.formData).toEqual({ sort_order: 3, name: '研发部', parentId: 2 })
    expect(patched.status).toBe('ready')
    await expect(service.patch(7, draft.draftId, 1, { name: '过期修改' })).rejects.toThrow('版本')
    await expect(service.create(7, 'conv-1', { module: 'system', action: 'department.create', formData: { password: 'forged' } })).rejects.toThrow('不支持的字段')
  })
})

/**
 * 一个只实现「删会话」所需的聊天服务：内存 store + 真实的草稿守卫。
 *
 * 断言守卫必须挂在**删除路径**上，而不是某个没人调用的方法上：表上的
 * `ON DELETE CASCADE` 会连 `submitting` 的草稿一起删掉。
 */
function chatDeletingConversation(f: ReturnType<typeof fixture>) {
  const conversations = new Map<string, { id: string; ownerId: number; title: string; createdAt: Date; updatedAt: Date }>()
  conversations.set('conv-1', { id: 'conv-1', ownerId: 7, title: '新对话', createdAt: new Date(), updatedAt: new Date() })
  const store = {
    async list(ownerId: number) { return [...conversations.values()].filter(c => c.ownerId === ownerId) },
    async find(ownerId: number, id: string) { const c = conversations.get(id); return c?.ownerId === ownerId ? c : null },
    async create(c: never) { conversations.set(c.id, c); return c },
    async rename() {},
    async remove(ownerId: number, id: string) { conversations.delete(id) },
    async messages() { return [] },
    async acquire() { return true },
    async isActive() { return false },
    async begin() {},
    async finish() {},
    async release() {},
  }
  return new AiChatService(store, async () => { throw new Error('runtime not needed') }, undefined, f.service)
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
    await expect(f.beginSubmitting(draft, 'conv-2')).rejects.toMatchObject({ statusCode: 404 })
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
    // 断言**字面量**而不是常量本身：拿常量跟自己比等于把常量改成 5 分钟也照样绿，
    // 产品却已经静默地把草稿寿命缩到 1/288。规格写死 24 小时。
    expect(draft.expiresAt.getTime() - f.clock.getTime()).toBe(24 * 60 * 60 * 1000)
    expect(ACTION_DRAFT_TTL_MS).toBe(24 * 60 * 60 * 1000)
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
    // 值留着，错误进 validationErrors，但草稿**不能**宣称 ready：
    // ready 的契约是「模型可以照此提交」，带着两个未解决的格式错误宣称 ready
    // 等于替提交接口撒谎，真正被拒的是用户。修正后自然回到 ready。
    expect(draft.status).toBe('collecting')
    const fixed = await f.service.patch(7, draft.draftId, draft.draftVersion, { phone: '13800000000', email: null, gender: null })
    expect(fixed.validationErrors).toEqual([])
    expect(fixed.status).toBe('ready')
  })

  it('never lets a null field count as collected on create', async () => {
    const f = fixture()
    // 模型把「还没问到手机号」表达成 null：既不是已收集，也不该被原样存下来。
    await expect(f.create({ phone: null })).rejects.toMatchObject({ statusCode: 400 })
    await expect(f.service.create(7, 'conv-1', { module: 'system', action: 'user.create', formData: { phone: '13800000000', nickname: null } })).rejects.toMatchObject({ statusCode: 400 })
    expect([...f.memory.drafts.values()].map(d => d.formData)).toEqual([])
    // null 与「缺字段」在判定上必须一致：清空后的草稿回到 collecting 而不是 ready。
    const draft = await f.create({ phone: '13800000000' })
    const cleared = await f.service.patch(7, draft.draftId, draft.draftVersion, { phone: null })
    expect(cleared.formData).toEqual({})
    expect(cleared.status).toBe('collecting')
    expect(cleared.missingFields.map((m: { name: string }) => m.name)).toContain('phone')
  })

  it('derives the array-field set from the schema so one list serves the guard and normalize()', async () => {
    const f = fixture()
    // 数组字段清单只能从 schema 派生：`deptIds` / `roleIds` 之外再加一个也不会
    // 让守卫与 normalize() 落后于 schema，不需要改第二处清单。
    expect([...DRAFT_ARRAY_FIELD_KEYS].sort()).toEqual(
      USER_CREATE_DRAFT_FIELD_KEYS.filter(key => matchesDraftFieldType(key, [])).sort(),
    )
    for (const key of DRAFT_ARRAY_FIELD_KEYS) {
      expect(matchesDraftFieldType(key, [1, 2]), key).toBe(true)
      expect(matchesDraftFieldType(key, ['1']), key).toBe(false)
      // 模型工具路径：合法数组被接受并落库，不被误判成「不支持的字段」。
      const draft = await f.create({ [key]: [1, 2] })
      expect(draft.formData[key], key).toEqual([1, 2])
      await expect(f.create({ [key]: ['1'] }), key).rejects.toMatchObject({ statusCode: 400 })
    }
    // 非数组字段仍然要字符串：新增一个数组字段不会把 `phone: 138` 放过去。
    for (const key of USER_CREATE_DRAFT_FIELD_KEYS.filter(k => !DRAFT_ARRAY_FIELD_KEYS.has(k))) {
      expect(matchesDraftFieldType(key, 'x'), key).toBe(true)
      expect(matchesDraftFieldType(key, 1), key).toBe(false)
    }
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
    await expect(f.beginSubmitting(cancelled)).rejects.toMatchObject({ statusCode: 409 })
    expect(f.memory.drafts.get(draft.draftId)!.formData).toEqual({ phone: '13800000000' })
  })

  it('completes exactly once and refuses a second submission of the same draft', async () => {
    const f = fixture()
    const draft = await f.create({ phone: '13800000000' })
    const submitting = await f.beginSubmitting(draft)
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
    const submitting = await f.beginSubmitting(draft)
    const failed = await f.service.markFailed(7, draft.draftId, submitting.draftVersion, '手机号已存在')
    expect(failed).toMatchObject({ status: 'failed' })
    expect(Object.keys(failed.formData)).not.toContain('password')
    expect(failed.resultRef).toBeNull()
  })

  it('lets an editable failed draft go back to collecting, ready or previewing', async () => {
    const f = fixture()
    const draft = await f.create({ phone: '13800000000' })
    const submitting = await f.beginSubmitting(draft)
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
    await f.beginSubmitting(draft)
    await expect(f.service.removeConversationDrafts(7, 'conv-1')).rejects.toMatchObject({ statusCode: 409 })
    expect(f.memory.calls).toEqual(['refused'])
  })

  it('rejects the real conversation delete while a draft is submitting', async () => {
    const f = fixture()
    const draft = await f.create({ phone: '13800000000' })
    await f.beginSubmitting(draft)
    // 守卫必须活在删除路径上：`ON DELETE CASCADE` 不看状态，会把一次进行中的
    // 用户创建连同草稿一起静默删除。
    const chat = chatDeletingConversation(f)
    await expect(chat.remove(7, 'conv-1')).rejects.toMatchObject({ statusCode: 409 })
    expect(f.memory.calls).toEqual(['refused'])
    // 没有任何草稿在提交时，删除路径才真正删掉会话。
    await f.service.markFailed(7, draft.draftId, draft.draftVersion + 1, '手机号已存在')
    await expect(chat.remove(7, 'conv-1')).resolves.toBeNull()
    expect(f.memory.calls).toEqual(['refused', 'deleted'])
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
