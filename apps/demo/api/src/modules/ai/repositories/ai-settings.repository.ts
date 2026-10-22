import { eq, sql } from 'drizzle-orm'
import type { AppQueryDb } from '@yishan/core-system-api/database'
import { aiModelSettings } from '../db/schema.js'

export type AiSettingsRecord = typeof aiModelSettings.$inferSelect
export interface AiSettingsSave {
  baseUrl: string
  model: string
  apiKey?: string
  enabled?: boolean
  updatedBy: number
}
export interface AiSettingsStore {
  get(): Promise<AiSettingsRecord | null>
  save(input: AiSettingsSave): Promise<void>
}

export class AiSettingsRepository implements AiSettingsStore {
  constructor(private readonly db: AppQueryDb) {}
  async get(): Promise<AiSettingsRecord | null> {
    const [row] = await this.db.select().from(aiModelSettings).where(eq(aiModelSettings.id, 1)).limit(1)
    return row ?? null
  }
  async save(input: AiSettingsSave): Promise<void> {
    const updatedAt = new Date()
    await this.db.insert(aiModelSettings).values({ ...input, id: 1, apiKey: input.apiKey || '', updatedAt })
      .onDuplicateKeyUpdate({ set: {
        baseUrl: input.baseUrl,
        model: input.model,
        // 保留发生在同一条 upsert 内，避免空密钥编辑覆盖并发更新的新密钥。
        apiKey: input.apiKey || sql`${aiModelSettings.apiKey}`,
        // 缺省表示「本次编辑不动开关」，与 apiKey 同理：只改模型的表单不该顺手把
        // 功能关掉。存量行由迁移补上 DEFAULT 1，读侧再兜一层未配置即启用。
        enabled: input.enabled === undefined ? sql`${aiModelSettings.enabled}` : input.enabled,
        updatedBy: input.updatedBy,
        updatedAt,
      } })
  }
}
