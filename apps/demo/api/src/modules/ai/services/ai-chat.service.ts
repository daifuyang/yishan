import { randomUUID } from 'node:crypto'
import type { AiCapability } from '@yishan/core-api/ai-capabilities/catalog'
import { AiChatRepository, type AiChatStore, type ChatMessage } from '../repositories/ai-chat.repository.js'
import { AiAuditRepository, type AiAuditStore } from '../repositories/ai-audit.repository.js'
import { ActionDraftService } from './action-draft.service.js'
import { ActionDraftRepository } from '../repositories/action-draft.repository.js'
import type { AppQueryDb } from '@yishan/core-system-api/database'
import { currentSystemRuntime } from '@yishan/core-system-api'
import { executeCapability, toolsForActor, type AiActor, type AiExecutionOutcome } from './ai-execution-chain.js'
import { buildDraftContext } from './draft-context.js'
import { selectModelHistory } from './model-history.js'
import { aiError } from '../ai-chat-error.js'
import { AiSettingsService, type AiModelConfiguration } from './ai-settings.service.js'
export { aiError } from '../ai-chat-error.js'

export interface AiChatInput { id: string; messages: unknown[]; trigger: 'submit-message' | 'regenerate-message'; messageId?: string }
/**
 * 本轮对话可用的执行环境。服务层不关心它怎么实现——真实实现是执行链
 * （鉴权 → 模块 → 权限重算 → schema 校验 → 业务规则 → 审计）。
 */
export interface AiExecutionEnv {
  /** 已按当前用户权限裁剪的能力清单。裁剪只影响提示，不是授权。 */
  readonly capabilities: readonly AiCapability[]
  execute(name: string, input: unknown): Promise<AiExecutionOutcome>
}
export interface AiRuntime {
  checkConfiguration?(configuration?: AiModelConfiguration): void
  validate(messages: unknown[]): Promise<ChatMessage[]>
  /**
   * `context` 是**本轮现算**的会话外上下文（例如当前草稿摘要）。
   *
   * 它刻意不进 `messages`：进消息就意味着落库，而草稿状态每轮都在变，
   * 存进历史只会变成第四份会过期的真相。
   */
  start(options: { messages: ChatMessage[]; signal: AbortSignal; execution: AiExecutionEnv; context?: string; configuration?: AiModelConfiguration; onEnd(message: ChatMessage): Promise<void> }): Promise<Response>
}
const loadRuntime = async (): Promise<AiRuntime> => import('../runtime/ai-sdk.mjs')

/**
 * 会话删除必须经过的草稿清理关卡。
 *
 * 单独抽成接口而不是直接依赖 `ActionDraftService`：聊天服务不应该知道草稿的
 * 存在，但「删会话」这条路径**必须**在删之前问一次草稿 —— 有草稿正在提交时
 * 拒绝删除（409），否则一次正在进行的用户创建会被级联删除悄悄吃掉。
 */
export interface AiConversationDraftGuard {
  removeConversationDrafts(ownerId: number, conversationId: string): Promise<unknown>
  /**
   * 本会话当前的草稿。用于每轮重新计算模型上下文里的草稿摘要。
   *
   * 可选：没有草稿能力的旧调用方仍然可用，只是模型看不到草稿状态。
   */
  list?(ownerId: number, conversationId: string): Promise<readonly unknown[]>
}

export class AiChatService {
  constructor(
    private readonly store: AiChatStore,
    private readonly runtime: () => Promise<AiRuntime> = loadRuntime,
    private readonly execution?: () => AiExecutionEnvFactory,
    private readonly drafts?: AiConversationDraftGuard,
  ) {}
  static forDatabase(db: AppQueryDb) {
    const settings = AiSettingsService.forDatabase(db)
    return new AiChatService(new AiChatRepository(db), async () => {
      const configuration = await settings.resolve()
      const runtime = await loadRuntime()
      return { ...runtime, checkConfiguration: () => runtime.checkConfiguration?.(configuration), start: options => runtime.start({ ...options, configuration }) }
    }, () => new AiExecutionEnvFactory({ db }), new ActionDraftService(new ActionDraftRepository(db)))
  }
  async list(ownerId: number) { return { items: (await this.store.list(ownerId)).map(summary) } }
  async create(ownerId: number) { const now = new Date(); return { ...summary(await this.store.create({ id: randomUUID(), ownerId, title: '新对话', createdAt: now, updatedAt: now })), messages: [] } }
  async detail(ownerId: number, id: string) {
    const conversation = await this.store.find(ownerId, id)
    if (!conversation) throw aiError(404, '对话不存在')
    return { ...summary(conversation), messages: await this.store.messages(ownerId, id) }
  }
  async rename(ownerId: number, id: string, title: string) {
    await this.detail(ownerId, id); await this.ensureIdle(ownerId)
    if (!title.trim() || title.trim().length > 100) throw aiError(400, '标题长度须为 1–100 字符')
    await this.store.rename(ownerId, id, title.trim()); return this.detail(ownerId, id)
  }
  /**
   * 删除会话。
   *
   * 草稿清理必须发生在**删会话之前**：`removeConversationDrafts` 会先锁会话行，
   * 发现有草稿处于 `submitting` 就抛 409。这条守卫只能活在删除路径上 —— 表上的
   * `ON DELETE CASCADE` 不管什么状态，依赖它就会让一次进行中的提交被静默删除。
   * 清理成功后再删会话；此时并发的提交会发现草稿已经不在（404），不会复活。
   */
  async remove(ownerId: number, id: string) {
    await this.detail(ownerId, id)
    await this.ensureIdle(ownerId)
    await this.drafts?.removeConversationDrafts(ownerId, id)
    await this.store.remove(ownerId, id)
    return null
  }
  private async ensureIdle(ownerId: number) { if (await this.store.isActive(ownerId)) throw aiError(409, '请先停止当前回复') }
  /**
   * 本会话当前的草稿摘要，每轮重算。
   *
   * 读不到草稿不是错误：没有草稿能力的旧调用方照样能用，只是模型少了这一段上下文。
   * 摘要绝不含敏感字段（草稿里本来就没有）。
   */
  private async draftContext(ownerId: number, conversationId: string): Promise<string> {
    if (!this.drafts?.list) return ''
    try {
      return buildDraftContext(await this.drafts.list(ownerId, conversationId) as Parameters<typeof buildDraftContext>[0])
    } catch {
      // 草稿读取失败不该让整轮对话失败：模型退回「没有草稿上下文」，仍可正常问答。
      return ''
    }
  }
  async chat(ownerId: number, input: AiChatInput, signal: AbortSignal, actor?: AiActor & { tokenScope?: string[] }): Promise<Response> {
    await this.detail(ownerId, input.id)
    const token = randomUUID()
    if (!await this.store.acquire(ownerId, input.id, token)) throw aiError(409, '当前已有回复正在生成')
    let handedOff = false
    try {
      let history = await this.store.messages(ownerId, input.id)
      if (input.trigger === 'regenerate-message') {
        if (input.messageId) {
          const index = history.findIndex(message => message.id === input.messageId)
          if (index < 0) throw aiError(400, '重新生成的消息不存在')
          history = history.slice(0, history[index].role === 'assistant' ? index : index + 1)
        } else if (history.at(-1)?.role === 'assistant') history = history.slice(0, -1)
        if (history.at(-1)?.role !== 'user') throw aiError(400, '没有可重新生成的消息')
      } else {
        if (!Array.isArray(input.messages) || input.messages.length > 200) throw aiError(400, '消息数量超出限制')
        const message = input.messages.at(-1)
        if (!isUserMessage(message)) throw aiError(400, '请输入 1–16000 字符的文本消息')
        if (history.some(existing => existing.id === message.id)) throw aiError(409, '消息已提交，请重新生成回复')
        history = [...history, { id: message.id, role: 'user', parts: message.parts.map(part => ({ type: 'text', text: part.text })) }]
      }
      if (history.length > 200 || JSON.stringify(history).length > 240000) throw aiError(400, '对话过长，请新建对话')
      const runtime = await this.runtime()
      try { history = await runtime.validate(history) } catch { throw aiError(400, '消息格式无效') }
      runtime.checkConfiguration?.()
      signal.throwIfAborted()
      await this.store.begin(ownerId, input.id, token, history)
      const messages = history
      // 无 actor（旧调用方 / 纯聊天）时不开放任何工具：宁可少功能，也不要
      // 在拿不到身份的情况下执行能力。
      const resolvedActor: AiActor & { tokenScope?: string[] } = actor ?? { userId: ownerId, roleIds: [], deptIds: [] }
      const execution = actor && this.execution
        ? await this.execution().env(resolvedActor, { requestId: token, conversationId: input.id })
        : { capabilities: [], execute: async () => ({ ok: false, error: '不可用' } as AiExecutionOutcome) }
      const response = await runtime.start({ messages: selectModelHistory(messages), signal, execution, context: await this.draftContext(ownerId, input.id), onEnd: async message => {
        try { await this.store.finish(ownerId, input.id, token, [...messages, message]) }
        finally { await this.store.release(ownerId, input.id, token) }
      } })
      handedOff = true
      return response
    } catch (error) {
      if (error && typeof error === 'object' && 'statusCode' in error) throw error
      throw aiError(503, signal.aborted ? '回复已停止' : 'AI 服务暂时不可用，请稍后重试')
    } finally { if (!handedOff) await this.store.release(ownerId, input.id, token) }
  }
}
function summary(conversation: { id: string; title: string; createdAt: Date; updatedAt: Date }) { return { id: conversation.id, title: conversation.title, createdAt: conversation.createdAt.toISOString(), updatedAt: conversation.updatedAt.toISOString() } }
/**
 * 把「当前请求」绑成一组可执行的能力环境。
 *
 * actor 只在这里构造一次，且 actorId 来自已认证的 `request.currentUser`——
 * 链上任何一环都没有「换一个用户执行」的入口。PAT 的 tokenScope 也一并带进来，
 * 于是执行链重算权限时 PAT 的收窄范围依然生效。
 */
export class AiExecutionEnvFactory {
  private readonly audit: AiAuditStore
  constructor(options: { db: AppQueryDb; audit?: AiAuditStore }) {
    this.audit = options.audit ?? new AiAuditRepository(options.db)
  }
  create(actor: AiActor & { tokenScope?: string[] }, context: { requestId: string; conversationId: string; sessionId?: string }): AiExecutionEnv {
    const request = {
      requestId: context.requestId,
      conversationId: context.conversationId,
      sessionId: context.sessionId,
      actor,
      runtime: currentSystemRuntime(),
      audit: this.audit,
    }
    return {
      capabilities: [], // 由 toolsForActor 填充，见 env()
      execute: (name, input) => executeCapability(request, name, input),
    }
  }
  /** 裁剪后的工具清单与能力清单，需要先算一次有效权限。 */
  async env(actor: AiActor & { tokenScope?: string[] }, context: { requestId: string; conversationId: string; sessionId?: string }): Promise<AiExecutionEnv> {
    const { capabilities } = await toolsForActor(actor)
    return { ...this.create(actor, context), capabilities }
  }
}

function isUserMessage(message: unknown): message is { id: string; role: 'user'; parts: { type: 'text'; text: string }[] } {
  if (!message || typeof message !== 'object' || !('id' in message) || typeof message.id !== 'string' || !/^[\w-]{1,64}$/.test(message.id) || !('role' in message) || message.role !== 'user' || !('parts' in message) || !Array.isArray(message.parts) || !message.parts.length) return false
  if (!message.parts.every(part => part && typeof part === 'object' && part.type === 'text' && typeof part.text === 'string')) return false
  const text = message.parts.map(part => part.text).join('')
  return text.trim().length > 0 && text.length <= 16000
}
