import { afterEach, describe, expect, vi } from 'vitest'
import { it } from './draft-runtime.js'
import { start, validate, SYSTEM_PROMPT } from '../runtime/ai-sdk.mjs'
import { buildDraftContext } from '../services/draft-context.js'
import type { ChatMessage } from '../schemas/ai-chat.schema.js'
import { readUIMessageStream, uiMessageChunkSchema } from 'ai'
import type { AiCapability } from '@yishan/core-api/ai-capabilities/catalog'

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })
const messages: ChatMessage[] = [{ id: 'user-1', role: 'user', parts: [{ type: 'text', text: '帮我看看用户情况' }] }]
// 本文件验证的是「走模型的那条分支」，所以给一个空能力集：既不命中意图规则，
// 也不命中闲聊拦截，确保请求真的发到 provider。
const noTools = { capabilities: [], execute: async () => ({ ok: false as const, error: '不可用' }) }
function configured() { vi.stubEnv('AI_CHAT_API_KEY', 'test-secret-not-real'); vi.stubEnv('AI_CHAT_MODEL', 'test-model'); vi.stubEnv('AI_CHAT_BASE_URL', 'https://unit.test/v1') }
const sse = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
const start_ = sse('message_start', { type: 'message_start', message: { id: 'msg-1', type: 'message', role: 'assistant', model: 'test-model', content: [], stop_reason: null, usage: { input_tokens: 1, output_tokens: 0 } } })
const textBlock = (text: string) => sse('content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }) + sse('content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } })
const end = (text: string, finish = false) => textBlock(text) + (finish
  ? sse('content_block_stop', { type: 'content_block_stop', index: 0 }) + sse('message_delta', { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 1 } }) + sse('message_stop', { type: 'message_stop' })
  : '')

describe('native ESM AI SDK 7 runtime', () => {
  it('opens the direct reply stream with pending tool state before execution finishes', async () => {
    configured()
    let release!: () => void
    const pending = new Promise<void>(resolve => { release = resolve })
    const responsePromise = start({
      messages: [{ id: 'u', role: 'user', parts: [{ type: 'text', text: '用户列表' }] }],
      signal: new AbortController().signal,
      execution: {
        capabilities: [{ name: 'list_users' } as AiCapability],
        execute: async () => { await pending; return { ok: true, result: { data: { items: [] }, summary: '查询完成' } } },
      },
      onEnd: async () => {},
    })
    try {
      const response = await Promise.race([responsePromise, new Promise<undefined>(resolve => setTimeout(resolve, 100))])
      expect(response).toBeInstanceOf(Response)
      const reader = response!.body!.getReader()
      let partial = ''
      while (!partial.includes('tool-input-available')) {
        const chunk = await reader.read()
        partial += new TextDecoder().decode(chunk.value)
      }
      expect(partial).not.toContain('tool-output-available')
      release()
      while (!(await reader.read()).done) { /* consume remaining stream */ }
    } finally { release() }
  })
  it.each([true, false])('emits valid tool stream chunks and persists direct reply results (ok=%s)', async ok => {
    configured()
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    let saved: ChatMessage | undefined
    const response = await start({
      messages: [{ id: 'direct-user', role: 'user', parts: [{ type: 'text', text: '用户列表' }] }],
      signal: new AbortController().signal,
      execution: {
        capabilities: [{ name: 'list_users' } as AiCapability],
        execute: async () => ok ? { ok: true, result: { data: { items: [], total: 0 }, render: { kind: 'user.table', payload: { items: [], total: 0 } } } } : { ok: false, error: '没有权限执行该操作' },
      },
      onEnd: async message => { saved = message },
    })
    const body = await response.text()
    const events = body.split('\n').filter(line => line.startsWith('data: {')).map(line => JSON.parse(line.slice(6)))
    for (const event of events) {
      await expect(uiMessageChunkSchema().validate!(event)).resolves.toMatchObject({ success: true })
    }
    const stream = new ReadableStream({ start(controller) { for (const event of events) controller.enqueue(event); controller.close() } })
    let rendered: ChatMessage | undefined
    for await (const message of readUIMessageStream<ChatMessage>({ stream, terminateOnError: true })) rendered = message
    expect(rendered?.parts).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'tool-list_users', state: 'output-available', output: expect.objectContaining({ ok }) })]))
    expect(saved?.parts).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'tool-list_users', state: 'output-available' })]))
    expect(fetch).not.toHaveBeenCalled()
  })
  it('validates UI message parts with the installed SDK', async () => {
    await expect(validate(messages)).resolves.toEqual(messages)
    await expect(validate([{ id: 'bad', role: 'user', parts: [{ type: 'bogus' }] }])).rejects.toThrow()
  })
  it('fails before streaming when server credentials are absent', async () => {
    vi.stubEnv('AI_CHAT_API_KEY', ''); vi.stubEnv('AI_CHAT_MODEL', '')
    await expect(start({ messages, signal: new AbortController().signal, onEnd: async () => {}, execution: noTools })).rejects.toThrow('AI_CHAT_API_KEY')
  })
  it('streams the actual SDK UI protocol and persists generated parts', async () => {
    configured()
    let saved: ChatMessage | undefined
    let posted = ''
    vi.stubGlobal('fetch', async (_url: unknown, init: RequestInit) => {
      posted = String(init.body)
      return new Response(start_ + end('你好，') + sse('content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: '世界' } }) + end('', true), { headers: { 'content-type': 'text/event-stream' } })
    })
    const response = await start({ messages, signal: new AbortController().signal, onEnd: async message => { saved = message }, execution: noTools })
    const body = await response.text()
    expect(response.headers.get('x-vercel-ai-ui-message-stream')).toBe('v1')
    expect(body).toContain('"type":"text-delta"')
    expect(body).toContain('你好，')
    expect(body).not.toContain('test-secret')
    expect(saved).toMatchObject({ role: 'assistant', metadata: { status: 'complete' } })
    expect(saved?.parts).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'text', text: '你好，世界' })]))
    expect(JSON.parse(posted)).toMatchObject({ model: 'test-model', max_tokens: 4096, stream: true })
  })
  it('states the native form assistance boundary: ask only what is missing, the password is typed in the form', () => {
    expect(SYSTEM_PROMPT).toContain('原生表单')
    expect(SYSTEM_PROMPT).toContain('每轮只填用户本轮提供或明确修改的字段')
    expect(SYSTEM_PROMPT).toContain('密码、头像和附件由用户在原生表单里填写')
    // 「直接创建」「我确认了」必须被写成不构成授权。
    expect(SYSTEM_PROMPT).toContain('不能把聊天里的确认当成已经删除')
    expect(SYSTEM_PROMPT).toContain('真正的校验、权限、字段联动、上传、提交和保存结果均由原生表单及既有业务 API 负责')
  })
  it('sends the current draft as a transient trailing system message, never as stored history', async () => {
    configured()
    let posted = ''
    vi.stubGlobal('fetch', async (_url: unknown, init: RequestInit) => {
      posted = String(init.body)
      return new Response(start_ + end('好的，') + sse('content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: '已收齐。' } }) + end('', true), { headers: { 'content-type': 'text/event-stream' } })
    })
    const context = buildDraftContext([{
      draftId: 'draft-1', ownerId: 7, conversationId: 'conv-1', module: 'system', action: 'user.create',
      schemaVersion: 1, formData: { username: 'zhangsan' },
      missingFields: [{ name: 'phone', label: '手机号', required: true, sensitive: false, mustCompleteInForm: false }],
      validationErrors: [], draftVersion: 3, status: 'collecting', resultRef: null, failureReason: null,
      expiresAt: new Date(), createdAt: new Date(), updatedAt: new Date(),
    }])
    let saved: ChatMessage | undefined
    const response = await start({
      messages: [{ id: 'u1', role: 'user', parts: [{ type: 'text', text: '手机号 13800000000' }] }],
      signal: new AbortController().signal,
      execution: noTools,
      context,
      onEnd: async message => { saved = message },
    })
    await response.text()
    const body = JSON.parse(posted)
    expect(JSON.stringify(body.system)).toContain('原生表单')
    // 草稿摘要进系统提示（Anthropic 端点不接受 role:system 的消息），但不进历史。
    expect(JSON.stringify(body.system)).toContain("username='zhangsan'")
    expect(JSON.stringify(body.system)).toContain('仍需向用户询问：手机号')
    expect(JSON.stringify(body.messages)).not.toContain("username='zhangsan'")
    expect(JSON.stringify(saved)).not.toContain("username='zhangsan'")
  })
  it('sends no draft context at all when the conversation has no draft', () => {
    expect(buildDraftContext([])).toBe('')
  })
  it('persists partial output on abort even when the client does not consume the response', async () => {
    configured()
    const abort = new AbortController()
    let saved: ChatMessage | undefined
    vi.stubGlobal('fetch', async (_url: unknown, init: RequestInit) => new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(start_ + end('保留部分')))
        init.signal?.addEventListener('abort', () => controller.error(new DOMException('aborted', 'AbortError')), { once: true })
      },
    }), { headers: { 'content-type': 'text/event-stream' } }))
    const response = await start({ messages, signal: abort.signal, onEnd: async message => { saved = message }, execution: noTools })
    const reader = response.body!.getReader()
    let body = ''
    while (!body.includes('保留部分')) { const next = await reader.read(); if (next.done) break; body += new TextDecoder().decode(next.value) }
    abort.abort()
    await vi.waitFor(() => expect(saved).toMatchObject({ metadata: { status: 'aborted' } }))
    expect(saved?.parts).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'text', text: '保留部分', state: 'done' })]))
    await reader.cancel()
  })
  it('masks provider error details and still persists an error terminal message', async () => {
    configured(); let saved: ChatMessage | undefined
    const stderr = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ error: { message: 'sensitive-provider-details-test-secret', type: 'invalid_request_error' } }), { status: 401, headers: { 'content-type': 'application/json' } }))
    const response = await start({ messages, signal: new AbortController().signal, onEnd: async message => { saved = message }, execution: noTools })
    const body = await response.text()
    expect(body).toContain('AI 服务暂时不可用')
    expect(body).not.toContain('sensitive-provider-details')
    expect(saved?.metadata?.status).toBe('error')
    expect(stderr).not.toHaveBeenCalled()
  })
})

it('runs discover, describe, query and draft through generic tools without business-specific forced steps', async () => {
  configured()
  const calls: string[] = []
  let requestCount = 0
  const flow = [
    { name: 'discover_operations', input: { keyword: '创建用户' } },
    { name: 'describe_operation', input: { operationId: 'user.create' } },
    { name: 'query_business_data', input: { operationId: 'user.options', params: {} } },
    { name: 'update_form_draft', input: { operationId: 'user.create', values: { nickname: '新昵称' } } },
  ]
  vi.stubGlobal('fetch', async (_url: unknown, init: RequestInit) => {
    const body = JSON.parse(String(init.body))
    expect(body.tool_choice).not.toMatchObject({ type: 'any' })
    expect(body.tools.map((tool: { name: string }) => tool.name).sort()).toEqual(['describe_operation', 'discover_operations', 'query_business_data', 'update_form_draft'])
    const next = flow[requestCount]
    requestCount++
    if (!next) return new Response(start_ + end('请在原生表单核对。', true), { headers: { 'content-type': 'text/event-stream' } })
    return new Response(start_ + sse('content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'tool_use', id: 'tool-' + requestCount, name: next.name, input: {} } }) + sse('content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: JSON.stringify(next.input) } }) + sse('content_block_stop', { type: 'content_block_stop', index: 0 }) + sse('message_delta', { type: 'message_delta', delta: { stop_reason: 'tool_use' }, usage: { output_tokens: 1 } }) + sse('message_stop', { type: 'message_stop' }), { headers: { 'content-type': 'text/event-stream' } })
  })
  const response = await start({ messages: [{ id: 'create', role: 'user', parts: [{ type: 'text', text: '帮我增加一个用户，用户名叫张杰，昵称杰威尔' }] }], signal: new AbortController().signal, onEnd: async () => {}, execution: {
    capabilities: [
      { name: 'get_user_create_options', enabled: true, riskLevel: 'read', moduleId: 'system', description: '查询候选', inputSchema: { type: 'object' }, operation: { id: 'user.options', name: '候选', type: 'query' } },
      { name: 'prepare_user_create', enabled: true, riskLevel: 'prepare', moduleId: 'system', description: '创建用户', inputSchema: { type: 'object' }, operation: { id: 'user.create', name: '创建用户', type: 'create', formKey: 'user.create' } },
    ] as AiCapability[],
    execute: async (name, input) => { calls.push(name); return { ok: true, result: { data: {}, ...(name === 'prepare_user_create' ? { render: { kind: 'form.prefill', payload: { target: 'user.create', fields: input, missing: [] } } } : {}) } } },
  } })
  const output = await response.text()
  expect(calls).toEqual(['get_user_create_options', 'prepare_user_create'])
  expect(output).toContain('form.prefill')
  expect(requestCount).toBe(5)
})

it.each(['创建用户有哪些必填字段？', '新增用户需要什么权限？'])('does not force open a form for a schema question: %s', async question => {
 configured()
 let posted: Record<string, unknown> = {}
 vi.stubGlobal('fetch', async (_url: unknown, init: RequestInit) => {
  posted = JSON.parse(String(init.body))
  return new Response(start_ + end('这是字段说明。', true), {headers:{'content-type':'text/event-stream'}})
 })
 const response = await start({messages:[{id:'question',role:'user',parts:[{type:'text',text:question}]}],signal:new AbortController().signal,onEnd:async()=>{},execution:{
  capabilities:['get_user_create_form','prepare_user_create'].map(name=>({name,description:name,inputSchema:{type:'object'}}) as AiCapability),
  execute:async()=>({ok:false,error:'should not execute'}),
 }})
 await response.text()
 expect(posted.tool_choice).not.toMatchObject({type:'tool'})
})

it('does not execute a hallucinated legacy tool outside the generic operation facade', async () => {
 configured()
 let step=0
 const executed: string[]=[]
 vi.stubGlobal('fetch',async(_url:unknown,init:RequestInit)=>{
  const body=JSON.parse(String(init.body))
  expect(body.tools.map((tool:{name:string})=>tool.name)).not.toContain('list_departments')
  const name=step===0?'list_departments':undefined
  step++
  if(!name)return new Response(start_+end('请在原生表单核对。',true),{headers:{'content-type':'text/event-stream'}})
  const input=name==='prepare_user_create'?{nickname:'豆包'}:{}
  return new Response(start_+sse('content_block_start',{type:'content_block_start',index:0,content_block:{type:'tool_use',id:'read-'+step,name,input:{}}})+sse('content_block_delta',{type:'content_block_delta',index:0,delta:{type:'input_json_delta',partial_json:JSON.stringify(input)}})+sse('content_block_stop',{type:'content_block_stop',index:0})+sse('message_delta',{type:'message_delta',delta:{stop_reason:'tool_use'},usage:{output_tokens:1}})+sse('message_stop',{type:'message_stop'}),{headers:{'content-type':'text/event-stream'}})
 })
 const response=await start({messages:[{id:'u',role:'user',parts:[{type:'text',text:'帮我创建一个用户，昵称豆包，部门开发岗位上海'}]}],signal:new AbortController().signal,onEnd:async()=>{},execution:{
  capabilities:['get_user_create_form','get_user_create_options','prepare_user_create','list_departments'].map(name=>({name,description:name,inputSchema:{type:'object'}}) as AiCapability),
  execute:async(name)=>{executed.push(name);return{ok:true,result:{data:{},...(name==='prepare_user_create'?{render:{kind:'form.prefill',payload:{target:'user.create',fields:{nickname:'豆包'},missing:[]}}}:{})}}},
 }})
 const output=await response.text()
 expect(executed).toEqual([])
 expect(output).not.toContain('form.prefill')
 expect(output).toContain('tool-output-error')
})
