import Fastify from 'fastify'
import { errorHandlerPlugin } from '@yishan/core-api/plugins'
import { describe, expect, it, vi } from 'vitest'
import aiRoutes from '../routes/v1/index.js'
import { aiError, AiChatService } from '../services/ai-chat.service.js'
import { checkConfiguration } from '../runtime/ai-sdk.mjs'

async function appFor(status: 200 | 401 | 403 = 200, coreErrors = false) {
  const app = Fastify()
  if (coreErrors) await app.register(errorHandlerPlugin, { production: true })
  app.decorate('authenticate', async request => {
    if (status === 401) throw Object.assign(new Error('请登录'), { statusCode: 401 })
    Object.assign(request, { currentUser: { id: 17 } })
  })
  app.decorate('requirePermission', permission => {
    expect(permission.code).toBe('ai:chat:use')
    return async () => { if (status === 403) throw Object.assign(new Error('无权使用'), { statusCode: 403 }) }
  })
  await app.register(aiRoutes)
  return app
}
const payload = { id: 'conversation-1', trigger: 'submit-message', messages: [{ id: 'user-1', role: 'user', parts: [{ type: 'text', text: '你好' }] }] }

describe('AI HTTP authentication and transport boundaries', () => {
  it.each([401, 403] as const)('rejects every CRUD and chat endpoint with %s before service access', async status => {
    const app = await appFor(status)
    const list = vi.spyOn(AiChatService.prototype, 'list')
    const chat = vi.spyOn(AiChatService.prototype, 'chat')
    try {
      for (const options of [
        { method: 'GET', url: '/conversations' },
        { method: 'POST', url: '/conversations' },
        { method: 'GET', url: '/conversations/conversation-1' },
        { method: 'PATCH', url: '/conversations/conversation-1', payload: { title: 'title' } },
        { method: 'DELETE', url: '/conversations/conversation-1' },
        { method: 'POST', url: '/chat', payload },
      ] as const) {
        const response = await app.inject(options)
        expect(response.statusCode, response.body).toBe(status)
      }
      expect(list).not.toHaveBeenCalled(); expect(chat).not.toHaveBeenCalled()
    } finally { await app.close() }
  })
  it('rejects an oversized body before opening a generation', async () => {
    const app = await appFor()
    const chat = vi.spyOn(AiChatService.prototype, 'chat')
    try {
      const response = await app.inject({ method: 'POST', url: '/chat', payload: { ...payload, messages: [{ ...payload.messages[0], parts: [{ type: 'text', text: 'x'.repeat(262144) }] }] } })
      expect(response.statusCode).toBe(413); expect(chat).not.toHaveBeenCalled()
    } finally { await app.close() }
  })
  it.each([
    { ...payload, trigger: 'arbitrary' },
    { ...payload, id: '../escape' },
    { ...payload, messages: Array.from({ length: 201 }, () => payload.messages[0]) },
    { id: 'conversation-1' },
  ])('rejects a malformed standard transport request', async invalid => {
    const app = await appFor()
    const chat = vi.spyOn(AiChatService.prototype, 'chat')
    try {
      const response = await app.inject({ method: 'POST', url: '/chat', payload: invalid })
      expect(response.statusCode).toBe(400); expect(chat).not.toHaveBeenCalled()
    } finally { await app.close() }
  })
  it('returns the standard response envelope and owner-scoped conversation data', async () => {
    const app = await appFor()
    const list = vi.spyOn(AiChatService.prototype, 'list').mockResolvedValue({ items: [] })
    try {
      const response = await app.inject({ method: 'GET', url: '/conversations' })
      expect(response.statusCode, response.body).toBe(200)
      expect(response.json()).toMatchObject({ success: true, code: 10000, data: { items: [] } })
      expect(list).toHaveBeenCalledWith(17)
    } finally { await app.close() }
  })
  it('aborts the generation signal when a streaming HTTP client disconnects', async () => {
    const app = await appFor()
    let generationSignal: AbortSignal | undefined
    vi.spyOn(AiChatService.prototype, 'chat').mockImplementation(async (_owner, _input, signal) => {
      generationSignal = signal
      return new Response(new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('data: {"type":"start","messageId":"a1"}\n\n'))
          signal.addEventListener('abort', () => controller.close(), { once: true })
        },
      }), { headers: { 'content-type': 'text/event-stream' } })
    })
    const client = new AbortController()
    try {
      const address = await app.listen({ host: '127.0.0.1', port: 0 })
      const response = await fetch(`${address}/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload), signal: client.signal })
      const reader = response.body!.getReader()
      expect((await reader.read()).done).toBe(false)
      expect(generationSignal?.aborted).toBe(false)
      client.abort()
      await vi.waitFor(() => expect(generationSignal?.aborted).toBe(true))
      await reader.cancel().catch(() => {})
    } finally {
      client.abort()
      // Undici may open an idle replacement socket after abort; this server belongs to the test.
      app.server.closeAllConnections()
      await app.close()
    }
  })
})

describe('AI errors with the actual Core error handler', () => {
  it.each([400, 404, 409, 503] as const)('preserves known AI HTTP status %s and the response envelope', async status => {
    const app = await appFor(200, true)
    vi.spyOn(AiChatService.prototype, 'detail').mockRejectedValue(aiError(status, '安全的业务提示'))
    try {
      const response = await app.inject({ method: 'GET', url: '/conversations/conversation-1' })
      expect(response.statusCode, response.body).toBe(status)
      expect(response.json()).toMatchObject({ success: false, message: '安全的业务提示', data: null })
    } finally { await app.close() }
  })
  it('preserves the missing-configuration 503 from the native ESM runtime', async () => {
    const app = await appFor(200, true)
    vi.stubEnv('AI_CHAT_API_KEY', ''); vi.stubEnv('AI_CHAT_MODEL', '')
    vi.spyOn(AiChatService.prototype, 'chat').mockImplementation(async () => { checkConfiguration(); throw Error('unreachable') })
    try {
      const response = await app.inject({ method: 'POST', url: '/chat', payload })
      expect(response.statusCode, response.body).toBe(503)
      expect(response.json()).toMatchObject({ success: false, message: expect.stringContaining('AI 助手尚未配置'), data: null })
    } finally { vi.unstubAllEnvs(); await app.close() }
  })
  it('preserves the body-limit 413 with the production error handler', async () => {
    const app = await appFor(200, true)
    try {
      const response = await app.inject({ method: 'POST', url: '/chat', payload: { ...payload, messages: [{ text: 'x'.repeat(262144) }] } })
      expect(response.statusCode, response.body).toBe(413)
    } finally { await app.close() }
  })
  it.each([401, 403] as const)('delegates authentication status %s to Core', async status => {
    const app = await appFor(status, true)
    try {
      const response = await app.inject({ method: 'GET', url: '/conversations' })
      expect(response.statusCode, response.body).toBe(status)
      expect(response.json()).toMatchObject({ success: false, data: null })
    } finally { await app.close() }
  })
  it('delegates unknown errors to Core production masking', async () => {
    const app = await appFor(200, true)
    vi.spyOn(AiChatService.prototype, 'detail').mockRejectedValue(Error('sensitive-internal-error'))
    try {
      const response = await app.inject({ method: 'GET', url: '/conversations/conversation-1' })
      expect(response.statusCode).toBe(500)
      expect(response.body).not.toContain('sensitive-internal-error')
    } finally { await app.close() }
  })
})
