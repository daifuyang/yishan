import { afterEach, expect, it, vi } from 'vitest'
import type { AiCapability } from '@yishan/core-api/ai-capabilities/catalog'
import type { ChatMessage } from '../schemas/ai-chat.schema.js'
import { start } from '../runtime/ai-sdk.mjs'

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })
const event = (type: string, data: unknown) => `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`
const begin = event('message_start', { type: 'message_start', message: { id: 'msg', type: 'message', role: 'assistant', model: 'test', content: [], stop_reason: null, usage: { input_tokens: 2, output_tokens: 0 } } })
const finish = (reason = 'end_turn') => event('message_delta', { type: 'message_delta', delta: { stop_reason: reason }, usage: { output_tokens: 3 } }) + event('message_stop', { type: 'message_stop' })
const calls = (count: number) => begin + Array.from({ length: count }, (_, index) =>
  event('content_block_start', { type: 'content_block_start', index, content_block: { type: 'tool_use', id: `call-${index}`, name: 'query_business_data', input: {} } }) +
  event('content_block_delta', { type: 'content_block_delta', index, delta: { type: 'input_json_delta', partial_json: JSON.stringify({ operationId: 'inventory.list', params: {} }) } }) +
  event('content_block_stop', { type: 'content_block_stop', index }),
).join('') + finish('tool_use')
const messages: ChatMessage[] = [{ id: 'u', role: 'user', parts: [{ type: 'text', text: '请检查库存业务数据' }] }]
function configured() { vi.stubEnv('AI_CHAT_API_KEY', 'fake-secret'); vi.stubEnv('AI_CHAT_MODEL', 'test'); vi.stubEnv('AI_CHAT_BASE_URL', 'https://unit.test/v1') }

it('keeps semantic results on direct reads without making a model call', async () => {
  configured()
  const fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)
  const response = await start({ messages: [{ id: 'u', role: 'user', parts: [{ type: 'text', text: '用户列表' }] }], signal: new AbortController().signal, onEnd: async () => {}, execution: {
    capabilities: [{ name: 'list_users', operation: { id: 'user.list', name: '查询用户', type: 'query', presentation: { kind: 'list', subject: '用户' } } } as AiCapability],
    execute: async () => ({ ok: true, result: { data: { items: [], total: 0 } } }),
  } })
  expect(await response.text()).toContain('"progress":{"action":"query","kind":"list","subject":"用户","outcome":"empty"')
  expect(fetch).not.toHaveBeenCalled()
})

it('exposes only generic tools and enforces twelve real calls even in a parallel batch', async () => {
  configured()
  let executed = 0
  const posted: Record<string, unknown>[] = []
  vi.stubGlobal('fetch', async (_url: unknown, init: RequestInit) => {
    posted.push(JSON.parse(String(init.body)))
    return new Response(calls(15), { headers: { 'content-type': 'text/event-stream' } })
  })
  let saved: ChatMessage | undefined
  const response = await start({ messages, signal: new AbortController().signal, onEnd: async message => { saved = message }, execution: {
    capabilities: [{ name: 'lookup_inventory', moduleId: 'stock', enabled: true, riskLevel: 'read', inputSchema: { type: 'object' }, operation: { id: 'inventory.list', name: '库存', type: 'query' } } as AiCapability],
    execute: async () => { executed += 1; await Promise.resolve(); return { ok: true, result: { data: { total: 0 } } } },
  } })
  const output = await response.text()
  expect(executed).toBe(12)
  expect(posted).toHaveLength(1)
  expect((posted[0].tools as { name: string }[]).map(tool => tool.name).sort()).toEqual(['describe_operation', 'discover_operations', 'query_business_data', 'update_form_draft'])
  expect(output).toContain('本轮工具调用次数已达上限')
  expect(output).toContain('"progress":{"action":"query"')
  expect(saved?.parts).toContainEqual(expect.objectContaining({
    type: 'tool-query_business_data', state: 'output-available',
    output: expect.objectContaining({ progress: expect.objectContaining({ action: 'query', subject: '库存' }) }),
  }))
  expect(saved?.metadata?.metrics).toMatchObject({ toolCalls: 12, modelCalls: 1 })
  expect(saved?.metadata?.tokenUsage).toMatchObject({ inputTokens: 2, outputTokens: 3 })
  expect(Object.keys(saved?.metadata?.metrics ?? {}).sort()).toEqual(['durationMs', 'modelCalls', 'toolCalls'])
})

it('retains actual model reasoning and safe timing metrics without logging message content', async () => {
  configured()
  vi.stubGlobal('fetch', async () => new Response(begin +
    event('content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '', signature: '' } }) +
    event('content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: '核对可用业务操作' } }) +
    event('content_block_stop', { type: 'content_block_stop', index: 0 }) + finish(), { headers: { 'content-type': 'text/event-stream' } }))
  let saved: ChatMessage | undefined
  const response = await start({ messages, signal: new AbortController().signal, onEnd: async message => { saved = message }, execution: { capabilities: [], execute: async () => ({ ok: false, error: '不可用' }) } })
  const output = await response.text()
  expect(output).toContain('reasoning-delta')
  expect(saved?.parts).toContainEqual(expect.objectContaining({ type: 'reasoning', text: '核对可用业务操作', state: 'done' }))
  expect(saved?.metadata?.metrics?.durationMs).toBeGreaterThanOrEqual(0)
  expect(saved?.metadata?.status).toBe('complete')
})

it('cancels pending direct reads promptly and persists an aborted result', async () => {
  configured()
  const controller = new AbortController()
  let saved: ChatMessage | undefined
  const response = await start({ messages: [{ id: 'u', role: 'user', parts: [{ type: 'text', text: '用户列表' }] }], signal: controller.signal, onEnd: async message => { saved = message }, execution: {
    capabilities: [{ name: 'list_users' } as AiCapability],
    execute: async () => new Promise(() => {}),
  } })
  const reader = response.body!.getReader()
  await reader.read()
  controller.abort()
  await vi.waitFor(() => expect(saved?.metadata?.status).toBe('aborted'))
  expect(saved?.metadata?.metrics?.modelCalls).toBe(0)
  await reader.cancel()
})

it('can continue after a cancelled tool call without sending an orphan invocation to the provider', async () => {
  configured()
  let posted = ''
  vi.stubGlobal('fetch', async (_url: unknown, init: RequestInit) => {
    posted = String(init.body)
    return new Response(begin + finish(), { headers: { 'content-type': 'text/event-stream' } })
  })
  const history: ChatMessage[] = [
    { id: 'old-user', role: 'user', parts: [{ type: 'text', text: '先前查询' }] },
    { id: 'partial', role: 'assistant', parts: [{ type: 'tool-query_business_data', toolCallId: 'unfinished-call', state: 'input-available', input: { operationId: 'inventory.list', params: {} } }], metadata: { status: 'aborted' } },
    ...messages,
  ]
  const before = structuredClone(history)
  const response = await start({ messages: history, signal: new AbortController().signal, onEnd: async () => {}, execution: { capabilities: [], execute: async () => ({ ok: false, error: '不可用' }) } })
  await response.text()
  expect(posted).not.toContain('unfinished-call')
  expect(history).toEqual(before)
})
