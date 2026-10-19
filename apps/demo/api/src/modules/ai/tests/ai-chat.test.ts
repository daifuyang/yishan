import { describe, expect, it } from 'vitest'
import { AiChatService, type AiRuntime } from '../services/ai-chat.service.js'
import type { AiChatStore, AiConversation, ChatMessage } from '../repositories/ai-chat.repository.js'

function fixture() {
  const conversations = new Map<string, AiConversation>()
  const histories = new Map<string, ChatMessage[]>()
  const leases = new Map<number, string>()
  const store: AiChatStore = {
    async list(ownerId) { return [...conversations.values()].filter(c => c.ownerId === ownerId) },
    async find(ownerId, id) { const c = conversations.get(id); return c?.ownerId === ownerId ? c : null },
    async create(c) { conversations.set(c.id, c); histories.set(c.id, []); return c },
    async rename(ownerId, id, title) { const c = await this.find(ownerId, id); if (c) c.title = title },
    async remove(ownerId, id) { if (await this.find(ownerId, id)) { conversations.delete(id); histories.delete(id) } },
    async messages(ownerId, id) { return await this.find(ownerId, id) ? structuredClone(histories.get(id) ?? []) : [] },
    async acquire(ownerId, id, token) { if (!await this.find(ownerId, id) || leases.has(ownerId)) return false; leases.set(ownerId, token); return true },
    async begin(ownerId, id, token, messages) { if (leases.get(ownerId) !== token) throw Error('lost lease'); histories.set(id, structuredClone(messages)) },
    async finish(ownerId, id, token, messages) { if (leases.get(ownerId) === token) { histories.set(id, structuredClone(messages)); leases.delete(ownerId) } },
    async release(ownerId, _id, token) { if (leases.get(ownerId) === token) leases.delete(ownerId) },
    async isActive(ownerId) { return leases.has(ownerId) },
  }
  let complete: Parameters<AiRuntime['start']>[0]['onEnd'] | undefined
  let sent: ChatMessage[] = []
  const runtime: AiRuntime = {
    async validate(messages) { return messages as ChatMessage[] },
    async start(options) { sent = options.messages; complete = options.onEnd; return new Response('stream') },
  }
  const service = new AiChatService(store, async () => runtime)
  return { service, store, histories, runtime, finish: async (status: 'complete' | 'aborted' | 'error' = 'complete') => complete?.({ id: 'a1', role: 'assistant', parts: [{ type: 'text', text: 'partial' }], metadata: { status } }), sent: () => sent }
}
const user = (id = 'u1', text = '你好'): ChatMessage => ({ id, role: 'user', parts: [{ type: 'text', text }] })

describe('AI chat ownership and lifecycle', () => {
  it('hides another user’s conversation from detail, rename, delete and generation', async () => {
    const f = fixture(); const c = await f.service.create(1)
    expect((await f.service.list(2)).items).toEqual([])
    await expect(f.service.detail(2, c.id)).rejects.toMatchObject({ statusCode: 404 })
    await expect(f.service.rename(2, c.id, 'stolen')).rejects.toMatchObject({ statusCode: 404 })
    await expect(f.service.remove(2, c.id)).rejects.toMatchObject({ statusCode: 404 })
    await expect(f.service.chat(2, { id: c.id, messages: [user()], trigger: 'submit-message' }, new AbortController().signal)).rejects.toMatchObject({ statusCode: 404 })
  })

  it('permits only one active generation per user across conversations and service instances', async () => {
    const f = fixture(); const first = await f.service.create(1); const second = await f.service.create(1)
    await f.service.chat(1, { id: first.id, messages: [user()], trigger: 'submit-message' }, new AbortController().signal)
    const otherInstance = new AiChatService(f.store, async () => f.runtime)
    await expect(otherInstance.chat(1, { id: second.id, messages: [user()], trigger: 'submit-message' }, new AbortController().signal)).rejects.toMatchObject({ statusCode: 409 })
    await expect(f.service.remove(1, first.id)).rejects.toMatchObject({ statusCode: 409 })
    await f.finish()
    await expect(otherInstance.chat(1, { id: second.id, messages: [user()], trigger: 'submit-message' }, new AbortController().signal)).resolves.toBeInstanceOf(Response)
  })

  it.each(['aborted', 'error'] as const)('persists partial output and releases generation after %s', async status => {
    const f = fixture(); const c = await f.service.create(1)
    await f.service.chat(1, { id: c.id, messages: [user()], trigger: 'submit-message' }, new AbortController().signal)
    await f.finish(status)
    expect((await f.service.detail(1, c.id)).messages).toMatchObject([user(), { role: 'assistant', metadata: { status }, parts: [{ text: 'partial' }] }])
    expect(await f.store.isActive(1)).toBe(false)
  })

  it('regenerates from persisted history without duplicating or trusting user-supplied history', async () => {
    const f = fixture(); const c = await f.service.create(1)
    await f.service.chat(1, { id: c.id, messages: [user()], trigger: 'submit-message' }, new AbortController().signal); await f.finish()
    await f.service.chat(1, { id: c.id, messages: [user('forged', 'ignored')], trigger: 'regenerate-message', messageId: 'a1' }, new AbortController().signal)
    expect(f.sent()).toEqual([user()]); await f.finish()
    expect((await f.service.detail(1, c.id)).messages.filter(m => m.role === 'user')).toHaveLength(1)
  })

  it('rejects empty text, system injection, duplicate ids and oversized input', async () => {
    const f = fixture(); const c = await f.service.create(1)
    for (const message of [user('u1', '  '), user('u1', 'x'.repeat(16001)), { ...user(), role: 'system' }]) {
      await expect(f.service.chat(1, { id: c.id, messages: [message], trigger: 'submit-message' }, new AbortController().signal)).rejects.toMatchObject({ statusCode: 400 })
    }
    await f.service.chat(1, { id: c.id, messages: [user()], trigger: 'submit-message' }, new AbortController().signal); await f.finish()
    await expect(f.service.chat(1, { id: c.id, messages: [user()], trigger: 'submit-message' }, new AbortController().signal)).rejects.toMatchObject({ statusCode: 409 })
  })

  it('releases the lease if runtime setup fails and leaves the submitted user available for regeneration', async () => {
    const f = fixture(); const c = await f.service.create(1)
    f.runtime.start = async () => { throw Error('provider unavailable') }
    await expect(f.service.chat(1, { id: c.id, messages: [user()], trigger: 'submit-message' }, new AbortController().signal)).rejects.toMatchObject({ statusCode: 503 })
    expect(await f.store.isActive(1)).toBe(false)
    expect((await f.service.detail(1, c.id)).messages).toEqual([user()])
  })

  it('allows retry with the same user message after a missing configuration error', async () => {
    const f = fixture(); const c = await f.service.create(1)
    f.runtime.checkConfiguration = () => { throw Object.assign(Error('AI 助手尚未配置'), { statusCode: 503 }) }
    const input = { id: c.id, messages: [user()], trigger: 'submit-message' as const }
    await expect(f.service.chat(1, input, new AbortController().signal)).rejects.toMatchObject({ statusCode: 503 })
    expect((await f.service.detail(1, c.id)).messages).toEqual([])
    expect(await f.store.isActive(1)).toBe(false)
    f.runtime.checkConfiguration = () => {}
    await expect(f.service.chat(1, input, new AbortController().signal)).resolves.toBeInstanceOf(Response)
    await f.finish()
  })

  it('bounds model context while preserving the full stored conversation', async () => {
    const f = fixture(); const c = await f.service.create(1)
    const history: ChatMessage[] = []
    for (let turn = 0; turn < 25; turn += 1) {
      history.push(user(`u${turn}`, 'x'.repeat(2000)), { id: `a${turn}`, role: 'assistant', parts: [{ type: 'text', text: 'y'.repeat(2000) }] })
    }
    f.histories.set(c.id, history)
    await f.service.chat(1, { id: c.id, messages: [user('current', 'continue')], trigger: 'submit-message' }, new AbortController().signal)
    expect(f.sent().length).toBeLessThan(history.length)
    expect(JSON.stringify(f.sent()).length).toBeLessThanOrEqual(48000)
    expect(f.sent()[0].role).toBe('user')
    expect(f.sent().at(-1)?.id).toBe('current')
    await f.finish()
    const stored = (await f.service.detail(1, c.id)).messages
    expect(stored).toHaveLength(52)
    expect(stored[0].id).toBe('u0')
  })
})
