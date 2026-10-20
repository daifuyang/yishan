import type { AppQueryDb } from '@yishan/core-system-api/database'
import { aiError } from '../ai-chat-error.js'
import { AiSettingsRepository, type AiSettingsStore } from '../repositories/ai-settings.repository.js'
import type { AiSettingsInput, AiSettingsResponse } from '../schemas/ai-settings.schema.js'

export interface AiModelConfiguration { apiKey: string; model: string; baseUrl: string }
export interface AiSettingsEnvironment { AI_CHAT_API_KEY?: string; AI_CHAT_MODEL?: string; AI_CHAT_BASE_URL?: string }
const DEFAULT_BASE_URL = 'https://api.anthropic.com/v1'

function baseUrl(value = ''): string {
  const normalized = value.trim() || DEFAULT_BASE_URL
  try {
    const url = new URL(normalized)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || normalized.includes('?') || normalized.includes('#') || /[\u0000-\u001f\u007f]/.test(value)) throw new Error('invalid URL')
  } catch { throw aiError(400, '模型地址必须为不含账号、查询参数或片段的 HTTP/HTTPS 地址') }
  return normalized
}
function validKey(value: string) { return value.length > 0 && !/[\s\u0000-\u001f\u007f]/.test(value) }

export class AiSettingsService {
  constructor(private readonly store: AiSettingsStore, private readonly environment: () => AiSettingsEnvironment = () => ({
    AI_CHAT_API_KEY: process.env.AI_CHAT_API_KEY,
    AI_CHAT_MODEL: process.env.AI_CHAT_MODEL,
    AI_CHAT_BASE_URL: process.env.AI_CHAT_BASE_URL,
  })) {}
  static forDatabase(db: AppQueryDb) { return new AiSettingsService(new AiSettingsRepository(db)) }

  private async storedSettings() {
    try { return await this.store.get() }
    catch { throw aiError(503, 'AI 配置读取失败，请稍后重试') }
  }

  private environmentConfiguration(): AiModelConfiguration | null {
    const env = this.environment()
    if (!env.AI_CHAT_API_KEY || !validKey(env.AI_CHAT_API_KEY) || !env.AI_CHAT_MODEL?.trim()) return null
    try { return { apiKey: env.AI_CHAT_API_KEY, model: env.AI_CHAT_MODEL.trim(), baseUrl: baseUrl(env.AI_CHAT_BASE_URL) } }
    catch { return null }
  }

  async read(): Promise<AiSettingsResponse> {
    const row = await this.storedSettings()
    const env = row ? null : this.environmentConfiguration()
    return {
      baseUrl: row?.baseUrl ?? env?.baseUrl ?? DEFAULT_BASE_URL,
      model: row?.model ?? env?.model ?? '',
      hasApiKey: Boolean(row ? row.apiKey : env?.apiKey),
      source: row ? 'database' : env ? 'environment' : 'unconfigured',
    }
  }

  async save(input: AiSettingsInput, actorId: number): Promise<AiSettingsResponse> {
    const model = input.model.trim()
    const url = baseUrl(input.baseUrl)
    if (input.apiKey && !validKey(input.apiKey)) throw aiError(400, 'API Key 不能包含空白或控制字符')
    if (!model) throw aiError(400, '必须填写模型')
    if (!input.apiKey && !(await this.storedSettings())?.apiKey) throw aiError(400, '必须填写 API Key')
    try { await this.store.save({ baseUrl: url, model, apiKey: input.apiKey || undefined, updatedBy: actorId }) }
    catch { throw aiError(503, 'AI 配置保存失败，请稍后重试') }
    return this.read()
  }

  async resolve(): Promise<AiModelConfiguration> {
    const row = await this.storedSettings()
    if (row) {
      if (!validKey(row.apiKey) || !row.model.trim()) throw aiError(503, 'AI 模型配置不完整，请联系管理员')
      try { return { apiKey: row.apiKey, model: row.model.trim(), baseUrl: baseUrl(row.baseUrl) } }
      catch { throw aiError(503, 'AI 模型配置无效，请联系管理员') }
    }
    const env = this.environmentConfiguration()
    if (!env) throw aiError(503, 'AI 模型尚未配置，请联系管理员')
    return env
  }
}
