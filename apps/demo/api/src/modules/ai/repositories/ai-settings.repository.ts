import { eq, sql } from 'drizzle-orm'
import type { AppQueryDb } from '@yishan/core-system-api/database'
import { aiModelSettings } from '../db/schema.js'

export type AiSettingsRecord = typeof aiModelSettings.$inferSelect
export interface AiSettingsSave {
  baseUrl: string
  model: string
  apiKey?: string
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
        updatedBy: input.updatedBy,
        updatedAt,
      } })
  }
}
